import * as scheduler from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { generarTexto } from './core';
import { GROQ_API_KEY, GEMINI_API_KEY } from './gateway';
import { diaColombia } from './caja';
import { analizarEvento, proximosEventos, EventoComercial, AnalisisEvento } from './calendario';
import { calcularSugerenciasPrecio, SugerenciaPrecio } from './precios';
import { crearNotificacionIA } from './notificacionesIA';
import { notificarAdmins } from './notificar';
import { exigirAdmin } from './util';

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * MARKETING DE TEMPORADA
 *
 * 2 a 3 semanas antes de una fecha comercial fuerte arma una campaña:
 *  - EMPUJAR: lo que más vendió en esa fecha el año pasado y todavía tiene stock.
 *  - REPONER: lo que se vendió bien pero hoy tiene menos pares que entonces.
 *  - MOVER: inventario parado (mucho stock, poca rotación) que conviene sacar aprovechando la fecha.
 * Los productos los elige el servidor con datos reales; la IA solo redacta el enfoque y las ideas.
 */
export interface ItemCampana {
  codigo: number | string;
  producto: string;
  stock: number;
  imagen: string | null;
  motivo: string;
}

export interface Campana {
  id: string;
  clave: string;
  evento: string;
  fecha: string;
  diasFaltan: number;
  empujar: ItemCampana[];
  reponer: ItemCampana[];
  mover: ItemCampana[];
  estrategia: string;
}

async function imagenYStock(codigo: number | string): Promise<{ imagen: string | null; stock: number }> {
  try {
    const d = await db.doc(`productos/${String(codigo)}`).get();
    const x = d.data();
    return { imagen: x?.['imagen'] ? String(x['imagen']) : null, stock: Number(x?.['stock'] ?? 0) };
  } catch {
    return { imagen: null, stock: 0 };
  }
}

/** Arma las tres listas con datos reales. Función separada para poder probarla. */
export function seleccionarProductos(
  analisis: AnalisisEvento,
  precios: { promocion: SugerenciaPrecio[]; subir: SugerenciaPrecio[] },
): {
  empujar: Omit<ItemCampana, 'imagen'>[];
  reponer: Omit<ItemCampana, 'imagen'>[];
  mover: Omit<ItemCampana, 'imagen'>[];
} {
  const empujar: Omit<ItemCampana, 'imagen'>[] = [];
  const reponer: Omit<ItemCampana, 'imagen'>[] = [];

  for (const r of analisis.referenciasEstrella) {
    const stock = r.stockActual ?? 0;
    if (stock > 0) {
      empujar.push({
        codigo: r.codigo,
        producto: r.producto,
        stock,
        motivo: `Vendió ${r.paresAnioAnterior} par${r.paresAnioAnterior === 1 ? '' : 'es'} en esta fecha el año pasado.`,
      });
    }
    if (r.riesgoDeAgotarse) {
      reponer.push({
        codigo: r.codigo,
        producto: r.producto,
        stock,
        motivo: `Hoy hay ${stock} y el año pasado vendió ${r.paresAnioAnterior}: puede agotarse.`,
      });
    }
  }

  // Sin historial de esa fecha: se usan los de mejor rotación actual
  if (!empujar.length) {
    for (const s of precios.subir.slice(0, 5)) {
      empujar.push({
        codigo: s.codigo,
        producto: s.producto,
        stock: s.stock,
        motivo: `Es de los que mejor rotan hoy (${s.ventas30} ventas en 30 días).`,
      });
    }
  }

  const yaElegidos = new Set(empujar.map((e) => String(e.codigo)));
  const mover = precios.promocion
    .filter((s) => !yaElegidos.has(String(s.codigo)))
    .slice(0, 6)
    .map((s) => ({
      codigo: s.codigo,
      producto: s.producto,
      stock: s.stock,
      motivo: s.motivo,
    }));

  return { empujar: empujar.slice(0, 6), reponer: reponer.slice(0, 6), mover };
}

async function redactarEstrategia(ev: EventoComercial & { diasFaltan: number }, c: Pick<Campana, 'empujar' | 'reponer' | 'mover'>, analisis: AnalisisEvento): Promise<string> {
  const base = [
    `${ev.nombre} es en ${ev.diasFaltan} días.`,
    c.empujar.length ? `Empuja primero: ${c.empujar.map((x) => x.producto).join(', ')}.` : '',
    c.reponer.length ? `Revisa reposición de: ${c.reponer.map((x) => x.producto).join(', ')}.` : '',
    c.mover.length ? `Aprovecha la fecha para mover: ${c.mover.map((x) => x.producto).join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
  try {
    const t = await generarTexto(
      'rapido',
      `Eres el asesor de marketing de ShoeShop, tienda de calzado en un centro comercial de Colombia con más de 400 locales de calzado alrededor.
Prepara el plan de campaña para el dueño. Texto plano, máximo 12 líneas, con estas secciones cortas:
ENFOQUE (1-2 líneas: el mensaje central de la campaña), CRONOGRAMA (qué publicar en cada semana hasta la fecha) e IDEAS (3 ideas de publicación para estados de WhatsApp o Instagram).
REGLAS: usa SOLO los productos y cifras entregados, no inventes precios, descuentos ni productos. Español colombiano natural, cercano.`,
      JSON.stringify({ evento: ev.nombre, diasFaltan: ev.diasFaltan, nota: ev.nota ?? null, variacionAnioPasado: analisis.anioAnterior.variacionPorcentual, ...c }),
      { groq: GROQ_API_KEY.value(), gemini: GEMINI_API_KEY.value() },
      { temperature: 0.5, max_tokens: 900 },
    );
    return t.trim() || base;
  } catch (e) {
    console.warn('[campañas] IA no disponible, se usa el plan base', e);
    return base;
  }
}

/** Genera (o regenera) la campaña de un evento y la guarda. */
export async function generarCampana(ev: EventoComercial & { diasFaltan: number }): Promise<Campana> {
  const [analisis, precios] = await Promise.all([analizarEvento(ev), calcularSugerenciasPrecio(12)]);
  const sel = seleccionarProductos(analisis, precios);

  const conImagen = async (items: Omit<ItemCampana, 'imagen'>[]): Promise<ItemCampana[]> =>
    Promise.all(items.map(async (i) => ({ ...i, imagen: (await imagenYStock(i.codigo)).imagen })));
  const [empujar, reponer, mover] = await Promise.all([conImagen(sel.empujar), conImagen(sel.reponer), conImagen(sel.mover)]);

  const estrategia = await redactarEstrategia(ev, { empujar, reponer, mover }, analisis);
  const campana: Campana = {
    id: `${ev.clave}_${ev.ymd}`,
    clave: ev.clave,
    evento: ev.nombre,
    fecha: ev.ymd,
    diasFaltan: ev.diasFaltan,
    empujar,
    reponer,
    mover,
    estrategia,
  };
  await db.doc(`campanasMarketing/${campana.id}`).set({ ...campana, creado: admin.firestore.FieldValue.serverTimestamp() });
  return campana;
}

/** Deja la notificación de la campaña en la campana (una sola vez) y avisa por push si es nueva. */
async function publicarCampana(c: Campana): Promise<void> {
  const titulo = `Campaña lista: ${c.evento}`;
  const descripcion = `Faltan ${c.diasFaltan} días. Para empujar: ${c.empujar.length} referencia${c.empujar.length === 1 ? '' : 's'}; para reponer: ${c.reponer.length}; para mover: ${c.mover.length}.`;
  const nueva = await crearNotificacionIA({
    id: `campana_${c.id}`,
    tipo: 'marketing-temporada',
    severidad: 'info',
    titulo,
    descripcion,
    ruta: '/admin/campanas',
    params: { id: c.id },
  });
  if (nueva) await notificarAdmins(`📣 ${titulo}`, descripcion, { tipo: 'marketing-temporada' });
}

/** Todos los días prepara la campaña de las fechas fuertes que ya están a 3 semanas o menos (una sola vez por fecha). */
export const revisionCampanas = scheduler.onSchedule(
  {
    schedule: '30 8 * * *',
    timeZone: 'America/Bogota',
    secrets: [GROQ_API_KEY, GEMINI_API_KEY],
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async () => {
    const hoy = diaColombia(0).ymd;
    const candidatos = proximosEventos(hoy, 21).filter(
      (e) => e.tipo === 'comercial' && e.impacto !== 'bajo' && e.diasFaltan <= 21,
    );
    for (const e of candidatos) {
      const id = `${e.clave}_${e.ymd}`;
      if ((await db.doc(`campanasMarketing/${id}`).get()).exists) continue;
      await publicarCampana(await generarCampana(e));
    }
  },
);

/** Desde la app: genera ahora la campaña de un evento (por defecto, el próximo comercial). */
export const crearCampanaManual = onCall(
  { region: 'us-central1', timeoutSeconds: 300, memory: '1GiB', secrets: [GROQ_API_KEY, GEMINI_API_KEY] },
  async (request) => {
    await exigirAdmin(request);
    const clave = request.data?.clave ? String(request.data.clave) : null;
    const hoy = diaColombia(0).ymd;
    const eventos = proximosEventos(hoy, 120).filter((e) => e.tipo === 'comercial' && e.impacto !== 'bajo');
    const ev = clave ? eventos.find((e) => e.clave === clave) : eventos[0];
    if (!ev) throw new HttpsError('not-found', 'No hay una fecha comercial próxima para preparar.');
    const campana = await generarCampana(ev);
    await publicarCampana(campana);
    return campana;
  },
);
