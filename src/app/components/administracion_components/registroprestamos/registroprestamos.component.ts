import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { Pedido, Prestamo, User, Venta } from '../../../pages/interfaces';
import { PrestamosService } from '../../../services/vendedorServices/prestamos/prestamos.service';
import { LocalesService } from '../../../services/locales/locales.service';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogService } from 'primeng/dynamicdialog';
import { ModalVentaComponent } from '../../../pages/vendedor/vendedor-children/mis-pedidos/modal-venta/modal-venta.component';
import { CatalogoService } from '../../../services/catalogo/catalogo.service';
import { AuthService } from '../../../services/auth/auth.service';
import { SalesService } from '../../../services/vendedorServices/ventas/sales.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { UsuarioService } from '../../../services/administracion/usuarios/usuario.service';
import { OrderService } from '../../../services/vendedorServices/order.service';
import {
  collection,
  doc,
  Firestore,
  writeBatch,
} from '@angular/fire/firestore';

interface LocalBarData {
  local: string;
  cantidad: number;
  porcentaje: number;
}

interface GrupoPrestamos {
  claveFecha: string;
  fecha: Date;
  etiqueta: string;
  esHoy: boolean;
  esAyer: boolean;
  prestamos: Prestamo[];
  totalValor: number;
  totalUnidades: number;
  barraLocales: LocalBarData[];
}

@Component({
  selector: 'app-registroprestamos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    TagModule,
    SelectModule,
    DialogModule,
    RouterModule,
    DatePickerModule,
    ModalVentaComponent,
    ToastModule,
  ],
  templateUrl: './registroprestamos.component.html',
  styleUrl: './registroprestamos.component.css',
  providers: [DialogService, MessageService],
})
export class RegistroprestamosComponent {
  prestamos: Prestamo[] = [];
  prestamosFiltrados: Prestamo[] = [];
  gruposPrestamos: GrupoPrestamos[] = [];
  filtroFecha: Date | null = null;

  localesDisponibles: { label: string; value: string }[] = [];
  filtroLocal: string = '';
  prestamoSeleccionado!: Prestamo;
  nombreVendedor: any;
  modalVisible: boolean = false;
  detalleSeleccionado: Prestamo | null = null;
  mostrarModalVenta: boolean = false;
  vendedoresDisponibles: User[] = [];
  filtroVendedor: string = '';
  botonesDeshabilitados = new Set<string>();
  mostrarConfirmacion: boolean = false;
  prestamoADevolver!: Prestamo;
  mostrarBotonScroll = false;
  loadingPantalla = true;
  tipoDevolucion: 'bodega' | 'local' = 'bodega';
  get valorTotalFiltrado(): number {
    return this.prestamosFiltrados.reduce((acc, p) => acc + (p.precio || 0), 0);
  }

  private paletaBarras = [
    'bg-amber-500',
    'bg-slate-400',
    'bg-amber-300',
    'bg-slate-500',
    'bg-amber-700',
    'bg-slate-300',
  ];

  constructor(
    private prestamosService: PrestamosService,
    private localesService: LocalesService,
    private catalogoService: CatalogoService,
    private authService: AuthService,
    private salesService: SalesService,
    private cd: ChangeDetectorRef,
    private usuarioService: UsuarioService,
    private messageService: MessageService,
    private orderService: OrderService,
    private firestore: Firestore,
  ) {}

  ngOnInit(): void {
    this.scrollToTop();
    this.localesService.registrar();
    this.prestamosService.registrar();
    this.orderService.registrar();
    this.catalogoService.registrar();

    window.addEventListener('scroll', this.onScroll, true);

    this.scrollToTop();
    this.usuarioService.initUsuarios();

    this.usuarioService.usuarios$.subscribe((usuarios) => {
      this.vendedoresDisponibles = usuarios.filter(
        (u) => u.role === 'vendedor' || u.role === 'admin',
      );
      this.cd.detectChanges();
    });

    this.nombreVendedor = this.authService.getCurrentUser();

    this.localesService.obtenerLocales().subscribe((locales) => {
      this.localesDisponibles = locales.map((local) => ({
        label: local.nombre,
        value: local.nombre,
      }));
      this.cd.detectChanges();
    });

    this.prestamosService.getPrestamos$().subscribe((data) => {
      this.prestamos = data
        .map((p) => ({
          ...p,
          fechaPrestamo: this.parseFirestoreDate(p.fechaPrestamo),
        }))
        .sort((a, b) => {
          const fechaA = a.fechaPrestamo?.getTime() ?? 0;
          const fechaB = b.fechaPrestamo?.getTime() ?? 0;
          return fechaB - fechaA;
        });

      setTimeout(() => {
        this.loadingPantalla = false;
      }, 1500);

      this.filtrarPrestamos();
      this.cd.detectChanges();
    });
    this.scrollToTop();
  }

  scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  ngOnDestroy() {
    this.localesService.desregistrar();
    this.prestamosService.desregistrar();
    window.removeEventListener('scroll', this.onScroll, true);
    this.catalogoService.desregistrar();
    this.orderService.desregistrar();
  }

  onScroll = (): void => {
    this.mostrarBotonScroll = window.scrollY > 300;
  };

  private parseFirestoreDate(value: any): Date | undefined {
    return value?.toDate
      ? value.toDate()
      : value instanceof Date
        ? value
        : undefined;
  }

  filtrarPrestamos(): void {
    this.prestamosFiltrados = this.prestamos
      .filter((p) => {
        const coincideLocal = this.filtroLocal
          ? p.localInicio === this.filtroLocal
          : true;

        const coincideFecha = this.filtroFecha
          ? this.mismaFecha(p.fechaPrestamo, this.filtroFecha)
          : true;

        const coincideVendedor = this.filtroVendedor
          ? p.vendedor === this.filtroVendedor
          : true;

        return coincideLocal && coincideFecha && coincideVendedor;
      })
      .sort((a, b) => {
        const fechaA = a.fechaPrestamo?.getTime() ?? 0;
        const fechaB = b.fechaPrestamo?.getTime() ?? 0;
        return fechaB - fechaA;
      });

    this.construirGrupos();
  }

  private construirGrupos(): void {
    const mapa = new Map<string, Prestamo[]>();

    for (const prestamo of this.prestamosFiltrados) {
      if (!prestamo.fechaPrestamo) continue;
      const clave = this.claveDia(prestamo.fechaPrestamo);
      if (!mapa.has(clave)) {
        mapa.set(clave, []);
      }
      mapa.get(clave)!.push(prestamo);
    }

    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);

    const grupos: GrupoPrestamos[] = Array.from(mapa.entries()).map(
      ([clave, prestamosDia]) => {
        const fecha = prestamosDia[0].fechaPrestamo;
        const esHoy = this.mismaFecha(fecha, hoy);
        const esAyer = !esHoy && this.mismaFecha(fecha, ayer);

        return {
          claveFecha: clave,
          fecha,
          etiqueta: esHoy
            ? 'Hoy'
            : esAyer
              ? 'Ayer'
              : this.formatearFecha(fecha),
          esHoy,
          esAyer,
          prestamos: prestamosDia,
          totalValor: prestamosDia.reduce((acc, p) => acc + (p.precio || 0), 0),
          totalUnidades: prestamosDia.length,
          barraLocales: this.calcularBarraLocales(prestamosDia),
        };
      },
    );

    grupos.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
    this.gruposPrestamos = grupos;
  }

  private calcularBarraLocales(prestamos: Prestamo[]): LocalBarData[] {
    const conteo = new Map<string, number>();
    for (const p of prestamos) {
      const local = p.localPrestado || 'Sin asignar';
      conteo.set(local, (conteo.get(local) || 0) + 1);
    }

    const total = prestamos.length || 1;

    return Array.from(conteo.entries())
      .map(([local, cantidad]) => ({
        local,
        cantidad,
        porcentaje: Math.round((cantidad / total) * 100),
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 6);
  }

  colorBarra(index: number): string {
    return this.paletaBarras[index % this.paletaBarras.length];
  }

  private claveDia(fecha: Date): string {
    return `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
  }

  mismaFecha(fecha1: Date, fecha2: Date): boolean {
    return (
      fecha1.getFullYear() === fecha2.getFullYear() &&
      fecha1.getMonth() === fecha2.getMonth() &&
      fecha1.getDate() === fecha2.getDate()
    );
  }

  formatearFecha(fecha: Date): string {
    const texto = fecha.toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  resetFilters(): void {
    this.filtroLocal = '';
    this.filtroFecha = null;
    this.filtroVendedor = '';
    this.filtrarPrestamos();
  }

  abrirDetalle(prestamo: Prestamo): void {
    this.detalleSeleccionado = prestamo;
    this.modalVisible = true;
    this.cd.detectChanges();
  }

  diasPrestado(fecha: Date): number {
    if (!fecha) return 0;
    const hoy = new Date();
    const inicio = new Date(
      fecha.getFullYear(),
      fecha.getMonth(),
      fecha.getDate(),
    );
    const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const diffMs = fin.getTime() - inicio.getTime();
    return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  }

  cerrarModal() {
    this.modalVisible = false;
    this.cd.detectChanges();
  }
  cerrarModalVenta() {
    this.mostrarModalVenta = false;
  }

  registrarVenta(prestamo: Prestamo) {
    this.modalVisible = false;
    this.prestamoSeleccionado = prestamo;
    this.mostrarModalVenta = true;
  }

  puedeDevolverALocal(prestamo: Prestamo): boolean {
    return !!prestamo.localOrigenId;
  }

  async devolverALocal(prestamo: Prestamo) {
    if (this.botonesDeshabilitados.has(prestamo.id)) return;

    if (!prestamo.localOrigenId) {
      this.messageService.add({
        severity: 'error',
        summary: 'No se pudo devolver',
        detail: 'Este préstamo no tiene un local de origen registrado.',
      });
      return;
    }

    this.botonesDeshabilitados.add(prestamo.id);

    try {
      const currentUser = this.authService.getCurrentUser();

      const pedidoLocalDevuelto = Object.fromEntries(
        Object.entries({
          productoId: prestamo.zapatoId,
          talla: Number(prestamo.talla),
          marca: prestamo.marca,
          referencia: prestamo.referencia,
          imagen: prestamo.imagen,
          localOrigenId: prestamo.localOrigenId,
          localOrigenNombre: prestamo.localSalido,
          estado: 'devuelto',
          porFuera: true,
          solicitadoPorNombre: currentUser?.name,
          solicitadoPorId: currentUser?.id,
          localSolicitanteId: prestamo.localSalido,
          fechaSolicitud: new Date(),
          devueltoPorNombre: currentUser?.name,
          devueltoPorId: currentUser?.id,
          fechaDevolucion: new Date(),
          tipoDevolucion: 'prestamo',
        }).filter(([, v]) => v !== undefined),
      );

      const batch = writeBatch(this.firestore);

      const pedidoLocalRef = doc(
        collection(this.firestore, 'pedidosDeLocales'),
      );
      batch.set(pedidoLocalRef, pedidoLocalDevuelto);

      const prestamoRef = doc(this.firestore, 'prestamos', prestamo.id);
      batch.delete(prestamoRef);

      await batch.commit();

      this.messageService.add({
        severity: 'warn',
        summary: 'Devolución a local pendiente',
        detail: `${prestamo.marca}, talla ${prestamo.talla} debe ser aceptado en ${prestamo.localSalido} para confirmar la devolución.`,
        life: 5000,
      });
    } catch (error) {
      console.error('Error al devolver préstamo a local:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Ocurrió un problema al devolver el préstamo al local.',
      });
    } finally {
      this.botonesDeshabilitados.delete(prestamo.id);
    }
  }

  async confirmarVenta(data: any) {
    const {
      marca,
      talla,
      referencia,
      imagen,
      zapatoId,
      localInicio,
      localPrestado,
    } = this.prestamoSeleccionado;

    const tipoVenta =
      this.prestamoSeleccionado.tipoVenta === 'prestamo Exhibicion'
        ? 'prestamo Exhibicion'
        : 'prestamo';

    const producto = await this.catalogoService.getProductoPorId(zapatoId);
    const esPrecioBajo = producto && data.precio < producto.precioMin;

    const venta: Venta = {
      id: crypto.randomUUID(),
      zapatoId,
      marca,
      talla,
      referencia,
      imagen,
      local: this.nombreVendedor.local,
      localPrestado: localPrestado,
      precio: data.precio + (data.segundoMetodo?.precio ?? 0),
      metodoPago: data.metodo,
      precioMetodoPrincipal: data.precio,
      fechaVenta: new Date(),
      tipoVenta: tipoVenta,
      vendedor: this.nombreVendedor.name,
      precioBajo: esPrecioBajo ? true : false,
      esPL: this.prestamoSeleccionado.esPL === true,
      numCliente: data.numCliente,
      vendedorId: this.nombreVendedor.id,
      nombrePresador: this.prestamoSeleccionado.vendedor,
      comentario: data.comentario,
      ...(data.segundoMetodo ? { segundoMetodo: data.segundoMetodo } : {}),
    };
    const agregada = await this.salesService.agregarVenta(venta);

    this.prestamosService.eliminarPrestamo(this.prestamoSeleccionado.id);

    if (agregada) {
      this.prestamoSeleccionado.estado = 'vendido';
      this.prestamoSeleccionado.fechaVenta = new Date();
      this.prestamoSeleccionado.metodoPago = data.metodo;

      this.messageService.add({
        severity: 'success',
        summary: 'Venta realizada',
        detail: `Se vendió ${marca} ${referencia}, talla ${talla} por $${data.precio}.`,
      });
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo registrar la venta (ID duplicado)',
      });
    }

    this.mostrarModalVenta = false;
    this.modalVisible = false;
  }
  confirmarDevolucion(prestamo: Prestamo) {
    this.prestamoADevolver = prestamo;
    this.tipoDevolucion = 'bodega';
    this.mostrarConfirmacion = true;
  }

  confirmarDevolucionLocal(prestamo: Prestamo) {
    this.prestamoADevolver = prestamo;
    this.tipoDevolucion = 'local';
    this.mostrarConfirmacion = true;
  }

  aceptarDevolucion() {
    if (this.prestamoADevolver) {
      if (this.tipoDevolucion === 'local') {
        this.devolverALocal(this.prestamoADevolver);
      } else {
        this.devolver(this.prestamoADevolver);
      }
    }
    this.mostrarConfirmacion = false;
    this.prestamoADevolver = undefined!;
  }

  cancelarDevolucion() {
    this.mostrarConfirmacion = false;
    this.prestamoADevolver = undefined!;
  }

  async devolver(prestamo: Prestamo) {
    if (this.botonesDeshabilitados.has(prestamo.id)) return;
    this.botonesDeshabilitados.add(prestamo.id);

    try {
      if (!prestamo.zapatoId) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error al devolver',
          detail:
            'Este préstamo no tiene un zapatoId válido y no se puede convertir en pedido.',
        });
        return;
      }

      const producto = await this.catalogoService.getProductoPorId(
        prestamo.zapatoId,
      );

      const pedidoDevuelto: Pedido = {
        id: crypto.randomUUID(),
        marca: prestamo.marca,
        talla: prestamo.talla,
        local: prestamo.localInicio,
        referencia: prestamo.referencia,
        imagen: prestamo.imagen,
        estado: 'Devuelto',
        fila: producto.fila || 'N/A',
        zapatoId: prestamo.zapatoId,
        vendedor: this.nombreVendedor ?? 'Sin asignar',
        hora: new Date().toISOString(),
        tipoDevolucion: 'prestamo',
      };

      await this.orderService.agregarPedido(pedidoDevuelto);
      await this.prestamosService.eliminarPrestamo(prestamo.id);

      this.prestamos = this.prestamos.filter((p) => p.id !== prestamo.id);
      this.filtrarPrestamos();

      this.messageService.add({
        severity: 'warn',
        summary: 'Devolución Pendiente',
        detail: `El producto ${pedidoDevuelto.marca}, talla ${pedidoDevuelto.talla} debe ser aceptado en bodega para confirmar devolución.`,
        life: 5000,
      });
    } catch (error) {
      console.error('❌ Error al devolver préstamo:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Ocurrió un problema al devolver el préstamo.',
      });
    } finally {
      this.botonesDeshabilitados.delete(prestamo.id);
    }
  }
}
