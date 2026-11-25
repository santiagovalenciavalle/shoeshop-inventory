import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { DatePickerModule } from 'primeng/datepicker';
import { User, Venta } from '../../../../pages/interfaces';
import { SalesService } from '../../../../services/vendedorServices/ventas/sales.service';
import { CatalogoService } from '../../../../services/catalogo/catalogo.service';
import { ButtonModule } from 'primeng/button';
import { ModalDetallesDevueltosComponent } from './modal-detalles-devueltos/modal-detalles-devueltos.component';
import { DialogModule } from 'primeng/dialog';
import { UsuarioService } from '../../../../services/administracion/usuarios/usuario.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { Observable, Subscription } from 'rxjs';
import { AuthService } from '../../../../services/auth/auth.service';
import {
  cajaDevueltaPorCambio,
  esDevueltaPorCambioConCaja,
} from '../../../../services/vendedorServices/ventas/caja-devuelta.util';

import { IaSpinnerComponent } from '../../../../shared/components/ia-loader/ia-spinner.component';
/** Filtros con los que se abre la pantalla (por ejemplo desde una notificación de la IA). */
export interface FiltroVentaLocalInicial {
  periodo?: 'hoy' | 'semana' | 'mes' | 'anio' | 'dia';
  /** YYYY-MM-DD, junto con periodo 'dia' (también sirve para 'mes' y 'anio'). */
  fecha?: string;
  vendedor?: string;
  codigo?: number;
  precioBajo?: boolean;
}

@Component({
  selector: 'app-venta-local',
  standalone: true,
  imports: [
    IaSpinnerComponent,
    CommonModule,
    FormsModule,
    SelectModule,
    CardModule,
    ButtonModule,
    TableModule,
    DatePickerModule,
    DialogModule,
    ModalDetallesDevueltosComponent,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './venta-local.component.html',
  styleUrls: ['./venta-local.component.css'],
})
export class VentaLocalComponent implements OnChanges, OnInit {
  @Input() localNombre: string = '';
  @Input() filtroInicial: FiltroVentaLocalInicial | null = null;
  /** Muestra solo las ventas por debajo del precio mínimo. */
  soloPrecioBajo = false;
  ventaSeleccionada!: Venta;
  @ViewChild('modalDetalles') modalDetalles!: ModalDetallesDevueltosComponent;

  vendedores: User[] = [];
  localId = '';

  periodoSeleccionado = 'hoy';
  periodos = [
    { label: 'Hoy', value: 'hoy' },
    { label: 'Semana', value: 'semana' },
    { label: 'Mes', value: 'mes' },
    { label: 'Día Específico', value: 'Día específico' },
    { label: 'Año', value: 'año' },
  ];

  fechaMesSeleccionado: Date | null = null;
  fechaSeleccionada: Date | null = null;
  fechaAnioSeleccionado: Date | null = null;

  selectedVenta: any;
  modalVisible = false;

  totalVentas = 0;
  gananciasPropias = 0;
  gananciaOtrosLocales = 0;
  cantidadVentas = 0;
  precioMinimo = 0;
  totalVendidos = 0;
  promedioTicket = 0;

  totalEfectivo = 0;
  totalTransferencia = 0;
  totalSistecredito = 0;
  totalAddi = 0;
  totalBold = 0;

  conteoEfectivo = 0;

  metodosChartData: { label: string; height: number; color: string }[] = [];

  tipoVentaSeleccionado: string | null = null;
  ventaIdFiltro: number | null = null;
  vendedorSeleccionado: string = 'todos';
  opcionesVendedores: { label: string; value: string }[] = [];

  metodoPagoEditado2:
    | 'efectivo'
    | 'transferencia'
    | 'sistecredito'
    | 'addi'
    | 'bold'
    | '' = '';
  precioEditado2: number | null = null;

  ventas: Venta[] = [];
  todasLasVentas: Venta[] = [];
  ventasOtroLocal: Venta[] = [];
  private todasLasVentasGlobal: Venta[] = [];
  editandoVentaId: string | null = null;
  precioEditado: number | null = null;
  metodoPagoEditado: 'efectivo' | 'transferencia' | '' = '';
  ventaAEliminar: Venta | null = null;
  eliminandoVenta = false;
  actualizandoPagoId: string | null = null;
  guardandoVenta = false;

  private readonly USUARIO_ID_RESTRINGIDO = 'PX4yV6UXUuORGnobQdJcbRhnoOG3';
  usuarioActual: any = null;
  esUsuarioRestringido = false;

  constructor(
    private salesService: SalesService,
    private catalogoService: CatalogoService,
    private usuarioService: UsuarioService,
    private cdr: ChangeDetectorRef,
    private messageService: MessageService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.catalogoService.registrar();

    this.usuarioActual = this.authService.getCurrentUser();
    this.esUsuarioRestringido =
      this.usuarioActual?.id === this.USUARIO_ID_RESTRINGIDO;

    if (this.localNombre) {
      this.localId = this.localNombre;
      this.usuarioService.usuarios$.subscribe(() => {
        this.cargarVendedores(false);
        this.catalogoService.getProductos().subscribe((productos) => {
          if (productos.length > 0) this.actualizarVentas();
        });
      });
      this.usuarioService.initUsuarios();
    }
  }

  private async calcularGananciasPropias(ventas: Venta[]): Promise<void> {
    const propias = ventas.filter(
      (v) => (v.tipoVenta || '').trim().toLowerCase() !== 'otro-local',
    );
    const ganancias = await Promise.all(
      propias.map(async (v) => {
        const tipo = (v.tipoVenta || '').trim().toLowerCase();
        if (tipo === 'bono') return 0;
        if (tipo === 'cambio' && !v.esMismoDia) return 0;
        const monto = v.precio;
        const costo = await this.catalogoService.getPrecioAdquisicionPorId(
          v.zapatoId,
        );
        return costo != null ? monto - costo : 0;
      }),
    );
    // Evita pisar el resultado si las ventas cambiaron mientras se calculaba
    if (this.ventas !== ventas) return;
    this.gananciasPropias = ganancias.reduce((a, b) => a + b, 0);
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.catalogoService.desregistrar();
    this.ventasSub?.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      (changes['localNombre'] || changes['filtroInicial']) &&
      this.localNombre
    ) {
      this.localId = this.localNombre;
      this.limpiarFiltros(false);
      this.cargarVendedores();
      this.aplicarFiltroInicial();
      this.actualizarVentas();
    }
  }

  /** Aplica los filtros recibidos por parámetro, sin tocar nada si no hay ninguno. */
  private aplicarFiltroInicial(): void {
    const f = this.filtroInicial;
    if (!f) return;

    const base = f.fecha ? this.fechaDesdeTexto(f.fecha) : null;
    switch (f.periodo) {
      case 'dia':
        this.periodoSeleccionado = 'Día específico';
        this.fechaSeleccionada = base ?? new Date();
        break;
      case 'semana':
        this.periodoSeleccionado = 'semana';
        break;
      case 'mes':
        this.periodoSeleccionado = 'mes';
        this.fechaMesSeleccionado = base;
        break;
      case 'anio':
        this.periodoSeleccionado = 'año';
        this.fechaAnioSeleccionado = base;
        break;
      default:
        this.periodoSeleccionado = 'hoy';
    }
    if (f.vendedor) this.vendedorSeleccionado = f.vendedor;
    if (f.codigo) this.ventaIdFiltro = f.codigo;
    this.soloPrecioBajo = !!f.precioBajo;
  }

  private fechaDesdeTexto(ymd: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  cargarVendedores(resetear = true): void {
    const usuarios = this.usuarioService.getUsuarios();

    this.vendedores = usuarios.filter(
      (u) =>
        (u.role === 'vendedor' || u.role === 'admin') &&
        (this.localNombre === 'todos' || u.local === this.localNombre),
    );

    this.opcionesVendedores = [
      { label: 'Todos', value: 'todos' },
      ...this.vendedores.map((v) => ({ label: v.name, value: v.name })),
    ];
    if (resetear) this.vendedorSeleccionado = 'todos';
    this.cdr.markForCheck();
  }

  private ventasSub: Subscription | null = null;
  /** Ventas anuladas por un cambio posterior cuyo dinero sigue en poder del vendedor. */
  private devueltasCajaGlobal: Venta[] = [];

  actualizarVentas(): void {
    this.ventasSub?.unsubscribe();

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    let fechaInicio: Date;
    let fechaFin: Date;
    let obs$: Observable<Venta[]>;

    switch (this.periodoSeleccionado) {
      case 'Día específico': {
        if (!this.fechaSeleccionada) {
          this.todasLasVentasGlobal = [];
          this.todasLasVentas = [];
          this.devueltasCajaGlobal = [];
          this.aplicarResultado([], null, null);
          return;
        }
        const fecha = new Date(this.fechaSeleccionada);

        fechaInicio = new Date(fecha);
        fechaInicio.setHours(0, 0, 0, 0);

        fechaFin = new Date(fecha);
        fechaFin.setHours(23, 59, 59, 999);

        obs$ = this.salesService.getVentasPorDia$(fecha);
        break;
      }

      case 'semana': {
        fechaInicio = new Date(hoy);
        fechaInicio.setDate(hoy.getDate() - hoy.getDay());
        fechaInicio.setHours(0, 0, 0, 0);
        fechaFin = new Date(fechaInicio);
        fechaFin.setDate(fechaInicio.getDate() + 6);
        fechaFin.setHours(23, 59, 59, 999);
        obs$ = this.salesService.getVentasPorSemana$(fechaInicio, fechaFin);
        break;
      }

      case 'mes': {
        const base = this.fechaMesSeleccionado ?? hoy;
        const mes = base.getMonth();
        const anio = base.getFullYear();
        fechaInicio = new Date(anio, mes, 1);
        fechaFin = new Date(anio, mes + 1, 0);
        obs$ = this.salesService.getVentasPorMes$(base);
        break;
      }

      case 'año': {
        const anio = this.fechaAnioSeleccionado
          ? this.fechaAnioSeleccionado.getFullYear()
          : hoy.getFullYear();
        fechaInicio = new Date(anio, 0, 1);
        fechaFin = new Date(anio, 11, 31);
        obs$ = this.salesService.getVentasPorAnio$(anio);
        break;
      }

      case 'hoy':
      default:
        fechaInicio = new Date(hoy);
        fechaFin = new Date(hoy);
        obs$ = this.salesService.getVentasPorDia$(hoy);
        break;
    }

    this.ventasSub = obs$.subscribe((ventasRaw) => {
      this.devueltasCajaGlobal = ventasRaw
        .filter((v) => esDevueltaPorCambioConCaja(v))
        .map((v) => ({
          ...v,
          fechaVenta: this.convertirFecha(v.fechaVenta),
        }));

      this.todasLasVentasGlobal = ventasRaw
        .filter((v) => {
          const tipo = (v.tipoVenta || '').trim().toLowerCase();
          return !(v.DevueltoBono === true || tipo === 'devuelto por cambio');
        })
        .map((v) => ({
          ...v,
          fechaVenta: this.convertirFecha(v.fechaVenta),
        }));

      this.todasLasVentas =
        this.localId === 'todos'
          ? [...this.todasLasVentasGlobal]
          : this.todasLasVentasGlobal.filter((v) => v.local === this.localId);

      this.aplicarResultado(this.todasLasVentas, fechaInicio, fechaFin);
    });
  }

  private aplicarResultado(
    ventasPeriodo: Venta[],
    fechaInicio: Date | null,
    fechaFin: Date | null,
  ): void {
    const ventasFiltradas = ventasPeriodo.filter((v) => {
      const coincideTipo = this.tipoVentaSeleccionado
        ? (v.metodoPago || '').toLowerCase() ===
          this.tipoVentaSeleccionado.toLowerCase()
        : true;
      const coincideVendedor =
        this.vendedorSeleccionado === 'todos'
          ? true
          : v.vendedor === this.vendedorSeleccionado;
      const coincideCodigo =
        this.ventaIdFiltro != null && this.ventaIdFiltro !== 0
          ? Number(v.zapatoId) === Number(this.ventaIdFiltro)
          : true;
      const coincidePrecio = this.soloPrecioBajo ? !!v.precioBajo : true;
      return (
        coincideTipo && coincideVendedor && coincideCodigo && coincidePrecio
      );
    });

    let ef = 0,
      tr = 0,
      si = 0,
      ad = 0,
      bo = 0;
    let conteoEf = 0;

    ventasFiltradas.forEach((v) => {
      const tipo = (v.tipoVenta || '').toLowerCase();

      if (tipo === 'cambio' && !v.esMismoDia) {
        if (v.metodoExcedente === 'efectivo') {
          ef += Number(v.excedente || 0);
          conteoEf++;
        } else if (v.metodoExcedente === 'transferencia')
          tr += Number(v.excedente || 0);
        else if (v.metodoExcedente === 'sistecredito')
          si += Number(v.excedente || 0);
        else if (v.metodoExcedente === 'addi') ad += Number(v.excedente || 0);
        else if (v.metodoExcedente === 'bold') bo += Number(v.excedente || 0);

        return;
      }

      const pP = v.precioMetodoPrincipal ?? v.precio ?? 0;
      if (v.metodoPago === 'efectivo') {
        ef += pP;
        conteoEf++;
      } else if (v.metodoPago === 'transferencia') tr += pP;
      else if (v.metodoPago === 'sistecredito') si += pP;
      else if (v.metodoPago === 'addi') ad += pP;
      else if (v.metodoPago === 'bold') bo += pP;

      if (v.segundoMetodo) {
        if (v.segundoMetodo.metodo === 'efectivo') ef += v.segundoMetodo.precio;
        else if (v.segundoMetodo.metodo === 'transferencia')
          tr += v.segundoMetodo.precio;
        else if (v.segundoMetodo.metodo === 'sistecredito')
          si += v.segundoMetodo.precio;
        else if (v.segundoMetodo.metodo === 'addi')
          ad += v.segundoMetodo.precio;
        else if (v.segundoMetodo.metodo === 'bold')
          bo += v.segundoMetodo.precio;
      }

      if (tipo === 'cambio' && v.esMismoDia && v.excedente) {
        if (v.metodoExcedente === 'efectivo') {
          ef += Number(v.excedente);
          conteoEf++;
        } else if (v.metodoExcedente === 'transferencia')
          tr += Number(v.excedente);
        else if (v.metodoExcedente === 'sistecredito')
          si += Number(v.excedente);
        else if (v.metodoExcedente === 'addi') ad += Number(v.excedente);
        else if (v.metodoExcedente === 'bold') bo += Number(v.excedente);
      }
    });

    // Dinero de ventas anuladas por un cambio posterior: el vendedor ya lo recibió,
    // así que cuenta en la caja del día en que se vendió (no en unidades).
    let cajaExtra = 0;
    this.devueltasCajaGlobal
      .filter(
        (v) =>
          (this.localId === 'todos' || v.local === this.localId) &&
          (!this.tipoVentaSeleccionado ||
            (v.metodoPago || '').toLowerCase() ===
              this.tipoVentaSeleccionado.toLowerCase()) &&
          (this.vendedorSeleccionado === 'todos' ||
            v.vendedor === this.vendedorSeleccionado) &&
          (this.ventaIdFiltro == null ||
            this.ventaIdFiltro === 0 ||
            Number(v.zapatoId) === Number(this.ventaIdFiltro)),
      )
      .forEach((v) => {
        const caja = cajaDevueltaPorCambio(v);
        ef += caja.efectivo;
        tr += caja.transferencia;
        si += caja.sistecredito;
        ad += caja.addi;
        bo += caja.bold;
        cajaExtra += caja.total;
      });

    this.totalEfectivo = ef;
    this.totalTransferencia = tr;
    this.totalSistecredito = si;
    this.totalAddi = ad;
    this.totalBold = bo;
    this.conteoEfectivo = conteoEf;

    const totalBase = ventasFiltradas.reduce((sum, v) => {
      const tipo = (v.tipoVenta || '').toLowerCase();
      if (tipo === 'cambio')
        return sum + (v.esMismoDia ? v.precio : Number(v.excedente || 0));
      if (tipo === 'bono') return sum + Number(v.excedente || 0);
      return sum + v.precio;
    }, 0);
    this.totalVentas = totalBase + cajaExtra;

    this.precioMinimo = ventasFiltradas.filter((v) => v.precioBajo).length;

    this.totalVendidos = ventasFiltradas.filter((v) => {
      const tipo = (v.tipoVenta || '').toLowerCase();
      return tipo !== 'bono' && !(tipo === 'cambio' && !v.esMismoDia);
    }).length;

    this.cantidadVentas = ventasFiltradas.filter((v) => {
      const tipo = (v.tipoVenta || '').toLowerCase();
      return tipo !== 'cambio' || v.esMismoDia;
    }).length;

    this.promedioTicket =
      this.cantidadVentas > 0
        ? Math.round(totalBase / this.cantidadVentas)
        : 0;

    this.ventas = ventasFiltradas;
    this.calcularGananciasPropias(ventasFiltradas);

    this.ventasOtroLocal = this.todasLasVentasGlobal
      .filter((v) => {
        const tipo = (v.tipoVenta || '').trim().toLowerCase();
        return tipo === 'otro-local';
      })
      .filter((v) => {
        if (!fechaInicio || !fechaFin) return false;
        const fecha = new Date(v.fechaVenta);
        fecha.setHours(0, 0, 0, 0);
        return fecha >= fechaInicio && fecha <= fechaFin;
      })
      .filter((v) => {
        const coincideVendedor =
          this.vendedorSeleccionado === 'todos'
            ? true
            : v.vendedor === this.vendedorSeleccionado;
        const coincideCodigo =
          this.ventaIdFiltro != null && this.ventaIdFiltro !== 0
            ? Number(v.zapatoId) === Number(this.ventaIdFiltro)
            : true;
        return coincideVendedor && coincideCodigo;
      });

    this.gananciaOtrosLocales = this.ventasOtroLocal.reduce(
      (sum, v) => sum + (Number(v.precio) || 0) - (Number(v.precioCompra) || 0),
      0,
    );

    this.buildChartData();
    this.cdr.markForCheck();
  }

  private buildChartData(): void {
    const maxVal = Math.max(
      this.totalEfectivo,
      this.totalTransferencia,
      this.totalSistecredito,
      this.totalAddi,
      this.totalBold,
      1,
    );
    const MAX_H = 44;

    this.metodosChartData = [
      {
        label: 'Efect.',
        height: Math.round((this.totalEfectivo / maxVal) * MAX_H),
        color: '#10b981',
      },
      {
        label: 'Transf.',
        height: Math.round((this.totalTransferencia / maxVal) * MAX_H),
        color: '#3b82f6',
      },
      {
        label: 'Sistec.',
        height: Math.round((this.totalSistecredito / maxVal) * MAX_H),
        color: '#a855f7',
      },
      {
        label: 'Addi',
        height: Math.round((this.totalAddi / maxVal) * MAX_H),
        color: '#f97316',
      },
      {
        label: 'Bold',
        height: Math.round((this.totalBold / maxVal) * MAX_H),
        color: '#e90e0e',
      },
    ];
  }

  convertirFecha(fecha: any): Date {
    if (fecha && fecha.seconds) return new Date(fecha.seconds * 1000);
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  abrirEdicion(venta: Venta): void {
    this.editandoVentaId = venta.id || null;
    this.precioEditado = venta.precioMetodoPrincipal ?? venta.precio ?? null;
    this.metodoPagoEditado = (venta.metodoPago as any) ?? '';
    if (venta.segundoMetodo) {
      this.precioEditado2 = venta.segundoMetodo.precio ?? null;
      this.metodoPagoEditado2 = (venta.segundoMetodo.metodo as any) ?? '';
    } else {
      this.precioEditado2 = null;
      this.metodoPagoEditado2 = '';
    }
  }

  cancelarEdicion(): void {
    this.editandoVentaId = null;
    this.precioEditado = null;
    this.metodoPagoEditado = '';
  }

  async guardarEdicion(venta: Venta): Promise<void> {
    if (!this.editandoVentaId) return;
    if (this.precioEditado == null || this.precioEditado <= 0) return;
    if (!this.metodoPagoEditado) return;
    if (venta.segundoMetodo) {
      if (this.precioEditado2 == null || this.precioEditado2 < 0) return;
      if (!this.metodoPagoEditado2) return;
    }

    const datosActualizados: Partial<Venta> = {
      precio: venta.segundoMetodo
        ? Number(this.precioEditado) + Number(this.precioEditado2)
        : Number(this.precioEditado),
      precioMetodoPrincipal: Number(this.precioEditado),
      metodoPago: this.metodoPagoEditado,
      segundoMetodo: venta.segundoMetodo
        ? {
            precio: Number(this.precioEditado2),
            metodo: this.metodoPagoEditado2,
          }
        : undefined,
    };

    this.guardandoVenta = true;
    const ok = await this.salesService.actualizarVentaPorId(
      this.editandoVentaId,
      datosActualizados,
    );
    this.guardandoVenta = false;
    if (ok) {
      this.cancelarEdicion();
      this.actualizarVentas();
    }
  }

  confirmarEliminar(venta: Venta): void {
    this.ventaAEliminar = venta;
  }

  cancelarEliminar(): void {
    this.ventaAEliminar = null;
  }

  async eliminarVentaConfirmada(): Promise<void> {
    if (!this.ventaAEliminar?.id || this.eliminandoVenta) return;
    this.eliminandoVenta = true;
    const ok = await this.salesService.eliminarVentaPorCampoId(
      this.ventaAEliminar.id,
    );
    this.eliminandoVenta = false;
    if (ok) {
      this.messageService.add({
        severity: 'success',
        summary: 'Venta eliminada',
        detail: 'La venta se eliminó correctamente.',
        life: 3000,
      });
      this.ventaAEliminar = null;
      this.actualizarVentas();
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo eliminar la venta.',
        life: 4000,
      });
    }
  }

  async togglePagado(v: Venta): Promise<void> {
    if (!v.id || this.actualizandoPagoId === v.id) return;

    const nuevoEstado = !v.pagado;
    this.actualizandoPagoId = v.id;

    const ok = await this.salesService.actualizarVentaPorId(v.id, {
      pagado: nuevoEstado,
    });

    this.actualizandoPagoId = null;

    if (ok) {
      v.pagado = nuevoEstado;
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo actualizar el estado de pago.',
        life: 4000,
      });
    }
  }

  abrirModal(venta: any): void {
    this.selectedVenta = venta;
    this.modalVisible = true;
  }

  cerrarModal(): void {
    this.modalVisible = false;
    this.selectedVenta = null;
  }

  verDetalles(venta: Venta): void {
    this.ventaSeleccionada = venta;
    setTimeout(() => this.modalDetalles?.mostrar(), 0);
  }

  limpiarFiltros(actualizar = true): void {
    this.soloPrecioBajo = false;
    this.periodoSeleccionado = 'hoy';
    this.fechaSeleccionada = null;
    this.fechaMesSeleccionado = null;
    this.fechaAnioSeleccionado = null;
    this.tipoVentaSeleccionado = null;
    this.ventaIdFiltro = null;
    this.vendedorSeleccionado = 'todos';
    if (actualizar) this.actualizarVentas();
  }
}
