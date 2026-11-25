import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  OnDestroy,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ImageModule } from 'primeng/image';
import { DatePickerModule } from 'primeng/datepicker';
import { Venta } from '../../../../pages/interfaces';
import { SalesService } from '../../../../services/vendedorServices/ventas/sales.service';
import { Timestamp } from 'firebase/firestore';
import { AuthService } from '../../../../services/auth/auth.service';
import { Subscription } from 'rxjs';

import { IaSpinnerComponent } from '../../../../shared/components/ia-loader/ia-spinner.component';
@Component({
  selector: 'app-modal-buscar-producto',
  standalone: true,
  imports: [
    IaSpinnerComponent,
    CommonModule,
    FormsModule,
    InputTextModule,
    ButtonModule,
    ImageModule,
    DatePickerModule,
  ],
  templateUrl: './modal-buscar-producto.component.html',
  styleUrl: './modal-buscar-producto.component.css',
})
export class ModalBuscarProductoComponent implements OnDestroy {
  @Output() productoSeleccionado = new EventEmitter<Venta | null>();

  search: string = '';
  fechaSeleccionada: Date = new Date();
  ventas: Venta[] = [];
  cargando: boolean = false;

  private ventasSub: Subscription | null = null;
  private usuarioId: string | null = null;

  constructor(
    private salesService: SalesService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    const usuario = this.authService.getCurrentUser();

    if (!usuario || !usuario.id) {
      console.warn('No hay usuario autenticado');
      this.ventas = [];
      return;
    }

    this.usuarioId = usuario.id;

    this.cargarVentasPorFecha(this.fechaSeleccionada);
  }

  ngOnDestroy(): void {
    this.ventasSub?.unsubscribe();
  }

  onFechaChange(fecha: Date | null): void {
    if (!fecha) return;
    this.fechaSeleccionada = fecha;
    this.cargarVentasPorFecha(fecha);
  }

  private cargarVentasPorFecha(fecha: Date): void {
    if (!this.usuarioId) return;

    this.ventasSub?.unsubscribe();

    const inicio = new Date(
      fecha.getFullYear(),
      fecha.getMonth(),
      fecha.getDate(),
      0,
      0,
      0,
      0,
    );
    const fin = new Date(
      fecha.getFullYear(),
      fecha.getMonth(),
      fecha.getDate(),
      23,
      59,
      59,
      999,
    );

    this.cargando = true;
    this.ventas = [];

    this.ventasSub = this.salesService
      .getVentasPorRangoFecha(inicio, fin)
      .subscribe({
        next: (ventas) => {
          this.ventas = ventas
            .filter((venta) => venta.vendedorId === this.usuarioId)
            .map((venta) => ({
              ...venta,
              fechaVenta: this.convertirFecha(venta.fechaVenta),
            }));

          setTimeout(() => {
            this.cargando = false;
          }, 1500);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error al obtener ventas por fecha', err);
          this.cargando = false;
          this.cdr.detectChanges();
        },
      });
  }

  private convertirFecha(fecha: Date | Timestamp | null): Date | null {
    if (!fecha) return null;
    if (fecha instanceof Timestamp) return fecha.toDate();
    if (fecha instanceof Date) return fecha;
    return null;
  }

  get ventasFiltradas(): Venta[] {
    let resultado = this.ventas.filter(
      (v) =>
        !v.DevueltoBono &&
        v.tipoVenta !== 'Devuelto por cambio' &&
        v.tipoVenta !== 'Devuelto por bono' &&
        v.tipoVenta !== 'Bono',
    );

    if (this.search.trim()) {
      const filtro = this.search.toLowerCase();
      resultado = resultado.filter(
        (v) =>
          v.marca.toLowerCase().includes(filtro) ||
          v.referencia.toLowerCase().includes(filtro) ||
          String(v.id).includes(filtro),
      );
    }

    return resultado;
  }

  getFecha(venta: Venta): Date | null {
    return this.convertirFecha(venta.fechaVenta);
  }

  seleccionar(venta: Venta) {
    this.productoSeleccionado.emit(venta);
  }

  cancelar(): void {
    this.limpiarFiltros();
    this.productoSeleccionado.emit(null);
  }

  limpiarFiltros(): void {
    this.search = '';
    const hoy = new Date();
    this.fechaSeleccionada = hoy;
    this.cargarVentasPorFecha(hoy);
  }
}
