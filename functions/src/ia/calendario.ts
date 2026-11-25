import * as scheduler from 'firebase-functions/v2/scheduler';
import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { generarTexto } from './core';
import { GROQ_API_KEY, GEMINI_API_KEY } from './gateway';
import { cajaDeVenta, diaColombia } from './caja';
import { notificarAdmins } from './notificar';
import { crearNotificacionIA } from './notificacionesIA';
import { exigirAdmin, money } from './util';

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// ───────────────────────────────────────────────────────────────
// Calendario comercial de Colombia
// ───────────────────────────────────────────────────────────────

export interface EventoComercial {
  clave: string;
  nombre: string;
  /** AAAA-MM-DD */
  ymd: string;
  tipo: 'comercial' | 'festivo';
  impacto: 'alto' | 'medio' | 'bajo';
  /** Semanas de anticipación recomendadas para preparar inventario. */
  semanasPreparacion: number;
  nota?: string;
}

const p2 = (n: number) => String(n).padStart(2, '0');
const ymdDe = (y: number, m: number, d: number) => {
  const f = new Date(Date.UTC(y, m, d));
  return `${f.getUTCFullYear()}-${p2(f.getUTCMonth() + 1)}-${p2(f.getUTCDate())}`;
};
const diaSemanaDe = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).getUTCDay();

/** n-ésimo día de la semana (0=domingo) de un mes. n=-1 para el último. */
function nEsimoDia(y: number, m: number, dow: number, n: number): number {
  if (n > 0) {
    const primero = diaSemanaDe(y, m, 1);
    return 1 + ((dow - primero + 7) % 7) + (n - 1) * 7;
  }
  const ultimo = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const dUlt = diaSemanaDe(y, m, ultimo);
  return ultimo - ((dUlt - dow + 7) % 7);
}

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher). */
function pascua(y: number): { m: number; d: number } {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3=marzo, 4=abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return { m: mes - 1, d: dia };
}

/** Ley Emiliani: el festivo se traslada al lunes siguiente si no cae en lunes. */
function aLunes(y: number, m: number, d: number): string {
  const dow = diaSemanaDe(y, m, d);
  const extra = dow === 1 ? 0 : (8 - dow) % 7;
  return ymdDe(y, m, d + extra);
}

export function eventosDelAnio(y: number): EventoComercial[] {
  const P = pascua(y);
  const desdePascua = (dias: number) => ymdDe(y, P.m, P.d + dias);
  const lunesDesdePascua = (dias: number) => {
    const f = new Date(Date.UTC(y, P.m, P.d + dias));
    return aLunes(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate());
  };

  const eventos: EventoComercial[] = [
    // ── Comerciales ──
    { clave: 'regreso-clases-a', nombre: 'Regreso a clases (calendario A)', ymd: ymdDe(y, 0, nEsimoDia(y, 0, 1, 4)), tipo: 'comercial', impacto: 'alto', semanasPreparacion: 4, nota: 'Fecha aproximada; el zapato escolar y deportivo se mueve desde semanas antes.' },
    { clave: 'san-valentin', nombre: 'San Valentín', ymd: ymdDe(y, 1, 14), tipo: 'comercial', impacto: 'medio', semanasPreparacion: 2 },
    { clave: 'dia-mujer', nombre: 'Día de la Mujer', ymd: ymdDe(y, 2, 8), tipo: 'comercial', impacto: 'bajo', semanasPreparacion: 2 },
    { clave: 'dia-madre', nombre: 'Día de la Madre', ymd: ymdDe(y, 4, nEsimoDia(y, 4, 0, 2)), tipo: 'comercial', impacto: 'alto', semanasPreparacion: 4, nota: 'Segundo domingo de mayo.' },
    { clave: 'prima-junio', nombre: 'Prima de mitad de año', ymd: ymdDe(y, 5, 20), tipo: 'comercial', impacto: 'alto', semanasPreparacion: 3, nota: 'Se paga hasta el 30 de junio; la gente gasta desde mediados de mes.' },
    { clave: 'dia-padre', nombre: 'Día del Padre', ymd: ymdDe(y, 5, nEsimoDia(y, 5, 0, 3)), tipo: 'comercial', impacto: 'alto', semanasPreparacion: 3, nota: 'Tercer domingo de junio.' },
    { clave: 'amor-amistad', nombre: 'Amor y Amistad', ymd: ymdDe(y, 8, nEsimoDia(y, 8, 6, 3)), tipo: 'comercial', impacto: 'alto', semanasPreparacion: 3, nota: 'Tercer sábado de septiembre.' },
    { clave: 'halloween', nombre: 'Halloween', ymd: ymdDe(y, 9, 31), tipo: 'comercial', impacto: 'bajo', semanasPreparacion: 2 },
    { clave: 'black-friday', nombre: 'Black Friday', ymd: ymdDe(y, 10, nEsimoDia(y, 10, 5, 4)), tipo: 'comercial', impacto: 'alto', semanasPreparacion: 4, nota: 'Cuarto viernes de noviembre.' },
    { clave: 'cyber-lunes', nombre: 'Cyber Lunes', ymd: ymdDe(y, 10, nEsimoDia(y, 10, 5, 4) + 3), tipo: 'comercial', impacto: 'medio', semanasPreparacion: 3 },
    { clave: 'prima-diciembre', nombre: 'Prima de diciembre', ymd: ymdDe(y, 11, 20), tipo: 'comercial', impacto: 'alto', semanasPreparacion: 4, nota: 'Se paga hasta el 20 de diciembre.' },
    { clave: 'novena', nombre: 'Inicio de la novena', ymd: ymdDe(y, 11, 16), tipo: 'comercial', impacto: 'medio', semanasPreparacion: 3 },
    { clave: 'navidad', nombre: 'Navidad', ymd: ymdDe(y, 11, 24), tipo: 'comercial', impacto: 'alto', semanasPreparacion: 5, nota: 'Las compras de regalo se concentran en los días previos.' },
    { clave: 'fin-anio', nombre: 'Fin de año', ymd: ymdDe(y, 11, 31), tipo: 'comercial', impacto: 'medio', semanasPreparacion: 3, nota: 'Estrenar zapatos para el 31 mueve calzado de vestir y deportivo.' },

    // ── Festivos (puentes de más tráfico en el centro comercial) ──
    { clave: 'festivo-reyes', nombre: 'Festivo de Reyes Magos', ymd: aLunes(y, 0, 6), tipo: 'festivo', impacto: 'medio', semanasPreparacion: 1 },
    { clave: 'festivo-san-jose', nombre: 'Festivo de San José', ymd: aLunes(y, 2, 19), tipo: 'festivo', impacto: 'medio', semanasPreparacion: 1 },
    { clave: 'jueves-santo', nombre: 'Jueves Santo', ymd: desdePascua(-3), tipo: 'festivo', impacto: 'medio', semanasPreparacion: 1 },
    { clave: 'viernes-santo', nombre: 'Viernes Santo', ymd: desdePascua(-2), tipo: 'festivo', impacto: 'medio', semanasPreparacion: 1 },
    { clave: 'dia-trabajo', nombre: 'Día del Trabajo', ymd: ymdDe(y, 4, 1), tipo: 'festivo', impacto: 'medio', semanasPreparacion: 1 },
    { clave: 'festivo-ascension', nombre: 'Festivo de la Ascensión', ymd: lunesDesdePascua(39), tipo: 'festivo', impacto: 'medio', semanasPreparacion: 1 },
    { clave: 'festivo-corpus', nombre: 'Festivo de Corpus Christi', ymd: lunesDesdePascua(60), tipo: 'festivo', impacto: 'medio', semanasPreparacion: 1 },
    { clave: 'festivo-sagrado-corazon', nombre: 'Festivo del Sagrado Corazón', ymd: lunesDesdePascua(68), tipo: 'festivo', impacto: 'medio', semanasPreparacion: 1 },
    { clave: 'festivo-san-pedro', nombre: 'Festivo de San Pedro y San Pablo', ymd: aLunes(y, 5, 29), tipo: 'festivo', impacto: 'medio', semanasPreparacion: 1 },
    { clave: 'festivo-independencia', nombre: 'Día de la Independencia', ymd: ymdDe(y, 6, 20), tipo: 'festivo', impacto: 'medio', semanasPreparacion: 1 },
    { clave: 'festivo-boyaca', nombre: 'Batalla de Boyacá', ymd: ymdDe(y, 7, 7), tipo: 'festivo', impacto: 'medio', semanasPreparacion: 1 },
    { clave: 'festivo-asuncion', nombre: 'Festivo de la Asunción', ymd: aLunes(y, 7, 15), tipo: 'festivo', impacto: 'medio', semanasPreparacion: 1 },
    { clave: 'festivo-raza', nombre: 'Festivo del Día de la Raza', ymd: aLunes(y, 9, 12), tipo: 'festivo', impacto: 'medio', semanasPreparacion: 1 },
    { clave: 'festivo-santos', nombre: 'Festivo de Todos los Santos', ymd: aLunes(y, 10, 1), tipo: 'festivo', impacto: 'medio', semanasPreparacion: 1 },
    { clave: 'festivo-cartagena', nombre: 'Independencia de Cartagena', ymd: aLunes(y, 10, 11), tipo: 'festivo', impacto: 'medio', semanasPreparacion: 1 },
    { clave: 'festivo-inmaculada', nombre: 'Inmaculada Concepción', ymd: ymdDe(y, 11, 8), tipo: 'festivo', impacto: 'medio', semanasPreparacion: 1 },
  ];
  return eventos.sort((a, b) => a.ymd.localeCompare(b.ymd));
}

function diasEntre(desdeYmd: string, hastaYmd: string): number {
  const a = Date.parse(desdeYmd + 'T00:00:00Z');
  const b = Date.parse(hastaYmd + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

export function proximosEventos(hoyYmd: string, dias: number): (EventoComercial & { diasFaltan: number })[] {
  const y = Number(hoyYmd.slice(0, 4));
  return [...eventosDelAnio(y), ...eventosDelAnio(y + 1)]
    .map((e) => ({ ...e, diasFaltan: diasEntre(hoyYmd, e.ymd) }))
    .filter((e) => e.diasFaltan >= 0 && e.diasFaltan <= dias)
    .sort((a, b) => a.diasFaltan - b.diasFaltan);
}

// ───────────────────────────────────────────────────────────────
// Qué pasó estas mismas fechas el año pasado
// ───────────────────────────────────────────────────────────────

const sumarDias = (ymd: string, n: number) => {
  const d = new Date(Date.parse(ymd + 'T00:00:00Z'));
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
};

async function ventasEntre(desdeYmd: string, hastaYmd: string): Promise<any[]> {
  const ini = diaColombia(0, new Date(Date.parse(desdeYmd + 'T17:00:00Z'))).inicio;
  const fin = diaColombia(0, new Date(Date.parse(hastaYmd + 'T17:00:00Z'))).fin;
  const snap = await db
    .collection('ventas')
    .where('fechaVenta', '>=', admin.firestore.Timestamp.fromDate(ini))
    .where('fechaVenta', '<=', admin.firestore.Timestamp.fromDate(fin))
    .select('zapatoId', 'marca', 'referencia', 'tipoVenta', 'precio', 'precioMetodoPrincipal', 'metodoPago', 'segundoMetodo', 'esMismoDia', 'excedente', 'metodoExcedente', 'DevueltoBono', 'precioAntesDeCambio', 'productoDevueltoId')
    .get();
  return snap.docs.map((d) => d.data());
}

export interface AnalisisEvento {
  evento: EventoComercial & { diasFaltan: number };
  anioAnterior: {
    ventana: { desde: string; hasta: string };
    pares: number;
    ventasTotal: number;
    paresPorDia: number;
    paresPorDiaNormal: number;
    variacionPorcentual: number | null;
    sinHistorial: boolean;
  };
  referenciasEstrella: {
    codigo: number | string;
    producto: string;
    paresAnioAnterior: number;
    stockActual: number | null;
    riesgoDeAgotarse: boolean;
  }[];
  recomendaciones: string[];
}

export async function analizarEvento(
  ev: EventoComercial & { diasFaltan: number },
): Promise<AnalisisEvento> {
  const anio = Number(ev.ymd.slice(0, 4));
  const previo = eventosDelAnio(anio - 1).find((e) => e.clave === ev.clave);
  const base: AnalisisEvento = {
    evento: ev,
    anioAnterior: {
      ventana: { desde: '', hasta: '' },
      pares: 0,
      ventasTotal: 0,
      paresPorDia: 0,
      paresPorDiaNormal: 0,
      variacionPorcentual: null,
      sinHistorial: true,
    },
    referenciasEstrella: [],
    recomendaciones: [],
  };
  if (!previo) return base;

  // Ventana de la semana previa al evento (cuando se concentra la compra) y su "normal" anterior
  const desde = sumarDias(previo.ymd, -7);
  const hasta = sumarDias(previo.ymd, 0);
  const normalDesde = sumarDias(desde, -28);
  const normalHasta = sumarDias(desde, -1);
  const [ventana, normal] = await Promise.all([ventasEntre(desde, hasta), ventasEntre(normalDesde, normalHasta)]);

  const unidades = (vs: any[]) => vs.reduce((a, v) => a + cajaDeVenta(v).unidades, 0);
  const dinero = (vs: any[]) =>
    vs.reduce((a, v) => {
      const c = cajaDeVenta(v);
      return a + c.efectivo + c.transferencia + c.sistecredito + c.addi + c.bold;
    }, 0);

  const pares = unidades(ventana);
  const paresNormal = unidades(normal);
  const porDia = pares / 8;
  const porDiaNormal = paresNormal / 28;
  const variacion = porDiaNormal > 0 ? Math.round(((porDia - porDiaNormal) / porDiaNormal) * 100) : null;

  base.anioAnterior = {
    ventana: { desde, hasta },
    pares,
    ventasTotal: dinero(ventana),
    paresPorDia: Math.round(porDia * 10) / 10,
    paresPorDiaNormal: Math.round(porDiaNormal * 10) / 10,
    variacionPorcentual: variacion,
    sinHistorial: pares + paresNormal === 0,
  };

  // Referencias más vendidas esa semana y cuánto stock tienen hoy
  const porRef = new Map<string, { codigo: any; producto: string; pares: number }>();
  for (const v of ventana) {
    if (cajaDeVenta(v).unidades !== 1) continue;
    const k = String(v['zapatoId']);
    const nombre = [v['marca'], v['referencia']].filter(Boolean).join(' ') || `Código ${k}`;
    const x = porRef.get(k) ?? { codigo: v['zapatoId'], producto: nombre, pares: 0 };
    x.pares++;
    porRef.set(k, x);
  }
  const top = [...porRef.values()].sort((a, b) => b.pares - a.pares).slice(0, 6);
  for (const t of top) {
    let stock: number | null = null;
    try {
      const prod = await db.doc(`productos/${String(t.codigo)}`).get();
      if (prod.exists) stock = Number(prod.data()?.['stock'] ?? 0);
    } catch {
      /* sin dato de stock */
    }
    base.referenciasEstrella.push({
      codigo: t.codigo,
      producto: t.producto,
      paresAnioAnterior: t.pares,
      stockActual: stock,
      riesgoDeAgotarse: stock !== null && stock < t.pares,
    });
  }

  // Recomendaciones exactas
  const r = base.recomendaciones;
  if (base.anioAnterior.sinHistorial) {
    r.push('No hay ventas registradas en esas fechas del año pasado, así que no hay una referencia propia para comparar.');
  } else {
    if (variacion !== null && variacion >= 15) {
      r.push(`El año pasado la semana previa vendió ${variacion}% más por día que lo normal: prepara inventario con tiempo.`);
    } else if (variacion !== null && variacion <= -15) {
      r.push(`El año pasado esa semana vendió ${Math.abs(variacion)}% menos por día que lo normal: no inviertas de más en inventario para esta fecha.`);
    } else if (variacion !== null) {
      r.push('El año pasado esa semana se vendió parecido a una semana normal.');
    }
    const riesgo = base.referenciasEstrella.filter((x) => x.riesgoDeAgotarse);
    if (riesgo.length) {
      r.push(`${riesgo.length} de las referencias más vendidas esa semana hoy tienen menos pares que los que vendiste entonces: ${riesgo.map((x) => `${x.producto} (hoy ${x.stockActual}, vendiste ${x.paresAnioAnterior})`).join('; ')}.`);
    }
  }
  r.push(`Empieza a preparar con ${ev.semanasPreparacion} semana${ev.semanasPreparacion === 1 ? '' : 's'} de anticipación${ev.diasFaltan <= ev.semanasPreparacion * 7 ? ' (ya estás dentro de ese plazo)' : ''}.`);
  return base;
}

/** Para el chat y la app: próximos eventos con su análisis. */
export const consultarCalendario = onCall(
  { region: 'us-central1', timeoutSeconds: 180, memory: '512MiB' },
  async (request) => {
    await exigirAdmin(request);
    const dias = Math.min(Math.max(Number(request.data?.dias) || 60, 7), 180);
    const hoy = diaColombia(0).ymd;
    const eventos = proximosEventos(hoy, dias);

    const comerciales = eventos.filter((e) => e.tipo === 'comercial' && e.impacto !== 'bajo').slice(0, 4);
    const analisis = [];
    for (const e of comerciales) analisis.push(await analizarEvento(e));

    return {
      hoy,
      proximosEventos: eventos.map((e) => ({ nombre: e.nombre, fecha: e.ymd, diasFaltan: e.diasFaltan, tipo: e.tipo, impacto: e.impacto, nota: e.nota ?? null })),
      analisisDetallado: analisis,
    };
  },
);

/** Texto corto sobre el próximo evento, para el resumen de la mañana. */
export async function resumenProximoEvento(): Promise<string | null> {
  const hoy = diaColombia(0).ymd;
  const e = proximosEventos(hoy, 28).find((x) => x.tipo === 'comercial' && x.impacto !== 'bajo');
  if (!e) return null;
  const a = await analizarEvento(e);
  const partes = [`${e.nombre} es en ${e.diasFaltan} día${e.diasFaltan === 1 ? '' : 's'}.`];
  if (!a.anioAnterior.sinHistorial && a.anioAnterior.variacionPorcentual !== null) {
    partes.push(`El año pasado esa semana se vendió ${a.anioAnterior.variacionPorcentual >= 0 ? '+' : ''}${a.anioAnterior.variacionPorcentual}% por día frente a lo normal.`);
  }
  const riesgo = a.referenciasEstrella.filter((x) => x.riesgoDeAgotarse);
  if (riesgo.length) partes.push(`${riesgo.length} referencias estrella podrían agotarse.`);
  return partes.join(' ');
}

/** Cada lunes avisa los eventos que ya entraron en su ventana de preparación. */
export const avisoCalendarioComercial = scheduler.onSchedule(
  {
    schedule: '0 8 * * 1',
    timeZone: 'America/Bogota',
    secrets: [GROQ_API_KEY, GEMINI_API_KEY],
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async () => {
    const hoy = diaColombia(0).ymd;
    const candidatos = proximosEventos(hoy, 40).filter(
      (e) => e.tipo === 'comercial' && e.impacto !== 'bajo' && e.diasFaltan <= e.semanasPreparacion * 7 + 7,
    );

    for (const e of candidatos) {
      const etapa = e.diasFaltan <= 7 ? 'ultima-semana' : 'preparacion';
      const ref = db.doc(`calendarioAvisos/${e.clave}_${e.ymd}_${etapa}`);
      if ((await ref.get()).exists) continue;

      const a = await analizarEvento(e);
      let texto = `${e.nombre} es en ${e.diasFaltan} días (${e.ymd}).\n${a.recomendaciones.join('\n')}`;
      try {
        const redactado = await generarTexto(
          'rapido',
          `Eres el asesor comercial de ShoeShop, una tienda de calzado en un centro comercial de Colombia.
Redacta un aviso corto para el dueño sobre una fecha comercial que se acerca.
REGLAS: usa SOLO los datos entregados, no inventes cifras. Máximo 6 líneas, texto plano. Incluye qué referencias reponer primero y UNA acción para esta semana.`,
          JSON.stringify(a),
          { groq: GROQ_API_KEY.value(), gemini: GEMINI_API_KEY.value() },
          { temperature: 0.3, max_tokens: 500 },
        );
        if (redactado.trim()) texto = redactado.trim();
      } catch (err) {
        console.warn('[calendario] IA no disponible, se usa el texto base', err);
      }

      await ref.set({ clave: e.clave, evento: e.nombre, fecha: e.ymd, etapa, texto, analisis: a, creado: admin.firestore.FieldValue.serverTimestamp() });
      await crearNotificacionIA({
        id: `calendario_${e.clave}_${e.ymd}_${etapa}`,
        tipo: 'calendario',
        severidad: etapa === 'ultima-semana' ? 'alta' : 'info',
        titulo: `${e.nombre} en ${e.diasFaltan} días`,
        descripcion: texto,
        ruta: '/admin/ia',
        params: { evento: e.clave },
      });
      await notificarAdmins(
        `📅 ${e.nombre} en ${e.diasFaltan} días`,
        a.anioAnterior.sinHistorial
          ? 'Revisa el inventario para esta fecha. Abre el chat para ver el análisis.'
          : `El año pasado esa semana: ${a.anioAnterior.pares} pares${a.anioAnterior.variacionPorcentual !== null ? ` (${a.anioAnterior.variacionPorcentual >= 0 ? '+' : ''}${a.anioAnterior.variacionPorcentual}% vs lo normal)` : ''}.`,
        { tipo: 'calendario', evento: e.clave },
      );
      console.log(`[calendario] avisado ${e.nombre} (${etapa}) con ${money(a.anioAnterior.ventasTotal)} del año pasado`);
    }
  },
);
