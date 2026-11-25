import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { exigirAdmin, ventaSacaPar } from './ia/util';

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const { FieldValue, Timestamp } = admin.firestore;

/**
 * ARCHIVADO DEL HISTORIAL
 *
 * Mueve ventas e ingresos antiguos a colecciones de archivo (`archivo_ventas`,
 * `archivo_ingresosProductos`) para que las colecciones de trabajo no crezcan sin límite.
 *
 * Para que nada deje de cuadrar, por cada producto se guardan contadores acumulados en
 * `contadoresArchivo/{zapatoId}` ({ ventas, ingresos }). El análisis de descuadres y el detalle
 * de producto los suman, y los resúmenes de ventas (`resumenesVentas`, `resumenPorProducto`) no
 * cambian porque la función que los mantiene ignora las ventas marcadas como archivadas.
 *
 * SEGURIDAD:
 *  - Por defecto es un SIMULACRO: solo cuenta lo que se movería.
 *  - Para ejecutarlo de verdad hay que enviar { confirmar: 'ARCHIVAR' }.
 *  - Nunca archiva nada con menos de 12 meses.
 *  - Los documentos se COPIAN al archivo en la misma operación atómica que los borra.
 */
const PORCION = 150; // 150 docs → ≤ 450 operaciones por lote (límite 500)

type Coleccion = 'ventas' | 'ingresosProductos';

interface Resumen {
  coleccion: Coleccion;
  encontrados: number;
  archivados: number;
  productosAfectados: number;
  masAntiguo: string | null;
  masReciente: string | null;
  omitidosSinCodigo: number;
}

const aIso = (v: any): string | null => {
  const d = v?.toDate ? v.toDate() : v ? new Date(v) : null;
  return d && !isNaN(d.getTime()) ? d.toISOString() : null;
};

async function archivar(coleccion: Coleccion, corte: Date, maximo: number, ejecutar: boolean): Promise<Resumen> {
  const campoFecha = coleccion === 'ventas' ? 'fechaVenta' : 'fecha';
  const destino = coleccion === 'ventas' ? 'archivo_ventas' : 'archivo_ingresosProductos';
  const snap = await db
    .collection(coleccion)
    .where(campoFecha, '<', Timestamp.fromDate(corte))
    .orderBy(campoFecha, 'asc')
    .limit(maximo)
    .get();

  const docs = snap.docs.filter((d) => Number.isFinite(Number(d.data()['zapatoId'])));
  const productos = new Set<number>();
  docs.forEach((d) => productos.add(Number(d.data()['zapatoId'])));

  const resumen: Resumen = {
    coleccion,
    encontrados: snap.size,
    archivados: 0,
    productosAfectados: productos.size,
    masAntiguo: aIso(snap.docs[0]?.data()[campoFecha]),
    masReciente: aIso(snap.docs[snap.docs.length - 1]?.data()[campoFecha]),
    omitidosSinCodigo: snap.size - docs.length, // sin código numérico no se puede llevar la cuenta: se dejan
  };
  if (!ejecutar) return resumen;

  for (let i = 0; i < docs.length; i += PORCION) {
    const trozo = docs.slice(i, i + PORCION);

    // Ventas: primero se marcan, para que el resumen de ventas ignore el borrado que viene
    if (coleccion === 'ventas') {
      const marca = db.batch();
      trozo.forEach((d) => marca.update(d.ref, { _archivada: true }));
      await marca.commit();
    }

    const lote = db.batch();
    const contadores = new Map<number, { ventas: number; ingresos: number }>();
    for (const d of trozo) {
      const data = d.data();
      const k = Number(data['zapatoId']);
      const c = contadores.get(k) ?? { ventas: 0, ingresos: 0 };
      if (coleccion === 'ventas') {
        if (ventaSacaPar(data)) c.ventas += 1;
      } else {
        c.ingresos += parseInt(data['cantIngresada']) || 0;
      }
      contadores.set(k, c);
      lote.set(db.collection(destino).doc(d.id), { ...data, archivadoEn: FieldValue.serverTimestamp() });
      lote.delete(d.ref);
    }
    contadores.forEach((c, k) => {
      lote.set(
        db.collection('contadoresArchivo').doc(String(k)),
        {
          ...(c.ventas ? { ventas: FieldValue.increment(c.ventas) } : {}),
          ...(c.ingresos ? { ingresos: FieldValue.increment(c.ingresos) } : {}),
          actualizado: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
    await lote.commit();
    resumen.archivados += trozo.length;
  }
  return resumen;
}

export const archivarHistorico = onCall(
  { region: 'us-central1', timeoutSeconds: 540, memory: '1GiB' },
  async (request) => {
    await exigirAdmin(request);
    const meses = Math.max(Number(request.data?.meses) || 24, 12);
    const maximo = Math.min(Math.max(Number(request.data?.maximo) || 3000, 1), 10000);
    const ejecutar = request.data?.confirmar === 'ARCHIVAR';
    const pedidas: Coleccion[] = Array.isArray(request.data?.colecciones) ? request.data.colecciones : ['ventas', 'ingresosProductos'];
    if (!pedidas.every((c) => c === 'ventas' || c === 'ingresosProductos')) {
      throw new HttpsError('invalid-argument', 'Solo se pueden archivar "ventas" e "ingresosProductos".');
    }

    const corte = new Date();
    corte.setMonth(corte.getMonth() - meses);

    const resultados: Resumen[] = [];
    for (const c of pedidas) resultados.push(await archivar(c, corte, maximo, ejecutar));

    return {
      modo: ejecutar ? 'EJECUTADO' : 'SIMULACRO (no se movió nada; envía confirmar: "ARCHIVAR" para ejecutarlo)',
      corte: corte.toISOString(),
      meses,
      maximoPorColeccion: maximo,
      resultados,
    };
  },
);
