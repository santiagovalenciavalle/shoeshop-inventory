import * as scheduler from 'firebase-functions/v2/scheduler';
import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { calcularCajaPorVendedor, diaColombia } from './caja';
import { notificarAdmins } from './notificar';
import { crearNotificacionIA } from './notificacionesIA';
import { claveVendedor, exigirAdmin, money } from './util';

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

export interface CuadrePendiente {
  fecha: string;
  vendedor: string;
  efectivo: number;
}

/**
 * Vendedores que tuvieron efectivo en los últimos `dias` días (hoy incluido)
 * y todavía no tienen un cuadre de caja guardado que cubra ese día.
 */
export async function calcularCuadresPendientes(dias = 3): Promise<CuadrePendiente[]> {
  const rangos = Array.from({ length: dias }, (_, i) => diaColombia(-i));
  const masAntiguo = rangos[rangos.length - 1];

  // Cuadres guardados que terminan en el rango que nos interesa
  const guardados = await db.collection('cuadresCaja').where('hasta', '>=', masAntiguo.ymd).get();
  const cuadres = guardados.docs.map((d) => ({
    clave: String(d.data()['clave'] ?? ''),
    desde: String(d.data()['desde'] ?? ''),
    hasta: String(d.data()['hasta'] ?? ''),
  }));

  const pendientes: CuadrePendiente[] = [];
  for (const dia of rangos) {
    const snap = await db
      .collection('ventas')
      .where('fechaVenta', '>=', admin.firestore.Timestamp.fromDate(dia.inicio))
      .where('fechaVenta', '<=', admin.firestore.Timestamp.fromDate(dia.fin))
      .get();
    const caja = calcularCajaPorVendedor(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

    for (const c of caja) {
      if (!(c.efectivo > 0)) continue;
      const clave = claveVendedor(c.vendedorId || c.vendedor);
      const cubierto = cuadres.some((q) => q.clave === clave && q.desde <= dia.ymd && q.hasta >= dia.ymd);
      if (!cubierto) pendientes.push({ fecha: dia.ymd, vendedor: c.vendedor, efectivo: c.efectivo });
    }
  }
  return pendientes;
}

/** Todos los días a las 9:00 p. m. avisa qué vendedores siguen sin cuadre de caja. */
export const avisoCuadrePendiente = scheduler.onSchedule(
  { schedule: '0 21 * * *', timeZone: 'America/Bogota', timeoutSeconds: 180, memory: '256MiB' },
  async () => {
    const pendientes = await calcularCuadresPendientes(3);
    if (!pendientes.length) {
      console.log('[cuadre] Todos los cuadres al día.');
      return;
    }

    const hoy = diaColombia(0).ymd;
    const total = pendientes.reduce((a, p) => a + p.efectivo, 0);
    const lineas = pendientes
      .slice(0, 6)
      .map((p) => `${p.vendedor} (${p.fecha === hoy ? 'hoy' : p.fecha}) ${money(p.efectivo)}`)
      .join(' · ');
    const resto = pendientes.length > 6 ? ` y ${pendientes.length - 6} más` : '';

    await crearNotificacionIA({
      id: `cuadre-pendiente_${hoy}`,
      tipo: 'cuadre-pendiente',
      severidad: 'media',
      titulo: `${pendientes.length} cuadre${pendientes.length === 1 ? '' : 's'} de caja pendiente${pendientes.length === 1 ? '' : 's'}`,
      descripcion: `${lineas}${resto}. Efectivo por recoger: ${money(total)}.`,
      ruta: '/admin/cuadre-caja',
    });
    await notificarAdmins(
      `💵 ${pendientes.length} cuadre${pendientes.length === 1 ? '' : 's'} de caja pendiente${pendientes.length === 1 ? '' : 's'}`,
      `${lineas}${resto}. Efectivo por recoger: ${money(total)}.`,
      { tipo: 'cuadre-pendiente' },
    );
  },
);

/** Para consultarlo desde la app o el chat. */
export const consultarCuadresPendientes = onCall(
  { region: 'us-central1', timeoutSeconds: 120, memory: '256MiB' },
  async (request) => {
    await exigirAdmin(request);
    const dias = Math.min(Math.max(Number(request.data?.dias) || 3, 1), 10);
    const pendientes = await calcularCuadresPendientes(dias);
    return {
      dias,
      total: pendientes.length,
      efectivoPorRecoger: pendientes.reduce((a, p) => a + p.efectivo, 0),
      pendientes,
    };
  },
);
