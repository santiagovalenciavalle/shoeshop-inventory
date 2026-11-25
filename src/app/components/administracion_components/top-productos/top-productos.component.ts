import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { Venta } from '../../../pages/interfaces';

interface ProductoResumen {
  referencia: string;
  marca: string;
  imagen: string;
  unidadesVendidas: number;
  totalAcumulado: number;
}

@Component({
  selector: 'app-top-productos',
  imports: [CommonModule],
  templateUrl: './top-productos.component.html',
  styleUrl: './top-productos.component.css',
})
export class TopProductosComponent implements OnChanges {
  @Input() ventas: Venta[] = [];

  topProductos: ProductoResumen[] = [];

  ngOnChanges(): void {
    if (!this.ventas || this.ventas.length === 0) {
      this.topProductos = [];
      return;
    }

    const ventasValidas = this.ventas.filter((venta) => {
      const tipoVentaNormalizado = (venta.tipoVenta || '').trim().toLowerCase();
      const esDevuelta =
        venta.DevueltoBono === true ||
        tipoVentaNormalizado === 'devuelto por cambio';
      return !esDevuelta;
    });

    const resumenMap: Record<string, ProductoResumen> = {};

    ventasValidas.forEach((venta) => {
      const key = venta.referencia;

      if (!resumenMap[key]) {
        resumenMap[key] = {
          referencia: venta.referencia,
          marca: venta.marca,
          imagen: venta.imagen,
          unidadesVendidas: 0,
          totalAcumulado: 0,
        };
      }

      resumenMap[key].unidadesVendidas += 1;
      resumenMap[key].totalAcumulado += venta.precio ?? 0;
    });

    this.topProductos = Object.values(resumenMap)
      .sort((a, b) => b.unidadesVendidas - a.unidadesVendidas)
      .slice(0, 3);
  }
}
