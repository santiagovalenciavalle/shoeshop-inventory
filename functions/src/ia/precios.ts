import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { aFecha, exigirAdmin, ventaCuentaRotacion } from './util';

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Sugerencias de precio con respaldo de datos.
 *
 * Todo se calcula con reglas exactas a partir de ventas, stock, antigüedad y
 * costo. La IA solo explica; NUNCA decide un precio. Los umbrales están aquí
 * arriba para poder ajustarlos fácilmente.
 */
export const UMBRALES = {
  /** Margen mínimo que se respeta sobre el costo al sugerir cualquier precio. */
  margenMinimoSobreCosto: 0.05,
  subir: { ventas30Min: 4, diasInventarioMax: 21, margenMax: 0.4, pctBajoMinimoMax: 0.25, incremento: 0.08, incrementoFuerte: 0.1 },
  promocion: { stockMin: 3, diasSinVentaMin: 45, antiguedadMin: 120, ventas60Max: 1 },
  ajusteMinimo: { ventasMin: 3, pctBajoMinimoMin: 0.4, brechaMin: 0.03 },
};

const DIA = 86400000;
const redondear1000 = (n: number) => Math.round(n / 1000) * 1000;
const techo1000 = (n: number) => Math.ceil(n / 1000) * 1000;
const piso1000 = (n: number) => Math.floor(n / 1000) * 1000;

export type AccionPrecio = 'subir' | 'promocion' | 'ajustar-minimo' | 'sin-margen';

export interface SugerenciaPrecio {
  codigo: number | string;
  producto: string;
  accion: AccionPrecio;
  precioActual: number;
  precioSugerido: number | null;
  costo: number;
  margenActualPct: number;
  margenSugeridoPct: number | null;
  stock: number;
  ventas30: number;
  ventas60: number;
  diasSinVenta: number | null;
  antiguedadDias: number | null;
  precioPromedioVendido: number | null;
  pctVentasBajoMinimo: number | null;
  motivo: string;
  /** Valor para ordenar: dinero que se gana o que se libera. */
  impacto: number;
}

export interface ResultadoPrecios {
  generado: string;
  criterios: string;
  resumen: {
    paraSubir: number;
    paraPromocion: number;
    paraAjustarMinimo: number;
    sinMargen: number;
    capitalAtrapadoEnPromocion: number;
  };
  subir: SugerenciaPrecio[];
  promocion: SugerenciaPrecio[];
  ajustarMinimo: SugerenciaPrecio[];
  sinMargen: SugerenciaPrecio[];
}

export interface EntradaProducto {
  codigo: number | string;
  producto: string;
  costo: number;
  precioActual: number;
  stock: number;
  ventas: { fecha: number; precio: number; bajo: boolean }[];
  primerIngresoMs: number | null;
}

/** Decide qué hacer con el precio de UN producto. Función pura (se puede probar sin base de datos). */
export function clasificarProducto(e: EntradaProducto, ahora: number): SugerenciaPrecio | null {
  const U = UMBRALES;
  const { costo, precioActual, stock } = e;
  if (!(costo > 0) || !(precioActual > 0) || stock <= 0) return null;

  const ventas = [...e.ventas].sort((a, b) => b.fecha - a.fecha);
  const ventas30 = ventas.filter((v) => ahora - v.fecha <= 30 * DIA).length;
  const ventas60 = ventas.filter((v) => ahora - v.fecha <= 60 * DIA).length;
  const diasSinVenta = ventas.length ? Math.floor((ahora - ventas[0].fecha) / DIA) : null;
  const antiguedad = e.primerIngresoMs ? Math.floor((ahora - e.primerIngresoMs) / DIA) : null;

  const recientes = ventas.filter((v) => ahora - v.fecha <= 60 * DIA && v.precio > 0);
  const promedio = recientes.length ? recientes.reduce((a, v) => a + v.precio, 0) / recientes.length : null;
  const pctBajo = recientes.length ? recientes.filter((v) => v.bajo).length / recientes.length : null;

  const margenActual = (precioActual - costo) / precioActual;
  const piso = techo1000(costo * (1 + U.margenMinimoSobreCosto));
  const diasInventario = ventas30 > 0 ? stock / (ventas30 / 30) : null;

  const base = {
    codigo: e.codigo,
    producto: e.producto,
    precioActual,
    costo,
    margenActualPct: Math.round(margenActual * 100),
    stock,
    ventas30,
    ventas60,
    diasSinVenta,
    antiguedadDias: antiguedad,
    precioPromedioVendido: promedio ? Math.round(promedio) : null,
    pctVentasBajoMinimo: pctBajo === null ? null : Math.round(pctBajo * 100),
  };

  // 1) SUBIR: se vende rápido, queda poco y el margen es bajo
  if (
    ventas30 >= U.subir.ventas30Min &&
    diasInventario !== null &&
    diasInventario <= U.subir.diasInventarioMax &&
    margenActual < U.subir.margenMax &&
    (pctBajo ?? 0) <= U.subir.pctBajoMinimoMax
  ) {
    const inc = ventas30 >= 8 && diasInventario <= 10 ? U.subir.incrementoFuerte : U.subir.incremento;
    const sugerido = redondear1000(precioActual * (1 + inc));
    if (sugerido > precioActual) {
      return {
        ...base,
        accion: 'subir',
        precioSugerido: sugerido,
        margenSugeridoPct: Math.round(((sugerido - costo) / sugerido) * 100),
        motivo: `Vendió ${ventas30} pares en 30 días y con ese ritmo el stock (${stock}) dura unos ${Math.round(diasInventario)} días. El margen actual es ${Math.round(margenActual * 100)}% y casi no se vende por debajo del mínimo.`,
        impacto: ventas30 * (sugerido - precioActual),
      };
    }
  }

  // 2) PROMOCIÓN: capital detenido en pares que no rotan
  const sinRotar =
    stock >= U.promocion.stockMin &&
    ((diasSinVenta !== null && diasSinVenta >= U.promocion.diasSinVentaMin) ||
      (diasSinVenta === null && (antiguedad ?? 0) >= U.promocion.diasSinVentaMin) ||
      ((antiguedad ?? 0) >= U.promocion.antiguedadMin && ventas60 <= U.promocion.ventas60Max));
  if (sinRotar) {
    const dsv = diasSinVenta ?? antiguedad ?? 0;
    const desc = dsv >= 120 || (antiguedad ?? 0) >= 180 ? 0.2 : dsv >= 75 || (antiguedad ?? 0) >= 120 ? 0.15 : 0.1;
    const promo = redondear1000(precioActual * (1 - desc));
    const sugerido = Math.max(promo, piso);
    const capital = stock * costo;

    if (sugerido >= precioActual) {
      return {
        ...base,
        accion: 'sin-margen',
        precioSugerido: null,
        margenSugeridoPct: null,
        motivo: `Lleva ${diasSinVenta !== null ? diasSinVenta + ' días sin venderse' : 'tiempo sin rotar'} con ${stock} pares ($${Math.round(capital).toLocaleString('es-CO')} de capital), pero el precio actual ya está cerca del costo (margen ${Math.round(margenActual * 100)}%). No hay espacio para descontar sin perder plata: considera combos o ubicarlo mejor en exhibición.`,
        impacto: capital,
      };
    }
    return {
      ...base,
      accion: 'promocion',
      precioSugerido: sugerido,
      margenSugeridoPct: Math.round(((sugerido - costo) / sugerido) * 100),
      motivo: `${diasSinVenta !== null ? `Hace ${diasSinVenta} días que no se vende` : 'No registra ventas recientes'}${antiguedad ? ` y lleva ${antiguedad} días en inventario` : ''}, con ${stock} pares ($${Math.round(capital).toLocaleString('es-CO')} de capital detenido). ${sugerido > promo ? 'El descuento queda limitado para no bajar del costo más 5%.' : `Descuento de ${Math.round(desc * 100)}%.`}`,
      impacto: capital,
    };
  }

  // 3) AJUSTAR MÍNIMO: se vende seguido por debajo del precio mínimo
  if (
    recientes.length >= U.ajusteMinimo.ventasMin &&
    (pctBajo ?? 0) >= U.ajusteMinimo.pctBajoMinimoMin &&
    promedio !== null &&
    promedio < precioActual * (1 - U.ajusteMinimo.brechaMin)
  ) {
    const sugerido = Math.max(piso1000(promedio), piso);
    if (sugerido < precioActual) {
      return {
        ...base,
        accion: 'ajustar-minimo',
        precioSugerido: sugerido,
        margenSugeridoPct: Math.round(((sugerido - costo) / sugerido) * 100),
        motivo: `${Math.round((pctBajo ?? 0) * 100)}% de las ventas recientes se hicieron por debajo del mínimo y el precio real promedio fue $${Math.round(promedio).toLocaleString('es-CO')}. El mínimo actual parece alto para el mercado.`,
        impacto: recientes.length * (precioActual - sugerido),
      };
    }
  }
  return null;
}

export async function calcularSugerenciasPrecio(limite = 12): Promise<ResultadoPrecios> {
  const ahora = Date.now();
  const hace90 = new Date(ahora - 90 * DIA);

  const [productosSnap, ventasSnap, ingresosSnap] = await Promise.all([
    db.collection('productos').where('stock', '>', 0).get(),
    db
      .collection('ventas')
      .where('fechaVenta', '>=', admin.firestore.Timestamp.fromDate(hace90))
      .select('zapatoId', 'tipoVenta', 'precio', 'fechaVenta', 'precioBajo', 'esMismoDia', 'DevueltoBono')
      .get(),
    db.collection('ingresosProductos').select('zapatoId', 'fecha').get(),
  ]);

  // Ventas por producto (solo las que miden rotación real)
  const ventasPor = new Map<string, { fecha: number; precio: number; bajo: boolean }[]>();
  ventasSnap.forEach((d) => {
    const v = d.data();
    if (!ventaCuentaRotacion(v) || v['DevueltoBono'] === true) return;
    const f = aFecha(v['fechaVenta']);
    if (!f) return;
    const k = String(v['zapatoId']);
    const lista = ventasPor.get(k) ?? [];
    lista.push({ fecha: f.getTime(), precio: Number(v['precio'] || 0), bajo: !!v['precioBajo'] });
    ventasPor.set(k, lista);
  });

  // Primer ingreso de cada producto = antigüedad
  const primerIngreso = new Map<string, number>();
  ingresosSnap.forEach((d) => {
    const f = aFecha(d.data()['fecha']);
    if (!f) return;
    const k = String(d.data()['zapatoId']);
    const prev = primerIngreso.get(k);
    if (prev === undefined || f.getTime() < prev) primerIngreso.set(k, f.getTime());
  });

  const subir: SugerenciaPrecio[] = [];
  const promocion: SugerenciaPrecio[] = [];
  const ajustar: SugerenciaPrecio[] = [];
  const sinMargen: SugerenciaPrecio[] = [];

  productosSnap.forEach((doc) => {
    const p = doc.data();
    const codigo = p['id'] ?? doc.id;
    const s = clasificarProducto(
      {
        codigo,
        producto: `${p['marca'] ?? ''} ${p['referencia'] ?? ''}`.trim() || `Código ${codigo}`,
        costo: Number(p['precioAdquisicion'] || 0),
        precioActual: Number(p['precioMin'] || 0),
        stock: Number(p['stock'] || 0),
        ventas: ventasPor.get(String(codigo)) ?? [],
        primerIngresoMs: primerIngreso.get(String(codigo)) ?? null,
      },
      ahora,
    );
    if (!s) return;
    if (s.accion === 'subir') subir.push(s);
    else if (s.accion === 'promocion') promocion.push(s);
    else if (s.accion === 'ajustar-minimo') ajustar.push(s);
    else sinMargen.push(s);
  });

  const top = (l: SugerenciaPrecio[]) => l.sort((a, b) => b.impacto - a.impacto).slice(0, limite);
  const capitalPromo = promocion.reduce((a, s) => a + s.stock * s.costo, 0);

  return {
    generado: new Date().toISOString(),
    criterios:
      'Basado en ventas de los últimos 90 días, stock, antigüedad del inventario y costo. Ningún precio sugerido baja del costo + 5%. Los precios son sugerencias: la decisión es tuya.',
    resumen: {
      paraSubir: subir.length,
      paraPromocion: promocion.length,
      paraAjustarMinimo: ajustar.length,
      sinMargen: sinMargen.length,
      capitalAtrapadoEnPromocion: Math.round(capitalPromo),
    },
    subir: top(subir),
    promocion: top(promocion),
    ajustarMinimo: top(ajustar),
    sinMargen: top(sinMargen),
  };
}

export const sugerirPrecios = onCall(
  { region: 'us-central1', timeoutSeconds: 240, memory: '1GiB' },
  async (request) => {
    await exigirAdmin(request);
    const limite = Math.min(Math.max(Number(request.data?.limite) || 12, 3), 30);
    return calcularSugerenciasPrecio(limite);
  },
);
