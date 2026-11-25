import * as scheduler from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { generarTexto } from './core';
import { GROQ_API_KEY, GEMINI_API_KEY } from './gateway';
import { diaColombia } from './caja';
import { crearNotificacionIA } from './notificacionesIA';
import { notificarAdmins } from './notificar';
import { claveVendedor, ventaSacaPar } from './util';

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * PATRONES RAROS POR VENDEDOR
 *
 * Las reglas son exactas (no las decide la IA). La IA solo redacta el aviso con tono neutro:
 * un patrón no es una acusación, puede tener una explicación normal (promoción, cliente puntual).
 *
 * Se mide la semana en curso (domingo a hoy), la misma que muestra "Ventas Local" en la app,
 * para que al abrir la notificación los números coincidan.
 */
export interface VentaMin {
  vendedor: string;
  vendedorId?: string;
  local?: string;
  tipoVenta: string;
  precioBajo: boolean;
}

export interface Hallazgo {
  clave: string; // 'precio-bajo' | 'cambios'
  vendedor: string;
  vendedorKey: string;
  local?: string;
  total: number;
  casos: number;
  porcentaje: number;
  promedioEquipo: number;
}

export const MIN_VENTAS = 8;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

/** Función pura: busca patrones en una lista de ventas (ya filtradas a las que sacan un par). */
export function evaluarPatrones(ventas: VentaMin[]): Hallazgo[] {
  const por = new Map<string, { vendedor: string; local?: string; total: number; bajos: number; cambios: number }>();
  let total = 0;
  let bajos = 0;
  let cambios = 0;
  for (const v of ventas) {
    const nombre = v.vendedor || 'Sin nombre';
    const k = v.vendedorId || claveVendedor(nombre);
    const x = por.get(k) ?? { vendedor: nombre, local: v.local, total: 0, bajos: 0, cambios: 0 };
    const esCambio = String(v.tipoVenta ?? '').trim().toLowerCase() === 'cambio';
    x.total++;
    total++;
    if (v.precioBajo) {
      x.bajos++;
      bajos++;
    }
    if (esCambio) {
      x.cambios++;
      cambios++;
    }
    por.set(k, x);
  }

  const promBajo = pct(bajos, total);
  const promCambio = pct(cambios, total);
  const res: Hallazgo[] = [];
  for (const [k, x] of por) {
    if (x.total < MIN_VENTAS) continue; // muestra muy pequeña: no se concluye nada
    const pb = pct(x.bajos, x.total);
    if (x.bajos >= 3 && pb >= 30 && pb >= 2 * promBajo) {
      res.push({ clave: 'precio-bajo', vendedor: x.vendedor, vendedorKey: k, local: x.local, total: x.total, casos: x.bajos, porcentaje: pb, promedioEquipo: promBajo });
    }
    const pc = pct(x.cambios, x.total);
    if (x.cambios >= 4 && pc >= 25 && pc >= 2 * promCambio) {
      res.push({ clave: 'cambios', vendedor: x.vendedor, vendedorKey: k, local: x.local, total: x.total, casos: x.cambios, porcentaje: pc, promedioEquipo: promCambio });
    }
  }
  return res;
}

async function ventasDesde(inicio: Date): Promise<(VentaMin & { fecha: Date | null })[]> {
  const snap = await db
    .collection('ventas')
    .where('fechaVenta', '>=', admin.firestore.Timestamp.fromDate(inicio))
    .select('vendedor', 'vendedorId', 'local', 'tipoVenta', 'precioBajo', 'fechaVenta')
    .get();
  const lista: (VentaMin & { fecha: Date | null })[] = [];
  snap.forEach((d) => {
    const v = d.data();
    if (!ventaSacaPar(v)) return;
    lista.push({
      vendedor: String(v['vendedor'] ?? ''),
      vendedorId: v['vendedorId'] ? String(v['vendedorId']) : undefined,
      local: v['local'] ? String(v['local']) : undefined,
      tipoVenta: String(v['tipoVenta'] ?? ''),
      precioBajo: v['precioBajo'] === true,
      fecha: v['fechaVenta']?.toDate ? v['fechaVenta'].toDate() : null,
    });
  });
  return lista;
}

function textoBase(h: Hallazgo): { titulo: string; texto: string } {
  if (h.clave === 'precio-bajo') {
    return {
      titulo: `Ventas bajo el precio mínimo: ${h.vendedor}`,
      texto: `Esta semana ${h.vendedor} registró ${h.casos} de ${h.total} ventas (${h.porcentaje}%) por debajo del precio mínimo; el promedio del equipo es ${h.promedioEquipo}%. Puede tener una explicación normal (promoción, cliente puntual). Conviene revisarlo.`,
    };
  }
  return {
    titulo: `Cambios frecuentes: ${h.vendedor}`,
    texto: `Esta semana ${h.vendedor} registró ${h.casos} cambios sobre ${h.total} ventas (${h.porcentaje}%); el promedio del equipo es ${h.promedioEquipo}%. Puede ser casual (temporada de cambios, una tanda de tallas). Conviene revisarlo.`,
  };
}

async function redactarNeutro(h: Hallazgo, base: string): Promise<string> {
  try {
    const r = await generarTexto(
      'rapido',
      `Eres el asesor de control de ShoeShop, una tienda de calzado en Colombia.
Reescribe el aviso para el dueño en máximo 3 líneas, texto plano.
REGLAS: usa SOLO las cifras entregadas, no inventes datos. Tono neutral y respetuoso: describe el patrón, NO acuses ni asumas mala intención, menciona que puede haber una explicación normal y sugiere UNA acción concreta de revisión.`,
      JSON.stringify({ hallazgo: h, aviso_base: base }),
      { groq: GROQ_API_KEY.value(), gemini: GEMINI_API_KEY.value() },
      { temperature: 0.3, max_tokens: 300 },
    );
    return r.trim() || base;
  } catch (e) {
    console.warn('[patrones] IA no disponible, se usa el texto base', e);
    return base;
  }
}

/** Todas las noches revisa el día y la semana y deja notificaciones si algo se sale de lo normal. */
export const revisionPatrones = scheduler.onSchedule(
  {
    schedule: '15 21 * * *',
    timeZone: 'America/Bogota',
    secrets: [GROQ_API_KEY, GEMINI_API_KEY],
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async () => {
    const hoy = diaColombia(0);
    const inicioSemana = diaColombia(-hoy.diaSemana);
    const ventas = await ventasDesde(inicioSemana.inicio);

    // 1) Hoy: muchas ventas bajo el precio mínimo en todos los locales
    const deHoy = ventas.filter((v) => v.fecha && v.fecha >= hoy.inicio && v.fecha <= hoy.fin);
    const bajosHoy = deHoy.filter((v) => v.precioBajo).length;
    if (deHoy.length >= 4 && bajosHoy >= 4 && pct(bajosHoy, deHoy.length) >= 25) {
      const porVendedor = new Map<string, number>();
      deHoy.filter((v) => v.precioBajo).forEach((v) => porVendedor.set(v.vendedor, (porVendedor.get(v.vendedor) ?? 0) + 1));
      const top = [...porVendedor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => `${n} (${c})`).join(', ');
      const titulo = `Hoy se vendieron ${bajosHoy} pares bajo el precio mínimo`;
      const descripcion = `${bajosHoy} de ${deHoy.length} ventas de hoy (${pct(bajosHoy, deHoy.length)}%) quedaron por debajo del precio mínimo. Más casos: ${top}.`;
      const nueva = await crearNotificacionIA({
        id: `precio-bajo-dia_${hoy.ymd}`,
        tipo: 'precio-bajo-dia',
        severidad: 'media',
        titulo,
        descripcion,
        ruta: '/admin/locales',
        params: { local: 'todos', periodo: 'dia', fecha: hoy.ymd, precioBajo: '1' },
      });
      if (nueva) await notificarAdmins(`⚠️ ${titulo}`, descripcion, { tipo: 'precio-bajo-dia' });
    }

    // 2) Semana en curso: patrones por vendedor
    for (const h of evaluarPatrones(ventas)) {
      const { titulo, texto } = textoBase(h);
      const id = `patron-vendedor_${h.clave}_${h.vendedorKey}_${inicioSemana.ymd}`.slice(0, 200);
      // Si ya se avisó esta semana no se vuelve a gastar una llamada a la IA
      if ((await db.doc(`notificacionesIA/${id}`).get()).exists) continue;
      const descripcion = await redactarNeutro(h, texto);
      const params: Record<string, string> = {
        local: 'todos',
        periodo: 'semana',
        vendedor: h.vendedor,
      };
      if (h.clave === 'precio-bajo') params['precioBajo'] = '1';
      const nueva = await crearNotificacionIA({
        id,
        tipo: 'patron-vendedor',
        severidad: 'info',
        titulo,
        descripcion,
        ruta: '/admin/locales',
        params,
        extra: { vendedor: h.vendedor, patron: h.clave },
      });
      if (nueva) await notificarAdmins(`🔎 ${titulo}`, descripcion, { tipo: 'patron-vendedor' });
    }
  },
);
