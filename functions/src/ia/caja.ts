/**
 * Cálculo de caja por vendedor en el servidor.
 *
 * IMPORTANTE: es el MISMO cálculo que
 * `src/app/services/vendedorServices/ventas/caja-calculo.ts` en la app.
 * Si cambia una regla, hay que cambiarla en los dos sitios.
 */

export interface CajaVendedor {
  vendedor: string;
  vendedorId?: string;
  efectivo: number;
  transferencia: number;
  sistecredito: number;
  addi: number;
  bold: number;
  total: number;
  unidades: number;
  registros: number;
}

type Metodo = 'efectivo' | 'transferencia' | 'sistecredito' | 'addi' | 'bold';
const METODOS: Metodo[] = ['efectivo', 'transferencia', 'sistecredito', 'addi', 'bold'];

function aporteDevueltaPorCambio(v: any): Record<Metodo, number> {
  const out: Record<Metodo, number> = { efectivo: 0, transferencia: 0, sistecredito: 0, addi: 0, bold: 0 };
  const total = Number(v.precioAntesDeCambio || 0);
  if (!(total > 0)) return out;

  // La venta anulada era a su vez un cambio hecho otro día: solo aportó el excedente
  if (v.productoDevueltoId && v.esMismoDia !== true) {
    const m = String(v.metodoExcedente || '').toLowerCase() as Metodo;
    if (METODOS.includes(m)) out[m] += total;
    return out;
  }

  const segundo = Number(v.segundoMetodo?.precio || 0);
  const principal = v.precioMetodoPrincipal ?? total - segundo;
  const m1 = String(v.metodoPago || '').toLowerCase() as Metodo;
  if (METODOS.includes(m1)) out[m1] += Number(principal) || 0;
  const m2 = String(v.segundoMetodo?.metodo || '').toLowerCase() as Metodo;
  if (v.segundoMetodo && METODOS.includes(m2)) out[m2] += segundo;
  return out;
}

export function cajaDeVenta(v: any): Record<Metodo, number> & { unidades: number } {
  const out: Record<Metodo, number> & { unidades: number } = {
    efectivo: 0,
    transferencia: 0,
    sistecredito: 0,
    addi: 0,
    bold: 0,
    unidades: 0,
  };
  const sumar = (metodo: any, monto: number) => {
    const m = String(metodo || '').toLowerCase() as Metodo;
    if (METODOS.includes(m)) out[m] += Number(monto) || 0;
  };
  const tipo = String(v.tipoVenta || '').trim().toLowerCase();

  if (v.DevueltoBono === true || tipo === 'devuelto por bono') {
    return out;
  }
  if (tipo === 'devuelto por cambio') {
    const a = aporteDevueltaPorCambio(v);
    METODOS.forEach((m) => (out[m] += a[m]));
    return out;
  }
  if (tipo === 'cambio' && !v.esMismoDia) {
    sumar(v.metodoExcedente, Number(v.excedente || 0));
    return out;
  }

  sumar(v.metodoPago, v.precioMetodoPrincipal ?? v.precio ?? 0);
  if (v.segundoMetodo) sumar(v.segundoMetodo.metodo, v.segundoMetodo.precio);
  if (tipo === 'cambio' && v.esMismoDia && v.excedente) sumar(v.metodoExcedente, Number(v.excedente));
  if (tipo !== 'bono') out.unidades = 1;
  return out;
}

export function calcularCajaPorVendedor(ventas: any[]): CajaVendedor[] {
  const mapa = new Map<string, CajaVendedor>();

  for (const v of ventas) {
    // Las ventas 'otro-local' SÍ cuentan: el vendedor recibió ese dinero, igual que
    // en administration-ventas, venta-local y show-vendedor-sales.
    const a = cajaDeVenta(v);
    const suma = METODOS.reduce((acc, m) => acc + a[m], 0);
    if (suma === 0 && a.unidades === 0) continue;

    const clave = String(v.vendedorId || v.vendedor || 'sin-vendedor').trim().toLowerCase();
    if (!mapa.has(clave)) {
      mapa.set(clave, {
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
      });
    }
    const c = mapa.get(clave)!;
    METODOS.forEach((m) => (c[m] += a[m]));
    c.total += suma;
    c.unidades += a.unidades;
    c.registros++;
  }

  return [...mapa.values()].sort((x, y) => x.vendedor.localeCompare(y.vendedor, 'es'));
}

// ── Fechas en hora de Colombia (UTC-5, sin horario de verano) ──

export interface DiaColombia {
  inicio: Date;
  fin: Date;
  /** AAAA-MM-DD */
  ymd: string;
  diaSemana: number; // 0 = domingo
}

export function diaColombia(offsetDias = 0, base: Date = new Date()): DiaColombia {
  const col = new Date(base.getTime() - 5 * 3600 * 1000);
  const dia = Date.UTC(col.getUTCFullYear(), col.getUTCMonth(), col.getUTCDate() + offsetDias);
  const d = new Date(dia);
  const inicio = new Date(dia + 5 * 3600 * 1000);
  const fin = new Date(inicio.getTime() + 24 * 3600 * 1000 - 1);
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    inicio,
    fin,
    ymd: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`,
    diaSemana: d.getUTCDay(),
  };
}
