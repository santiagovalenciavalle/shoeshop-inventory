import { Injectable, inject } from '@angular/core';
import { Venta } from '../../../pages/interfaces';
import { CatalogoService } from '../../catalogo/catalogo.service';

export interface ResumenFinanciero {
  ingresos: number;
  costos: number;
  ganancias: number;
  unidades: number;
}

@Injectable({ providedIn: 'root' })
export class FinanzasService {
  private catalogoService = inject(CatalogoService);

  obtenerMonto(venta: Venta): number {
    if (venta.tipoVenta === 'Cambio' && !venta.esMismoDia) {
      return Number(venta.excedente || 0);
    }
    if (venta.tipoVenta === 'Cambio' && venta.esMismoDia) {
      return venta.precio;
    }
    if (venta.tipoVenta === 'Bono') {
      return Number(venta.excedente || 0);
    }
    return venta.precio;
  }

  cuentaComoUnidad(venta: Venta): boolean {
    if (venta.tipoVenta === 'Cambio' && !venta.esMismoDia) return false;
    if (venta.tipoVenta === 'Bono') return false;
    return true;
  }

  async calcularGanancia(venta: Venta): Promise<number> {
    if (venta.tipoVenta === 'Bono') return 0;
    if (venta.tipoVenta === 'Cambio' && !venta.esMismoDia) return 0;

    const monto = this.obtenerMonto(venta);
    const precioAdquisicion =
      await this.catalogoService.getPrecioAdquisicionPorId(venta.zapatoId);

    return precioAdquisicion != null ? monto - precioAdquisicion : 0;
  }

  async calcularResumen(ventas: Venta[]): Promise<ResumenFinanciero> {
    const ventasValidas = ventas.filter(
      (v) =>
        v.tipoVenta !== 'Devuelto por cambio' &&
        v.tipoVenta !== 'Devuelto por bono',
    );

    let ingresos = 0;
    let costos = 0;
    let unidades = 0;

    await Promise.all(
      ventasValidas.map(async (venta) => {
        const monto = this.obtenerMonto(venta);
        const ganancia = await this.calcularGanancia(venta);
        const costo = monto - ganancia;

        ingresos += monto;
        costos += costo > 0 ? costo : 0;
        if (this.cuentaComoUnidad(venta)) unidades++;
      }),
    );

    return {
      ingresos,
      costos,
      ganancias: ingresos - costos,
      unidades,
    };
  }
}
