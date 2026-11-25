import { Venta } from '../../../pages/interfaces';
import {
  cajaDevueltaPorCambio,
  esDevueltaPorCambioConCaja,
} from './caja-devuelta.util';

/**
 * Cálculo ÚNICO de la caja (dinero recibido) por vendedor.
 *
 * Reglas (las mismas que usan las pantallas de ventas):
 *  - Venta normal: precio por el método de pago (y segundo método si lo hay).
 *  - Cambio de un par vendido OTRO día: solo entra el excedente.
 *  - Cambio del mismo día: precio + excedente.
 *  - Venta anulada por un cambio posterior: su dinero sigue en poder del vendedor
 *    y cuenta en el día en que se vendió (campo `precioAntesDeCambio`).
 *  - Devueltas por bono: no cuentan.
 *
 * La IA, el cuadre de caja y cualquier reporte nuevo deben usar esta función
 * para que todos muestren las mismas cifras.
 */
export interface CajaVendedor {
  vendedor: string;
  vendedorId?: string;
  efectivo: number;
  transferencia: number;
  sistecredito: number;
  addi: number;
  bold: number;
  /** Suma de todos los métodos. */
  total: number;
  /** Pares vendidos (no cuenta bonos ni cambios de otro día). */
  unidades: number;
  /** Cantidad de registros de venta considerados. */
  registros: number;
}

type Metodo = 'efectivo' | 'transferencia' | 'sistecredito' | 'addi' | 'bold';
const METODOS: Metodo[] = ['efectivo', 'transferencia', 'sistecredito', 'addi', 'bold'];

function nuevo(v: Venta): CajaVendedor {
  return {
    vendedor: v.vendedor || 'Sin vendedor',
    vendedorId: v.vendedorId,
    efectivo: 0,
    transferencia: 0,
    sistecredito: 0,
    addi: 0,
    bold: 0,
    total: 0,
    unidades: 0,
    registros: 0,
  };
}

function sumarMetodo(c: CajaVendedor, metodo: string | undefined, monto: number) {
  const m = (metodo || '').toLowerCase() as Metodo;
  if (METODOS.includes(m)) c[m] += Number(monto) || 0;
}

/** Aporte a la caja de una sola venta, por método. */
export function cajaDeVenta(v: Venta): Record<Metodo, number> & { unidades: number } {
  const tmp = nuevo(v);
  const tipo = (v.tipoVenta || '').trim().toLowerCase();
  let unidades = 0;

  if (v.DevueltoBono === true || tipo === 'devuelto por bono') {
    // no cuenta
  } else if (tipo === 'devuelto por cambio') {
    if (esDevueltaPorCambioConCaja(v)) {
      const c = cajaDevueltaPorCambio(v);
      METODOS.forEach((m) => (tmp[m] += c[m]));
    }
  } else if (tipo === 'cambio' && !v.esMismoDia) {
    sumarMetodo(tmp, v.metodoExcedente, Number(v.excedente || 0));
  } else {
    const principal = v.precioMetodoPrincipal ?? v.precio ?? 0;
    sumarMetodo(tmp, v.metodoPago, principal);
    if (v.segundoMetodo) sumarMetodo(tmp, v.segundoMetodo.metodo, v.segundoMetodo.precio);
    if (tipo === 'cambio' && v.esMismoDia && v.excedente) {
      sumarMetodo(tmp, v.metodoExcedente, Number(v.excedente));
    }
    if (tipo !== 'bono') unidades = 1;
  }

  return {
    efectivo: tmp.efectivo,
    transferencia: tmp.transferencia,
    sistecredito: tmp.sistecredito,
    addi: tmp.addi,
    bold: tmp.bold,
    unidades,
  };
}

export function calcularCajaPorVendedor(ventas: Venta[]): CajaVendedor[] {
  const mapa = new Map<string, CajaVendedor>();

  for (const v of ventas) {
    // Las ventas 'otro-local' SÍ cuentan: el vendedor recibió ese dinero, igual que
    // en administration-ventas, venta-local y show-vendedor-sales.
    const aporte = cajaDeVenta(v);
    const suma = METODOS.reduce((a, m) => a + aporte[m], 0);
    if (suma === 0 && aporte.unidades === 0) continue;

    const clave = (v.vendedorId || v.vendedor || 'sin-vendedor').toString().trim().toLowerCase();
    if (!mapa.has(clave)) mapa.set(clave, nuevo(v));
    const c = mapa.get(clave)!;

    METODOS.forEach((m) => (c[m] += aporte[m]));
    c.total += suma;
    c.unidades += aporte.unidades;
    c.registros++;
  }

  return [...mapa.values()].sort((a, b) =>
    a.vendedor.localeCompare(b.vendedor, 'es', { sensitivity: 'base' }),
  );
}
