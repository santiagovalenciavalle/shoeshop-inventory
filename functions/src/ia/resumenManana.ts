import * as scheduler from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { createTransport } from 'nodemailer';
import { generarTexto, Llaves } from './core';
import { GROQ_API_KEY, GEMINI_API_KEY } from './gateway';
import { calcularCajaPorVendedor, cajaDeVenta, diaColombia } from './caja';
import { notificarAdmins } from './notificar';
import { resumenProximoEvento } from './calendario';

const GMAIL_USER = defineSecret('GMAIL_USER');
const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD');

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

const money = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

async function ventasDelDia(inicio: Date, fin: Date): Promise<any[]> {
  const snap = await db
    .collection('ventas')
    .where('fechaVenta', '>=', admin.firestore.Timestamp.fromDate(inicio))
    .where('fechaVenta', '<=', admin.firestore.Timestamp.fromDate(fin))
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function totales(ventas: any[]) {
  const caja = calcularCajaPorVendedor(ventas);
  return {
    caja,
    efectivo: caja.reduce((a, c) => a + c.efectivo, 0),
    total: caja.reduce((a, c) => a + c.total, 0),
    unidades: caja.reduce((a, c) => a + c.unidades, 0),
  };
}

/** Reúne TODOS los datos del resumen con cálculos exactos (sin IA). */
export async function construirDatosManana() {
  const ayer = diaColombia(-1);
  const hoy = diaColombia(0);

  const ventasAyer = await ventasDelDia(ayer.inicio, ayer.fin);
  const t = totales(ventasAyer);

  // Promedio del mismo día de la semana en las últimas 4 semanas
  const previos = await Promise.all(
    [1, 2, 3, 4].map(async (k) => {
      const d = diaColombia(-1 - 7 * k);
      return totales(await ventasDelDia(d.inicio, d.fin));
    }),
  );
  const conDatos = previos.filter((p) => p.total > 0);
  const promedioTotal = conDatos.length ? conDatos.reduce((a, p) => a + p.total, 0) / conDatos.length : 0;
  const promedioPares = conDatos.length ? conDatos.reduce((a, p) => a + p.unidades, 0) / conDatos.length : 0;
  const variacion = promedioTotal > 0 ? Math.round(((t.total - promedioTotal) / promedioTotal) * 100) : null;

  // Referencias más vendidas
  const conteo = new Map<string, number>();
  for (const v of ventasAyer) {
    if (cajaDeVenta(v).unidades !== 1) continue;
    const nombre = [v['marca'], v['referencia']].filter(Boolean).join(' ') || 'Sin nombre';
    conteo.set(nombre, (conteo.get(nombre) ?? 0) + 1);
  }
  const topReferencias = [...conteo.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([nombre, pares]) => ({ nombre, pares }));

  // Préstamos
  let prestamosActivos = 0;
  let prestamosCriticos = 0;
  try {
    const snap = await db.collection('prestamos').get();
    prestamosActivos = snap.size;
    snap.forEach((d) => {
      const seg = d.data()['fechaPrestamo']?.seconds;
      if (seg && (hoy.inicio.getTime() - seg * 1000) / 86400000 > 7) prestamosCriticos++;
    });
  } catch (e) {
    console.warn('[resumen] préstamos', e);
  }

  // Cuadres de caja de ayer
  let vendedoresSinCuadre: string[] = [];
  try {
    const cuadres = await db.collection('cuadresCaja').where('hasta', '==', ayer.ymd).get();
    const hechos = new Set(cuadres.docs.map((d) => String(d.data()['vendedor']).toLowerCase()));
    vendedoresSinCuadre = t.caja
      .filter((c) => c.efectivo > 0 && !hechos.has(c.vendedor.toLowerCase()))
      .map((c) => c.vendedor);
  } catch (e) {
    console.warn('[resumen] cuadres', e);
  }

  // Alertas detectadas desde ayer
  let alertas: string[] = [];
  try {
    const snap = await db
      .collection('alertasIA')
      .where('fecha', '>=', admin.firestore.Timestamp.fromDate(ayer.inicio))
      .get();
    alertas = snap.docs.map((d) => String(d.data()['titulo'])).slice(0, 8);
  } catch (e) {
    console.warn('[resumen] alertas', e);
  }

  let proximoEvento: string | null = null;
  try {
    proximoEvento = await resumenProximoEvento();
  } catch (e) {
    console.warn('[resumen] calendario', e);
  }

  const diaNombre = DIAS[ayer.diaSemana];
  return {
    fechaAyer: ayer.ymd,
    diaSemanaAyer: diaNombre,
    ayer: {
      ventasTotal: t.total,
      efectivo: t.efectivo,
      pares: t.unidades,
      ventasPrecioBajo: ventasAyer.filter((v) => v['precioBajo']).length,
      porVendedor: t.caja.map((c) => ({
        vendedor: c.vendedor,
        pares: c.unidades,
        efectivo: c.efectivo,
        total: c.total,
      })),
    },
    comparacion: {
      promedioMismoDia: Math.round(promedioTotal),
      promedioParesMismoDia: Math.round(promedioPares * 10) / 10,
      variacionPorcentual: variacion,
      semanasComparadas: conDatos.length,
    },
    topReferencias,
    proximaFechaComercial: proximoEvento,
    pendientes: {
      vendedoresSinCuadreDeCaja: vendedoresSinCuadre,
      prestamosActivos,
      prestamosCriticosMasDe7Dias: prestamosCriticos,
      alertasDetectadas: alertas,
    },
  };
}

type DatosManana = Awaited<ReturnType<typeof construirDatosManana>>;

/** Texto exacto, sin IA. Sirve de respaldo si los modelos no responden. */
function textoBase(d: DatosManana): string {
  const c = d.comparacion;
  const cmp =
    c.variacionPorcentual === null
      ? ''
      : ` (${c.variacionPorcentual >= 0 ? '+' : ''}${c.variacionPorcentual}% frente al promedio de los ${d.diaSemanaAyer} anteriores)`;
  const lineas = [
    `☀️ Buenos días. Resumen del ${d.diaSemanaAyer} ${d.fechaAyer}:`,
    `• Ventas: ${money(d.ayer.ventasTotal)} · ${d.ayer.pares} pares · efectivo ${money(d.ayer.efectivo)}${cmp}`,
  ];
  if (d.topReferencias.length) {
    lineas.push(`• Más vendidas: ${d.topReferencias.map((r) => `${r.nombre} (${r.pares})`).join(', ')}`);
  }
  const p = d.pendientes;
  if (p.vendedoresSinCuadreDeCaja.length) lineas.push(`⚠️ Sin cuadre de caja: ${p.vendedoresSinCuadreDeCaja.join(', ')}`);
  if (p.prestamosCriticosMasDe7Dias) lineas.push(`⚠️ Préstamos con más de 7 días: ${p.prestamosCriticosMasDe7Dias}`);
  if (p.alertasDetectadas.length) lineas.push(`⚠️ Alertas detectadas: ${p.alertasDetectadas.join('; ')}`);
  if (d.proximaFechaComercial) lineas.push(`📅 ${d.proximaFechaComercial}`);
  if (d.ayer.ventasPrecioBajo) lineas.push(`⚠️ Ventas bajo el precio mínimo: ${d.ayer.ventasPrecioBajo}`);
  return lineas.join('\n');
}

export async function redactarResumen(d: DatosManana, llaves: Llaves): Promise<string> {
  try {
    const texto = await generarTexto(
      'rapido',
      `Eres el asistente del dueño de ShoeShop, una tienda de calzado en Colombia.
Redacta el RESUMEN DE LA MAÑANA a partir de los datos exactos que te doy.

REGLAS:
- Usa SOLO los datos entregados. No inventes ni recalcules cifras; cópialas tal cual.
- Estructura: (1) saludo de una línea con la fecha, (2) "Ayer" en 2 o 3 líneas con ventas, efectivo, pares y la comparación con el promedio de ese día, (3) "Atención" solo si hay cuadres pendientes, préstamos críticos, alertas o ventas bajo el precio mínimo, (4) si hay "proximaFechaComercial", una línea de "Calendario" con ese dato, (5) "Para hoy" con 3 acciones concretas y cortas, numeradas.
- Máximo 14 líneas. Texto plano (sin markdown ni asteriscos). Emojis con moderación.
- Montos con signo $ y puntos de miles. Tono cercano y directo, como un buen gerente.`,
      JSON.stringify(d),
      llaves,
      { temperature: 0.3, max_tokens: 700 },
    );
    return texto.trim() || textoBase(d);
  } catch (e) {
    console.warn('[resumen] IA no disponible, se envía el resumen base', e);
    return textoBase(d);
  }
}

async function emailsAdmins(): Promise<string[]> {
  const snap = await db.collection('usuarios').where('role', '==', 'admin').get();
  return snap.docs.map((d) => String(d.data()['emailReporte'] ?? '')).filter(Boolean);
}

function escapar(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function enviarEmail(texto: string, fecha: string): Promise<number> {
  const destinatarios = await emailsAdmins();
  if (!destinatarios.length) return 0;
  const transporter = createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER.value(), pass: GMAIL_APP_PASSWORD.value() },
  });
  await transporter.sendMail({
    from: `"ShoeShop IA" <${GMAIL_USER.value()}>`,
    to: destinatarios.join(', '),
    subject: `☀️ Resumen de la mañana · ${fecha}`,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#171717;max-width:560px;margin:auto;padding:24px;white-space:pre-wrap">${escapar(texto)}</div>`,
  });
  return destinatarios.length;
}

const SECRETOS = [GROQ_API_KEY, GEMINI_API_KEY, GMAIL_USER, GMAIL_APP_PASSWORD];

/** Todos los días a las 7:30 a. m. (hora de Colombia). */
export const resumenMananaIA = scheduler.onSchedule(
  {
    schedule: '30 7 * * *',
    timeZone: 'America/Bogota',
    secrets: SECRETOS,
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async () => {
    const datos = await construirDatosManana();
    const texto = await redactarResumen(datos, {
      groq: GROQ_API_KEY.value(),
      gemini: GEMINI_API_KEY.value(),
    });

    const fechaHoy = diaColombia(0).ymd;
    await db.doc(`resumenesIA/${fechaHoy}`).set({
      fecha: fechaHoy,
      texto,
      datos,
      creado: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
      const c = datos.comparacion.variacionPorcentual;
      await notificarAdmins(
        '☀️ Resumen de la mañana',
        `Ayer: ${money(datos.ayer.ventasTotal)} y ${datos.ayer.pares} pares${c === null ? '' : ` (${c >= 0 ? '+' : ''}${c}% vs lo habitual)`}.`,
        { tipo: 'resumen-manana', fecha: fechaHoy },
      );
    } catch (e) {
      console.error('[resumen] push', e);
    }
    try {
      await enviarEmail(texto, fechaHoy);
    } catch (e) {
      console.error('[resumen] email', e);
    }
  },
);

/** Permite pedir el resumen a demanda desde la app (solo administradores). */
export const resumenMananaManual = onCall(
  { secrets: SECRETOS, region: 'us-central1', timeoutSeconds: 180, memory: '512MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    const u = await db.doc(`usuarios/${request.auth.uid}`).get();
    if (String(u.data()?.['role'] ?? '').toLowerCase() !== 'admin' || u.data()?.['active']?.value === false) {
      throw new HttpsError('permission-denied', 'Solo los administradores pueden pedir el resumen.');
    }
    const datos = await construirDatosManana();
    const texto = await redactarResumen(datos, {
      groq: GROQ_API_KEY.value(),
      gemini: GEMINI_API_KEY.value(),
    });
    return { texto, datos };
  },
);
