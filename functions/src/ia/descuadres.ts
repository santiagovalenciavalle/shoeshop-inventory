import * as scheduler from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { diaColombia } from './caja';
import { notificarAdmins } from './notificar';
import { crearNotificacionIA } from './notificacionesIA';
import { exigirAdmin, ventaSacaPar } from './util';

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * DETECCIÓN DE DESCUADRES DE INVENTARIO
 *
 * Un par puede estar en muchos lugares a la vez. Para cada referencia se
 * comprueba que:
 *
 *   pares ingresados  =  bodega + pedidos en manos del vendedor + pedidos devueltos
 *                        (sin confirmar) + préstamos + ventas + exhibiciones + locales
 *
 * Reglas del modelo (según cómo se mueve un par en el sistema):
 *  - Pedido "Pendiente": el stock TODAVÍA no se descuenta, no cuenta como ubicación.
 *  - Pedido "Recibido"/"Aceptado"/"No Recibido": el stock ya se descontó, el par está con el vendedor.
 *  - Pedido "Devuelto": el par volvió pero bodega aún no lo confirma (el stock no se ha restaurado).
 *  - Pedido "StockRestaurado": ya volvió a bodega, no cuenta.
 *  - Ventas: cuentan las que sacan un par; las anuladas por cambio o bono se excluyen
 *    (su par vuelve por un pedido "Devuelto").
 *  - Préstamos: los que siguen activos (no devueltos ni vendidos).
 *  - Exhibiciones: cada registro es un par fuera de bodega.
 *  - Locales: pares enviados a inventarioLocales.
 */
export interface Ubicaciones {
  bodega: number;
  pedidosConVendedor: number;
  pedidosDevueltosSinConfirmar: number;
  prestamosActivos: number;
  ventas: number;
  exhibiciones: number;
  enLocales: number;
}

export interface Descuadre {
  codigo: number | string;
  producto: string;
  ingresos: number;
  ubicaciones: Ubicaciones;
  /** Pedidos pendientes: solo informativo, no entran en la suma. */
  pedidosPendientes: number;
  suma: number;
  /** suma - ingresos. Positivo = hay más pares ubicados que ingresados; negativo = faltan pares. */
  diferencia: number;
  severidad: 'alta' | 'media' | 'baja';
  notas: string[];
}

export interface EntradaDescuadre {
  codigo: number | string;
  producto: string;
  stock: number;
  tallasSuma: number | null;
  ingresos: number;
  pedidos: { estado: string }[];
  prestamos: { estado?: string }[];
  ventas: number;
  exhibiciones: number;
  enLocales: number;
}

const ESTADOS_CON_VENDEDOR = ['recibido', 'aceptado', 'no recibido'];

/** Compara un producto contra su historial. Función pura (se puede probar sin base de datos). */
export function evaluarProducto(e: EntradaDescuadre): Descuadre {
  const est = (p: { estado: string }) => String(p.estado ?? '').toLowerCase().trim();
  const pedidosConVendedor = e.pedidos.filter((p) => ESTADOS_CON_VENDEDOR.includes(est(p))).length;
  const pedidosDevueltos = e.pedidos.filter((p) => est(p) === 'devuelto').length;
  const pedidosPendientes = e.pedidos.filter((p) => est(p) === 'pendiente').length;
  const prestamosActivos = e.prestamos.filter((p) => {
    const s = String(p.estado ?? '').toLowerCase();
    return s !== 'devuelto' && s !== 'vendido';
  }).length;

  const ubicaciones: Ubicaciones = {
    bodega: e.stock,
    pedidosConVendedor,
    pedidosDevueltosSinConfirmar: pedidosDevueltos,
    prestamosActivos,
    ventas: e.ventas,
    exhibiciones: e.exhibiciones,
    enLocales: e.enLocales,
  };
  const suma = Object.values(ubicaciones).reduce((a, n) => a + n, 0);
  const diferencia = suma - e.ingresos;
  const abs = Math.abs(diferencia);

  const notas: string[] = [];
  if (e.tallasSuma !== null && e.tallasSuma !== e.stock) {
    notas.push(
      `El stock guardado (${e.stock}) no coincide con la suma de las tallas (${e.tallasSuma}). Es un error interno del producto: revisa las tallas.`,
    );
  }
  if (diferencia > 0) {
    notas.push(
      `Hay ${abs} par${abs === 1 ? '' : 'es'} MÁS ubicados que ingresados. Causas típicas: un ingreso sin registrar, una venta duplicada, o un par contado en dos lugares (por ejemplo vendido y aún en exhibición).`,
    );
  } else if (diferencia < 0) {
    notas.push(
      `Faltan ${abs} par${abs === 1 ? '' : 'es'}: hay menos pares ubicados que ingresados. Causas típicas: una venta o préstamo borrado, un pedido eliminado sin restaurar el stock, o un par perdido.`,
    );
  }
  if (diferencia !== 0 && pedidosDevueltos > 0 && abs === pedidosDevueltos) {
    notas.push(`La diferencia coincide con los pedidos devueltos sin confirmar (${pedidosDevueltos}): quizá bodega aún no los recibe.`);
  }
  if (diferencia < 0 && pedidosPendientes > 0 && abs === pedidosPendientes) {
    notas.push(`La diferencia coincide con los pedidos pendientes (${pedidosPendientes}). Si alguno ya se entregó sin aceptarse, el stock no se descontó.`);
  }
  if (diferencia !== 0 && e.exhibiciones > 0 && e.ventas > 0 && diferencia > 0) {
    notas.push('Tiene exhibiciones y ventas a la vez: revisa que un par vendido desde exhibición haya borrado su registro de exhibición.');
  }

  return {
    codigo: e.codigo,
    producto: e.producto,
    ingresos: e.ingresos,
    ubicaciones,
    pedidosPendientes,
    suma,
    diferencia,
    severidad: abs >= 3 ? 'alta' : abs === 2 ? 'media' : 'baja',
    notas,
  };
}

export interface ResultadoDescuadres {
  generado: string;
  revisados: number;
  sinIngresosRegistrados: number;
  totalDescuadres: number;
  resumen: { alta: number; media: number; baja: number; sobran: number; faltan: number };
  descuadres: Descuadre[];
}

const idNum = (v: any) => Number(v);

export interface RangoCodigos {
  desde?: number;
  hasta?: number;
}

export async function calcularDescuadres(codigoFiltro?: number, rango: RangoCodigos = {}): Promise<ResultadoDescuadres> {
  const soloUno = Number.isFinite(codigoFiltro as number) && codigoFiltro !== undefined;
  const hayRango = !soloUno && (Number.isFinite(rango.desde as number) || Number.isFinite(rango.hasta as number));
  const entre = <T extends admin.firestore.Query>(q: T, campo: string): T => {
    let r: admin.firestore.Query = q;
    if (Number.isFinite(rango.desde as number)) r = r.where(campo, '>=', rango.desde);
    if (Number.isFinite(rango.hasta as number)) r = r.where(campo, '<=', rango.hasta);
    return r as T;
  };
  const porProducto = <T extends admin.firestore.Query>(q: T, campo: string, numero = true) =>
    soloUno ? q.where(campo, '==', numero ? codigoFiltro : String(codigoFiltro)) : hayRango && numero ? entre(q, campo) : q;

  const [productosSnap, ingresosSnap, pedidosSnap, prestamosSnap, ventasSnap, exhibSnap, localesSnap, archivoSnap] = await Promise.all([
    soloUno
      ? db.collection('productos').where('id', '==', codigoFiltro).get()
      : hayRango
        ? entre(db.collection('productos'), 'id').get()
        : db.collection('productos').get(),
    porProducto(db.collection('ingresosProductos'), 'zapatoId').select('zapatoId', 'cantIngresada').get(),
    porProducto(db.collection('pedidos'), 'zapatoId').select('zapatoId', 'estado').get(),
    porProducto(db.collection('prestamos'), 'zapatoId').select('zapatoId', 'estado').get(),
    porProducto(db.collection('ventas'), 'zapatoId').select('zapatoId', 'tipoVenta').get(),
    porProducto(db.collection('exhibiciones'), 'zapatoId', false).select('zapatoId').get(),
    porProducto(db.collection('inventarioLocales'), 'productoId').select('productoId', 'stock').get(),
    // Lo que ya se archivó (ventas e ingresos antiguos) sigue contando para el cuadre del producto
    soloUno ? db.collection('contadoresArchivo').where(admin.firestore.FieldPath.documentId(), '==', String(codigoFiltro)).get() : db.collection('contadoresArchivo').get(),
  ]);

  const archivado = new Map<number, { ventas: number; ingresos: number }>();
  archivoSnap.forEach((d) => {
    archivado.set(idNum(d.id), { ventas: Number(d.data()['ventas'] || 0), ingresos: Number(d.data()['ingresos'] || 0) });
  });

  const ingresos = new Map<number, number>();
  ingresosSnap.forEach((d) => {
    const k = idNum(d.data()['zapatoId']);
    ingresos.set(k, (ingresos.get(k) ?? 0) + (parseInt(d.data()['cantIngresada']) || 0));
  });
  const agrupar = <V>(snap: admin.firestore.QuerySnapshot, campo: string, mapa: (d: any) => V) => {
    const m = new Map<number, V[]>();
    snap.forEach((d) => {
      const k = idNum(d.data()[campo]);
      const l = m.get(k) ?? [];
      l.push(mapa(d.data()));
      m.set(k, l);
    });
    return m;
  };
  const pedidos = agrupar(pedidosSnap, 'zapatoId', (d) => ({ estado: String(d['estado'] ?? '') }));
  const prestamos = agrupar(prestamosSnap, 'zapatoId', (d) => ({ estado: d['estado'] as string | undefined }));
  const ventas = new Map<number, number>();
  ventasSnap.forEach((d) => {
    if (!ventaSacaPar(d.data())) return;
    const k = idNum(d.data()['zapatoId']);
    ventas.set(k, (ventas.get(k) ?? 0) + 1);
  });
  const exhib = new Map<number, number>();
  exhibSnap.forEach((d) => {
    const k = idNum(d.data()['zapatoId']);
    exhib.set(k, (exhib.get(k) ?? 0) + 1);
  });
  const locales = new Map<number, number>();
  localesSnap.forEach((d) => {
    const k = idNum(d.data()['productoId']);
    locales.set(k, (locales.get(k) ?? 0) + (Number(d.data()['stock']) || 0));
  });

  // Sumar lo archivado a los totales de cada producto
  archivado.forEach((a, k) => {
    ingresos.set(k, (ingresos.get(k) ?? 0) + a.ingresos);
    ventas.set(k, (ventas.get(k) ?? 0) + a.ventas);
  });

  const descuadres: Descuadre[] = [];
  let sinIngresos = 0;
  let revisados = 0;

  productosSnap.forEach((doc) => {
    const p = doc.data();
    const codigo = p['id'] ?? doc.id;
    const k = idNum(codigo);
    if (!Number.isFinite(k)) return;
    // En el análisis completo se omiten los agotados; al buscar un código se analiza siempre.
    if (!soloUno && !(Number(p['stock'] || 0) > 0)) return;

    const ing = ingresos.get(k) ?? 0;
    if (ing === 0) {
      sinIngresos++;
      if (!soloUno) return; // sin ingresos no hay contra qué comparar
    }
    revisados++;

    const tallas = p['tallasDisponibles'];
    const tallasSuma = tallas && typeof tallas === 'object' ? (Object.values(tallas) as any[]).reduce((a: number, n) => a + (Number(n) || 0), 0) : null;

    const r = evaluarProducto({
      codigo,
      producto: `${p['marca'] ?? ''} ${p['referencia'] ?? ''}`.trim() || `Código ${codigo}`,
      stock: Number(p['stock'] || 0),
      tallasSuma,
      ingresos: ing,
      pedidos: pedidos.get(k) ?? [],
      prestamos: prestamos.get(k) ?? [],
      ventas: ventas.get(k) ?? 0,
      exhibiciones: exhib.get(k) ?? 0,
      enLocales: locales.get(k) ?? 0,
    });
    if (soloUno || r.diferencia !== 0 || r.notas.length) descuadres.push(r);
  });

  descuadres.sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia));
  const reales = descuadres.filter((d) => d.diferencia !== 0);
  return {
    generado: new Date().toISOString(),
    revisados,
    sinIngresosRegistrados: sinIngresos,
    totalDescuadres: reales.length,
    resumen: {
      alta: reales.filter((d) => d.severidad === 'alta').length,
      media: reales.filter((d) => d.severidad === 'media').length,
      baja: reales.filter((d) => d.severidad === 'baja').length,
      sobran: reales.filter((d) => d.diferencia > 0).length,
      faltan: reales.filter((d) => d.diferencia < 0).length,
    },
    descuadres,
  };
}

async function guardarUltimo(r: ResultadoDescuadres): Promise<void> {
  await db.doc('descuadresInventario/ultimo').set({
    ...r,
    descuadres: r.descuadres.slice(0, 300),
    guardado: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/** Desde la app o el chat. Con `codigo` analiza un solo producto; sin él, todo el inventario. */
export const analizarDescuadres = onCall(
  { region: 'us-central1', timeoutSeconds: 300, memory: '1GiB' },
  async (request) => {
    await exigirAdmin(request);
    const raw = request.data?.codigo;
    if (raw !== undefined && raw !== null && raw !== '') {
      const codigo = Number(raw);
      if (!Number.isFinite(codigo)) throw new HttpsError('invalid-argument', 'El código debe ser un número.');
      return calcularDescuadres(codigo);
    }
    const num = (v: any) => (v === undefined || v === null || v === '' ? undefined : Number(v));
    const desde = num(request.data?.desde);
    const hasta = num(request.data?.hasta);
    const limite = Math.min(Math.max(num(request.data?.limite) ?? 100, 1), 500);
    if ((desde !== undefined && !Number.isFinite(desde)) || (hasta !== undefined && !Number.isFinite(hasta))) {
      throw new HttpsError('invalid-argument', 'El rango de códigos debe ser numérico.');
    }
    const r = await calcularDescuadres(undefined, { desde, hasta });
    // Solo el análisis de todo el inventario se guarda como "último"; un rango es una consulta puntual
    if (desde === undefined && hasta === undefined) await guardarUltimo(r);
    return { ...r, descuadres: r.descuadres.slice(0, limite) };
  },
);

/** Cada noche revisa todo el inventario y avisa si aparecieron descuadres nuevos. */
export const revisionNocturnaInventario = scheduler.onSchedule(
  { schedule: '30 22 * * *', timeZone: 'America/Bogota', timeoutSeconds: 540, memory: '1GiB' },
  async () => {
    const previo = await db.doc('descuadresInventario/ultimo').get();
    const antes = new Map<string, number>();
    ((previo.data()?.['descuadres'] ?? []) as Descuadre[]).forEach((d) => {
      if (d.diferencia !== 0) antes.set(String(d.codigo), d.diferencia);
    });

    const r = await calcularDescuadres();
    await guardarUltimo(r);
    await db.doc(`descuadresInventario/${diaColombia(0).ymd}`).set({
      generado: r.generado,
      totalDescuadres: r.totalDescuadres,
      resumen: r.resumen,
      codigos: r.descuadres.filter((d) => d.diferencia !== 0).slice(0, 500).map((d) => ({ codigo: d.codigo, diferencia: d.diferencia })),
    });

    const nuevos = r.descuadres.filter((d) => d.diferencia !== 0 && antes.get(String(d.codigo)) !== d.diferencia);
    if (!nuevos.length) {
      console.log('[inventario] sin descuadres nuevos o cambiados.');
      return;
    }
    const lista = nuevos
      .slice(0, 3)
      .map((d) => `${d.producto} (${d.diferencia > 0 ? '+' : ''}${d.diferencia})`)
      .join(', ');
    await crearNotificacionIA({
      id: `descuadre-inventario_${diaColombia(0).ymd}`,
      tipo: 'descuadre-inventario',
      severidad: nuevos.some((d) => d.severidad === 'alta') ? 'alta' : 'media',
      titulo: `${nuevos.length} descuadre${nuevos.length === 1 ? '' : 's'} de inventario`,
      descripcion: `${lista}${nuevos.length > 3 ? ` y ${nuevos.length - 3} más` : ''}. Total con diferencia: ${r.totalDescuadres}.`,
      ruta: '/admin/descuadres',
    });
    await notificarAdmins(
      `📦 ${nuevos.length} descuadre${nuevos.length === 1 ? '' : 's'} de inventario nuevo${nuevos.length === 1 ? '' : 's'}`,
      `${lista}${nuevos.length > 3 ? ` y ${nuevos.length - 3} más` : ''}. Total con diferencia: ${r.totalDescuadres}.`,
      { tipo: 'descuadre-inventario' },
    );
  },
);
