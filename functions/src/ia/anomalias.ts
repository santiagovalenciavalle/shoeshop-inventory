import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { diaColombia } from './caja';
import { notificarAdmins } from './notificar';
import { crearNotificacionIA, DestinoNotificacion } from './notificacionesIA';

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

const money = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

interface Alerta {
  tipo: string;
  severidad: 'alta' | 'media';
  titulo: string;
  descripcion: string;
  destino: DestinoNotificacion;
}

/** Filtros de la pantalla de ventas para llegar directo a la venta o al vendedor señalado. */
function destinoVentas(v: any, extra: Record<string, string> = {}): DestinoNotificacion {
  const params: Record<string, string> = {
    local: v['local'] ? String(v['local']) : 'todos',
    periodo: 'dia',
    fecha: diaColombia(0).ymd,
    ...extra,
  };
  if (v['vendedor']) params['vendedor'] = String(v['vendedor']);
  return { ruta: '/admin/locales', params };
}

function descripcionVenta(v: any): string {
  const prod = [v['marca'], v['referencia']].filter(Boolean).join(' ') || 'producto';
  return `${prod}${v['talla'] ? ' T' + v['talla'] : ''}`;
}

/** Revisa una venta recién creada con reglas exactas y devuelve las alertas que aplican. */
async function evaluarVenta(ventaId: string, v: any): Promise<Alerta[]> {
  const alertas: Alerta[] = [];
  const tipo = String(v['tipoVenta'] ?? '').trim().toLowerCase();
  const vendedor = v['vendedor'] ?? 'Un vendedor';
  const local = v['local'] ? ` (local ${v['local']})` : '';
  const precio = Number(v['precio'] || 0);

  // 1) Venta por debajo del costo (se pierde plata)
  const esVentaDirecta = !['cambio', 'bono', 'otro-local', 'prestamo', 'devuelto por cambio', 'devuelto por bono'].includes(tipo);
  if (esVentaDirecta && precio > 0 && v['zapatoId'] != null) {
    try {
      const prod = await db.doc(`productos/${String(v['zapatoId'])}`).get();
      const costo = Number(prod.data()?.['precioAdquisicion'] || 0);
      if (costo > 0 && precio < costo) {
        alertas.push({
          tipo: 'venta-bajo-costo',
          severidad: 'alta',
          titulo: 'Venta por debajo del costo',
          descripcion: `${vendedor}${local} vendió ${descripcionVenta(v)} por ${money(precio)} y el par costó ${money(costo)}. Se pierden ${money(costo - precio)}.`,
          destino: destinoVentas(v, { codigo: String(v['zapatoId']) }),
        });
      }
    } catch (e) {
      console.warn('[anomalias] no se pudo leer el costo', e);
    }
  }

  // 2) Muchos cambios del mismo vendedor en el día
  if (tipo === 'cambio' && v['vendedorId']) {
    try {
      const hoy = diaColombia(0);
      const snap = await db
        .collection('ventas')
        .where('vendedorId', '==', v['vendedorId'])
        .where('fechaVenta', '>=', admin.firestore.Timestamp.fromDate(hoy.inicio))
        .where('fechaVenta', '<=', admin.firestore.Timestamp.fromDate(hoy.fin))
        .get();
      const cambios = snap.docs.filter((d) => String(d.data()['tipoVenta'] ?? '').trim().toLowerCase() === 'cambio').length;
      if (cambios === 3 || cambios === 5) {
        alertas.push({
          tipo: `cambios-frecuentes-${cambios}`,
          severidad: 'media',
          titulo: 'Varios cambios en el día',
          descripcion: `${vendedor}${local} lleva ${cambios} cambios hoy. Conviene revisar que correspondan a casos reales.`,
          destino: destinoVentas(v),
        });
      }
    } catch (e) {
      console.warn('[anomalias] no se pudo contar cambios', e);
    }
  }

  // 3) Posible venta duplicada: mismo vendedor, mismo par y talla en menos de 3 minutos
  if (esVentaDirecta && v['vendedorId'] && v['zapatoId'] != null && v['talla'] != null) {
    try {
      const fecha: Date | null = v['fechaVenta']?.toDate ? v['fechaVenta'].toDate() : null;
      if (fecha) {
        const desde = new Date(fecha.getTime() - 3 * 60 * 1000);
        const snap = await db
          .collection('ventas')
          .where('vendedorId', '==', v['vendedorId'])
          .where('fechaVenta', '>=', admin.firestore.Timestamp.fromDate(desde))
          .where('fechaVenta', '<=', admin.firestore.Timestamp.fromDate(fecha))
          .get();
        const repetidas = snap.docs.filter((d) => {
          if (d.id === ventaId) return false;
          const o = d.data();
          return String(o['zapatoId']) === String(v['zapatoId']) && String(o['talla']) === String(v['talla']);
        });
        if (repetidas.length) {
          alertas.push({
            tipo: 'posible-duplicada',
            severidad: 'media',
            titulo: 'Posible venta duplicada',
            descripcion: `${vendedor}${local} registró dos veces ${descripcionVenta(v)} en menos de 3 minutos. Verifica que no se haya cobrado doble.`,
            destino: destinoVentas(v, { codigo: String(v['zapatoId']) }),
          });
        }
      }
    } catch (e) {
      console.warn('[anomalias] no se pudo revisar duplicados', e);
    }
  }

  return alertas;
}

/**
 * Cada vez que se registra una venta se revisan reglas de control y, si algo
 * se ve raro, se guarda una alerta y se avisa por notificación a los administradores.
 */
export const revisarVentaNueva = onDocumentCreated(
  { document: 'ventas/{ventaId}', region: 'us-central1', memory: '256MiB' },
  async (event) => {
    const v = event.data?.data();
    if (!v) return;

    const alertas = await evaluarVenta(event.params['ventaId'], v);
    for (const a of alertas) {
      const ref = db.doc(`alertasIA/${a.tipo}_${event.params['ventaId']}`);
      try {
        // create() falla si ya existe: así nunca se avisa dos veces por lo mismo
        await ref.create({
          tipo: a.tipo,
          severidad: a.severidad,
          titulo: a.titulo,
          descripcion: a.descripcion,
          ventaId: event.params['ventaId'],
          vendedor: v['vendedor'] ?? null,
          local: v['local'] ?? null,
          leida: false,
          fecha: admin.firestore.FieldValue.serverTimestamp(),
        });
        await crearNotificacionIA({
          id: `${a.tipo}_${event.params['ventaId']}`,
          tipo: a.tipo,
          severidad: a.severidad,
          titulo: a.titulo,
          descripcion: a.descripcion,
          ...a.destino,
        });
        await notificarAdmins(`⚠️ ${a.titulo}`, a.descripcion, { tipo: a.tipo, ventaId: event.params['ventaId'] });
      } catch (e: any) {
        if (e?.code !== 6 && !String(e?.message ?? '').includes('ALREADY_EXISTS')) {
          console.error('[anomalias] error al guardar/avisar', e);
        }
      }
    }
  },
);
