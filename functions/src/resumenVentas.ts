import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

function calcularValorVenta(venta: any): number {
  if (!venta) return 0;
  const tipo = venta.tipoVenta;
  if (tipo === 'Devuelto por cambio' || tipo === 'Devuelto por bono') return 0;
  if (tipo === 'Cambio' && !venta.esMismoDia)
    return Number(venta.excedente || 0);
  return Number(venta.precio || 0);
}

function obtenerFecha(venta: any): Date | null {
  const f = venta?.fechaVenta;
  if (!f) return null;
  return f.toDate ? f.toDate() : new Date(f);
}

function esVentaValidaRanking(v: any): boolean {
  const tipo: string = (v?.tipoVenta ?? '').toLowerCase().trim();
  if (tipo === 'devuelto por bono') return false;
  if (tipo === 'devuelto por cambio') return false;
  return true;
}

async function aplicarDelta(
  anio: number,
  mes: number,
  deltaMonto: number,
  deltaCantidad: number,
): Promise<void> {
  if (deltaMonto === 0 && deltaCantidad === 0) return;
  const ref = db.collection('resumenesVentas').doc(String(anio));
  await ref.set(
    {
      meses: {
        [mes]: {
          total: admin.firestore.FieldValue.increment(deltaMonto),
          cantidad: admin.firestore.FieldValue.increment(deltaCantidad),
        },
      },
    },
    { merge: true },
  );
}

async function aplicarDeltaProducto(
  zapatoId: number,
  delta: {
    totalVentas: number;
    ingresoTotal: number;
    ventasPrecioBajo: number;
    vendedor?: string;
    local?: string;
    marca?: string;
    referencia?: string;
    talla?: string;
  },
): Promise<void> {
  if (!zapatoId) return;
  const ref = db.collection('resumenPorProducto').doc(String(zapatoId));
  const update: any = {
    totalVentas: admin.firestore.FieldValue.increment(delta.totalVentas),
    ingresoTotal: admin.firestore.FieldValue.increment(delta.ingresoTotal),
    ventasPrecioBajo: admin.firestore.FieldValue.increment(
      delta.ventasPrecioBajo,
    ),
  };
  if (delta.vendedor) {
    update.vendedores = admin.firestore.FieldValue.arrayUnion(delta.vendedor);
  }
  if (delta.local) {
    update.locales = admin.firestore.FieldValue.arrayUnion(delta.local);
  }

  if (delta.marca) update.marca = delta.marca;
  if (delta.referencia) update.referencia = delta.referencia;
  if (delta.talla) update.talla = delta.talla;

  await ref.set(update, { merge: true });
}

export const actualizarResumenVentas = onDocumentWritten(
  'ventas/{ventaId}',
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : null;
    const after = event.data?.after.exists ? event.data.after.data() : null;

    // Venta movida al archivo histórico: el borrado NO debe restar de los resúmenes.
    if (before && !after && before['_archivada'] === true) return;

    const montoBefore = before ? calcularValorVenta(before) : 0;
    const montoAfter = after ? calcularValorVenta(after) : 0;

    const fechaAntes = before ? obtenerFecha(before) : null;
    const fechaDespues = after ? obtenerFecha(after) : null;

    const claveAntes = fechaAntes
      ? { anio: fechaAntes.getFullYear(), mes: fechaAntes.getMonth() }
      : null;
    const claveDespues = fechaDespues
      ? { anio: fechaDespues.getFullYear(), mes: fechaDespues.getMonth() }
      : null;

    const mismoMes =
      claveAntes &&
      claveDespues &&
      claveAntes.anio === claveDespues.anio &&
      claveAntes.mes === claveDespues.mes;

    if (mismoMes) {
      await aplicarDelta(
        claveDespues!.anio,
        claveDespues!.mes,
        montoAfter - montoBefore,
        0,
      );
    } else {
      if (claveAntes) {
        await aplicarDelta(claveAntes.anio, claveAntes.mes, -montoBefore, -1);
      }
      if (claveDespues) {
        await aplicarDelta(claveDespues.anio, claveDespues.mes, montoAfter, 1);
      }
    }

    const zapatoIdAntes = before ? Number(before['zapatoId']) : null;
    const zapatoIdDespues = after ? Number(after['zapatoId']) : null;

    if (zapatoIdAntes && before && esVentaValidaRanking(before)) {
      await aplicarDeltaProducto(zapatoIdAntes, {
        totalVentas: -1,
        ingresoTotal: -Number(before['precio'] || 0),
        ventasPrecioBajo: before['precioBajo'] === true ? -1 : 0,
      });
    }

    if (zapatoIdDespues && after && esVentaValidaRanking(after)) {
      await aplicarDeltaProducto(zapatoIdDespues, {
        totalVentas: 1,
        ingresoTotal: Number(after['precio'] || 0),
        ventasPrecioBajo: after['precioBajo'] === true ? 1 : 0,
        vendedor: after['vendedor'],
        local: after['local'],
        marca: after['marca'],
        referencia: after['referencia'],
        talla: after['talla'],
      });
    }
  },
);
