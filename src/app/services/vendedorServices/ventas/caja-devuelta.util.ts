import { Venta } from '../../../pages/interfaces';

/**
 * Dinero que sigue en poder del vendedor cuando se hace un CAMBIO de un par
 * vendido en un día anterior.
 *
 * Al hacer ese cambio, la venta original se marca como "Devuelto por cambio" y
 * su `precio` queda en 0. Eso borraba de los totales (de ayer y de hoy) el
 * dinero que el vendedor ya había recibido por ese par, y el efectivo físico no
 * cuadraba con el sistema si el dinero no se recogía el mismo día.
 *
 * Para esos casos se guarda `precioAntesDeCambio` en la venta original, y esta
 * función permite sumar ese dinero de nuevo en los totales de CAJA (no en
 * unidades vendidas, metas ni nómina).
 */
export interface CajaPorMetodo {
  efectivo: number;
  transferencia: number;
  sistecredito: number;
  addi: number;
  bold: number;
  total: number;
}

export function esDevueltaPorCambioConCaja(v: Venta): boolean {
  return (
    (v.tipoVenta || '').trim().toLowerCase() === 'devuelto por cambio' &&
    Number(v.precioAntesDeCambio || 0) > 0
  );
}

/**
 * Dinero que esa venta aportó a la caja en su propio día, justo antes de ser
 * anulada por un cambio. Para una venta normal es su precio completo; para un
 * cambio hecho un día posterior solo entró el excedente (el resto ya se había
 * cobrado en la venta anterior).
 */
export function montoCajaAlAnular(v: Venta): number {
  const tipo = (v.tipoVenta || '').trim().toLowerCase();
  if (tipo === 'cambio' && !v.esMismoDia) return Number(v.excedente || 0);
  return Number(v.precio || 0);
}

export function cajaDevueltaPorCambio(v: Venta): CajaPorMetodo {
  const caja: CajaPorMetodo = {
    efectivo: 0,
    transferencia: 0,
    sistecredito: 0,
    addi: 0,
    bold: 0,
    total: 0,
  };
  if (!esDevueltaPorCambioConCaja(v)) return caja;

  const total = Number(v.precioAntesDeCambio);

  // La venta anulada era a su vez un cambio hecho otro día: solo aportó el excedente.
  if (v.productoDevueltoId && v.esMismoDia !== true) {
    if (v.metodoExcedente && v.metodoExcedente in caja) {
      (caja as any)[v.metodoExcedente] += total;
    }
    caja.total = total;
    return caja;
  }

  const segundo = Number(v.segundoMetodo?.precio || 0);
  const principal = v.precioMetodoPrincipal ?? total - segundo;

  const sumar = (metodo: string | undefined, monto: number) => {
    if (!metodo || !(metodo in caja) || metodo === 'total') return;
    (caja as any)[metodo] += Number(monto) || 0;
  };

  sumar(v.metodoPago, principal);
  if (v.segundoMetodo) sumar(v.segundoMetodo.metodo, segundo);
  caja.total = total;
  return caja;
}
