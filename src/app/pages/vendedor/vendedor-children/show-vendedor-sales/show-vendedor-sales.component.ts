import {
  ChangeDetectorRef,
  Component,
  Inject,
  LOCALE_ID,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
import { CardModule } from 'primeng/card';
import { RouterModule } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { VentaDetallesDialogComponent } from '../venta-detalles-dialog/venta-detalles-dialog.component';
import localeEs from '@angular/common/locales/es';
import { PaginatorModule } from 'primeng/paginator';
import { Venta } from '../../../interfaces';
import { SalesService } from '../../../../services/vendedorServices/ventas/sales.service';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { AuthService } from '../../../../services/auth/auth.service';
import { Subscription } from 'rxjs';
import {
  cajaDevueltaPorCambio,
  esDevueltaPorCambioConCaja,
} from '../../../../services/vendedorServices/ventas/caja-devuelta.util';

registerLocaleData(localeEs, 'es-ES');

type ModoFiltro = 'dia' | 'semana' | 'mes';

@Component({
  selector: 'app-show-vendedor-sales',
  standalone: true,
  templateUrl: './show-vendedor-sales.component.html',
  styleUrls: ['./show-vendedor-sales.component.css'],
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    DropdownModule,
    ButtonModule,
    InputTextModule,
    RouterModule,
    ReactiveFormsModule,
    DatePickerModule,
    CardModule,
    DialogModule,
    VentaDetallesDialogComponent,
    PaginatorModule,
    ProgressSpinnerModule,
  ],
})
export class ShowVendedorSalesComponent implements OnInit, OnDestroy {
  ventas: (Venta & { expanded?: boolean })[] = [];
  ventasFiltradas: (Venta & { expanded?: boolean })[] = [];
  /** Ventas anuladas por un cambio posterior cuyo dinero sigue en poder del vendedor. */
  private devueltasCaja: Venta[] = [];
  private devueltasCajaFiltradas: Venta[] = [];

  isCargando: boolean = true;
  modoFiltro: ModoFiltro = 'dia';
  user: string = '';

  fechaSeleccionada: Date = new Date();
  semanaSeleccionada: Date = new Date();
  deseada;
  mesSeleccionado: Date = new Date();

  filtroBusqueda: string = '';

  totalEfectivo: number = 0;
  totalTransferencia: number = 0;
  totalSistecredito: number = 0;
  totalAddi: number = 0;
  totalBold: number = 0;
  totalVentas: number = 0;
  cantidadVentas: number = 0;
  totalVendidos: number = 0;
  precioMinimo: number = 0;

  ventaSeleccionada: any = null;
  mostrarDialogo: boolean = false;

  private ventasSub!: Subscription;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private salesService: SalesService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const usuario = this.authService.getCurrentUser();
    this.user = usuario?.name ?? 'Desconocido';
    this.consultarFirebase();
    this.scrollToTop();
  }

  ngOnDestroy(): void {
    this.ventasSub?.unsubscribe();
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private consultarFirebase(): void {
    this.ventasSub?.unsubscribe();
    this.isCargando = true;
    this.ventas = [];
    this.ventasFiltradas = [];
    this.cdr.detectChanges();

    const inicio = performance.now();

    let obs$;

    if (this.modoFiltro === 'dia') {
      obs$ = this.salesService.getVentasPorDia$(this.fechaSeleccionada);
    } else if (this.modoFiltro === 'semana') {
      const { domingo, sabado } = this.getSemana(this.semanaSeleccionada);
      obs$ = this.salesService.getVentasPorSemana$(domingo, sabado);
    } else {
      obs$ = this.salesService.getVentasPorMes$(this.mesSeleccionado);
    }

    this.ventasSub = obs$.subscribe({
      next: (ventas) => {
        const elapsed = performance.now() - inicio;
        const espera = Math.max(0, 1000 - elapsed);

        setTimeout(() => {
          this.devueltasCaja = ventas
            .filter((v) => esDevueltaPorCambioConCaja(v))
            .map((v) => ({
              ...v,
              fechaVenta: this.convertTimestampToDate(v.fechaVenta),
            }));

          this.ventas = ventas
            .filter((v) => v.tipoVenta !== 'Devuelto por cambio')
            .map((v) => ({
              ...v,
              fechaVenta: this.convertTimestampToDate(v.fechaVenta),
              expanded: false,
            }))
            .sort(
              (a, b) =>
                new Date(b.fechaVenta).getTime() -
                new Date(a.fechaVenta).getTime(),
            );

          this.aplicarFiltroBusqueda();
          this.isCargando = false;
          this.cdr.detectChanges();
        }, espera);
      },
      error: (err) => {
        console.error('Error al cargar ventas:', err);
        this.isCargando = false;
        this.cdr.detectChanges();
      },
    });
  }

  onFechaDiaChange(fecha: Date | null): void {
    if (!fecha) return;
    this.fechaSeleccionada = fecha;
    this.modoFiltro = 'dia';
    this.consultarFirebase();
  }

  onSemanaChange(fecha: Date | null): void {
    if (!fecha) return;
    this.semanaSeleccionada = fecha;
    this.modoFiltro = 'semana';
    this.consultarFirebase();
  }

  filtrarPorSemanaActual(): void {
    this.semanaSeleccionada = new Date();
    this.modoFiltro = 'semana';
    this.consultarFirebase();
  }

  onMesChange(mes: Date | null): void {
    if (!mes) return;
    this.mesSeleccionado = mes;
    this.modoFiltro = 'mes';
    this.consultarFirebase();
  }

  filtrarVentas(): void {
    this.aplicarFiltroBusqueda();
  }

  private aplicarFiltroBusqueda(): void {
    const usuario = this.authService.getCurrentUser();

    let resultado = usuario
      ? this.ventas.filter((v) => v.vendedorId === usuario.id)
      : [...this.ventas];

    if (this.filtroBusqueda.trim()) {
      const busqueda = this.filtroBusqueda.toLowerCase();
      resultado = resultado.filter(
        (v) =>
          v.marca?.toLowerCase().includes(busqueda) ||
          v.referencia?.toLowerCase().includes(busqueda),
      );
    }

    this.devueltasCajaFiltradas = this.devueltasCaja.filter((v) => {
      if (usuario && v.vendedorId !== usuario.id) return false;
      if (!this.filtroBusqueda.trim()) return true;
      const busqueda = this.filtroBusqueda.toLowerCase();
      return (
        v.marca?.toLowerCase().includes(busqueda) ||
        v.referencia?.toLowerCase().includes(busqueda)
      );
    });

    this.ventasFiltradas = resultado;
    this.actualizarTotales();
  }

  eliminarFiltros(): void {
    this.fechaSeleccionada = new Date();
    this.semanaSeleccionada = new Date();
    this.mesSeleccionado = new Date();
    this.filtroBusqueda = '';
    this.modoFiltro = 'dia';
    this.consultarFirebase();
  }

  getSemana(fecha: Date): { domingo: Date; sabado: Date } {
    const dia = fecha.getDay();
    const domingo = new Date(fecha);
    domingo.setDate(fecha.getDate() - dia);
    domingo.setHours(0, 0, 0, 0);

    const sabado = new Date(domingo);
    sabado.setDate(domingo.getDate() + 6);
    sabado.setHours(23, 59, 59, 999);

    return { domingo, sabado };
  }

  get labelPeriodo(): string {
    if (this.modoFiltro === 'dia') {
      return this.fechaSeleccionada.toLocaleDateString('es-CO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
    }
    if (this.modoFiltro === 'semana') {
      const { domingo, sabado } = this.getSemana(this.semanaSeleccionada);
      return `${domingo.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} — ${sabado.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`;
    }
    return this.mesSeleccionado.toLocaleDateString('es-CO', {
      month: 'long',
      year: 'numeric',
    });
  }

  actualizarTotales(): void {
    let totalEfectivo = 0;
    let totalTransferencia = 0;
    let totalSistecredito = 0;
    let totalAddi = 0;
    let totalBold = 0;
    let totalVentas = 0;
    let totalVendidos = 0;
    let precioMinimo = 0;

    this.ventasFiltradas.forEach((v) => {
      const tipo = (v.tipoVenta || '').toLowerCase();
      const precioPrincipal = v.precioMetodoPrincipal ?? v.precio ?? 0;

      if (tipo === 'cambio' && !v.esMismoDia) {
        if (v.metodoExcedente === 'efectivo')
          totalEfectivo += Number(v.excedente || 0);
        else if (v.metodoExcedente === 'transferencia')
          totalTransferencia += Number(v.excedente || 0);
        else if (v.metodoExcedente === 'sistecredito')
          totalSistecredito += Number(v.excedente || 0);
        else if (v.metodoExcedente === 'addi')
          totalAddi += Number(v.excedente || 0);
        else if (v.metodoExcedente === 'bold')
          totalBold += Number(v.excedente || 0);
      } else {
        if (v.metodoPago === 'efectivo') totalEfectivo += precioPrincipal;
        else if (v.metodoPago === 'transferencia')
          totalTransferencia += precioPrincipal;
        else if (v.metodoPago === 'sistecredito')
          totalSistecredito += precioPrincipal;
        else if (v.metodoPago === 'addi') totalAddi += precioPrincipal;
        else if (v.metodoPago === 'bold') totalBold += precioPrincipal;

        if (v.segundoMetodo) {
          if (v.segundoMetodo.metodo === 'efectivo')
            totalEfectivo += v.segundoMetodo.precio;
          else if (v.segundoMetodo.metodo === 'transferencia')
            totalTransferencia += v.segundoMetodo.precio;
          else if (v.segundoMetodo.metodo === 'sistecredito')
            totalSistecredito += v.segundoMetodo.precio;
          else if (v.segundoMetodo.metodo === 'addi')
            totalAddi += v.segundoMetodo.precio;
          else if (v.segundoMetodo.metodo === 'bold')
            totalBold += v.segundoMetodo.precio;
        }

        if (tipo === 'cambio' && v.esMismoDia && v.excedente) {
          if (v.metodoExcedente === 'efectivo')
            totalEfectivo += Number(v.excedente);
          else if (v.metodoExcedente === 'transferencia')
            totalTransferencia += Number(v.excedente);
          else if (v.metodoExcedente === 'sistecredito')
            totalSistecredito += Number(v.excedente);
          else if (v.metodoExcedente === 'addi')
            totalAddi += Number(v.excedente);
          else if (v.metodoExcedente === 'bold')
            totalBold += Number(v.excedente);
        }
      }

      let totalVenta = 0;
      if (tipo === 'cambio' && !v.esMismoDia) {
        totalVenta += Number(v.excedente || 0);
      } else {
        totalVenta += precioPrincipal;
        if (v.segundoMetodo) totalVenta += v.segundoMetodo.precio;
        if (tipo === 'cambio' && v.esMismoDia && v.excedente)
          totalVenta += Number(v.excedente);
      }

      totalVentas += totalVenta;
      if (v.precioBajo) precioMinimo++;
      if (tipo !== 'bono' && (tipo !== 'cambio' || v.esMismoDia))
        totalVendidos++;
    });

    // Dinero de ventas anuladas por un cambio posterior: el vendedor ya lo recibió,
    // así que cuenta en la caja del día en que se vendió (no en unidades).
    this.devueltasCajaFiltradas.forEach((v) => {
      const caja = cajaDevueltaPorCambio(v);
      totalEfectivo += caja.efectivo;
      totalTransferencia += caja.transferencia;
      totalSistecredito += caja.sistecredito;
      totalAddi += caja.addi;
      totalBold += caja.bold;
      totalVentas += caja.total;
    });

    this.totalEfectivo = totalEfectivo;
    this.totalTransferencia = totalTransferencia;
    this.totalSistecredito = totalSistecredito;
    this.totalAddi = totalAddi;
    this.totalBold = totalBold;
    this.totalVentas = totalVentas;
    this.totalVendidos = totalVendidos;
    this.precioMinimo = precioMinimo;
    this.cantidadVentas = this.ventasFiltradas.filter(
      (v) => v.tipoVenta?.toLowerCase() !== 'cambio' || v.esMismoDia,
    ).length;
  }

  convertTimestampToDate(timestamp: any): Date {
    if (timestamp?.seconds !== undefined)
      return new Date(timestamp.seconds * 1000);
    if (typeof timestamp === 'string' || typeof timestamp === 'number')
      return new Date(timestamp);
    return new Date('Invalid Date');
  }

  abrirDetalles(venta: any): void {
    this.ventaSeleccionada = venta;
    this.mostrarDialogo = true;
    this.cdr.detectChanges();
  }

  cerrarDialogo(): void {
    this.mostrarDialogo = false;
    this.cdr.detectChanges();
  }

  generarLinkWhatsApp(venta: Venta): string {
    return this.salesService.generarLinkWhatsApp(venta);
  }
}
