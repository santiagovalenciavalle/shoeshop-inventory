import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  ChangeDetectorRef,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { RippleModule } from 'primeng/ripple';
import { SalesService } from '../../../services/vendedorServices/ventas/sales.service';

import { IaLoaderComponent } from '../../../shared/components/ia-loader/ia-loader.component';
@Component({
  selector: 'app-modal-ventas',
  standalone: true,
  imports: [
    IaLoaderComponent,CommonModule, DialogModule, TagModule, DividerModule, RippleModule],
  templateUrl: './modal-ventas.component.html',
  styleUrl: './modal-ventas.component.css',
})
export class ModalVentasComponent implements OnChanges {
  @Input() visible: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Input() producto: any;

  ventas: any[] = [];
  loading: boolean = true;

  constructor(
    private salesService: SalesService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (
      this.visible &&
      this.producto?.id &&
      (changes['producto'] || changes['visible'])
    ) {
      this.cargarVentas();
    }
  }

  async cargarVentas() {
    if (!this.producto?.id) {
      console.warn('⚠️ No hay producto seleccionado');
      this.loading = false;
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();

    try {
      const ventas = await this.salesService.obtenerVentasPorZapatoId(
        this.producto.id,
      );
      const ventasOrdenadas = (ventas || [])
        .filter(
          (venta: any) =>
            venta.tipoVenta !== 'Devuelto por bono' &&
            venta.tipoVenta !== 'Devuelto por cambio',
        )
        .sort(
          (a: any, b: any) =>
            new Date(b.fechaVenta).getTime() - new Date(a.fechaVenta).getTime(),
        );

      this.ngZone.run(() => {
        this.ventas = ventasOrdenadas;
      });
    } catch (error) {
      console.error('❌ Error al cargar ventas:', error);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
  cerrar() {
    this.close.emit();
  }

  formatearFecha(fecha: any): string {
    const date = fecha?.toDate ? fecha.toDate() : new Date(fecha);

    const fechaLocal = new Date(
      date.getTime() - date.getTimezoneOffset() * 60000,
    );

    return fechaLocal.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Bogota',
    });
  }

  ventasAgrupadasPorFecha() {
    const gruposMap: { [key: string]: any[] } = {};

    this.ventas.forEach((venta) => {
      const fecha = venta.fechaVenta?.toDate
        ? venta.fechaVenta.toDate()
        : new Date(venta.fechaVenta);

      if (isNaN(fecha.getTime())) {
        console.warn('Fecha inválida encontrada:', venta.fechaVenta);
        return;
      }

      const fechaLocal = new Date(
        fecha.getTime() - fecha.getTimezoneOffset() * 60000,
      );

      fechaLocal.setHours(0, 0, 0, 0);

      fechaLocal.setDate(fechaLocal.getDate() + 1);

      const fechaKey = fechaLocal.toISOString().split('T')[0];

      if (!gruposMap[fechaKey]) {
        gruposMap[fechaKey] = [];
      }
      gruposMap[fechaKey].push(venta);
    });

    const grupos = Object.keys(gruposMap)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map((key) => ({
        fecha: new Date(key).toLocaleDateString('es-CO', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          timeZone: 'America/Bogota',
        }),
        ventas: gruposMap[key],
      }));

    return grupos;
  }

  totalVentas() {
    return this.ventas.reduce((acc, venta) => acc + (venta.precio || 0), 0);
  }
}
