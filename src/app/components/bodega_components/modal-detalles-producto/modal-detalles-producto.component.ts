import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  NgZone,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TabsModule } from 'primeng/tabs';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { RippleModule } from 'primeng/ripple';
import { DividerModule } from 'primeng/divider';
import { CommonModule, KeyValue } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import {
  exhibiciones,
  ingresoTalla,
  InventarioLocal,
  Pedido,
  Venta,
} from '../../../pages/interfaces';
import { ExhibicionesService } from '../../../services/vendedorServices/exhibiciones/exhibiciones.service';
import { BadgeModule } from 'primeng/badge';
import { PrestamosService } from '../../../services/vendedorServices/prestamos/prestamos.service';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
import { RegistroIngresosService } from '../../../services/administracion/registro de ingresos/registro-ingresos.service';
import { LocalesInventarioService } from '../../../services/locales-inventario/locales-inventario.service';
import { PanelModule } from 'primeng/panel';
import { ChipModule } from 'primeng/chip';
import { Subscription, forkJoin, from, take } from 'rxjs';
import { SalesService } from '../../../services/vendedorServices/ventas/sales.service';
import { OrderService } from '../../../services/vendedorServices/order.service';
import { doc, Firestore } from '@angular/fire/firestore';
import { deleteDoc, getDoc, updateDoc } from 'firebase/firestore';
import localeEsCO from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';

@Component({
  selector: 'app-modal-detalles-producto',
  imports: [
    FormsModule,
    TabsModule,
    ButtonModule,
    CardModule,
    PanelModule,
    TagModule,
    ChipModule,
    RippleModule,
    DividerModule,
    CommonModule,
    MessageModule,
    DialogModule,
    BadgeModule,
    SkeletonModule,
    TableModule,
    InputTextModule,
    DatePickerModule,
  ],
  templateUrl: './modal-detalles-producto.component.html',
  styleUrl: './modal-detalles-producto.component.css',
  providers: [{ provide: LOCALE_ID, useValue: 'es-CO' }],
})
export class ModalDetallesProductoComponent {
  @Input() visible: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Input() producto: any;
  globalFilter: string = '';
  filtroFecha: Date | null = null;
  ventasFiltradas: any[] = [];
  cantidadVentas: number = 0;
  ingresos: ingresoTalla[] = [];
  ingresosFiltrados: any[] = [];
  prestamosSub: Subscription | null = null;

  activeIndex = 0;
  exhibicionesFiltradas: exhibiciones[] = [];
  cantidadExhibidos: number = 0;
  loading: boolean = true;
  pedidosFiltrados: Pedido[] = [];
  cantidadPedidos: number = 0;
  selectedFecha: Date | null = null;
  globalFilterValue: string = '';
  tallasArray: { numero: number; cantidad: number }[] = [];
  ingresoEnEdicion: any | null = null;
  cantidadEditando: number = 0;
  guardandoEdicion: boolean = false;

  ingresoAEliminar: any | null = null;
  eliminando: boolean = false;

  localesInventario: InventarioLocal[] = [];
  cantidadEnLocales: number = 0;
  localesInventarioSub: Subscription | null = null;
  constructor(
    private exhibicionesService: ExhibicionesService,
    private prestamosService: PrestamosService,
    private registroIngresosService: RegistroIngresosService,
    private salesService: SalesService,
    private orderService: OrderService,
    private localesInventarioService: LocalesInventarioService,
    private cdr: ChangeDetectorRef,
    private firestore: Firestore,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    this.prestamosService.registrar();
    this.orderService.registrar();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['producto'] && changes['producto'].currentValue) {
      this.loading = true;

      if (this.producto?.tallasDisponibles) {
        this.tallasArray = Object.entries(this.producto.tallasDisponibles)
          .map(([numero, cantidad]) => ({
            numero: Number(numero),
            cantidad: Number(cantidad),
          }))
          .filter((t) => t.cantidad > 0);
      } else {
        this.tallasArray = [];
      }

      const zapatoId = this.producto?.id;

      this.orderService
        .obtenerPedidos()
        .pipe(take(1))
        .subscribe((pedidos) => {
          this.pedidosFiltrados = pedidos.filter(
            (pedido) => pedido.zapatoId === zapatoId,
          );
          this.cantidadPedidos = this.pedidosFiltrados.length;
        });

      this.localesInventarioSub?.unsubscribe();
      this.localesInventarioSub = this.localesInventarioService
        .getInventarioPorProducto(zapatoId)
        .subscribe({
          next: (localesInventario) => {
            this.localesInventario = (localesInventario ?? [])
              .filter((l) => (l.stock ?? 0) > 0)
              .sort((a, b) => a.localNombre.localeCompare(b.localNombre));

            this.cantidadEnLocales = this.localesInventario.reduce(
              (total, l) => total + (l.stock ?? 0),
              0,
            );

            this.cdr.markForCheck();
          },
          error: (error) => {
            console.error('Error escuchando inventario en locales:', error);
          },
        });

      forkJoin({
        exhibiciones:
          this.exhibicionesService.obtenerExhibicionesPorZapatoId(zapatoId),
        prestamos: this.prestamosService.getPrestamos$().pipe(take(1)),
        ingresos: from(
          this.registroIngresosService.getIngresosPorZapatoId(zapatoId),
        ),
        ventas: this.salesService.obtenerVentasPorZapatoId(zapatoId),
      }).subscribe({
        next: ({ exhibiciones, prestamos, ingresos, ventas }) => {
          this.exhibicionesFiltradas = exhibiciones;
          this.producto.exhibiciones = exhibiciones;
          this.cantidadExhibidos = exhibiciones.length;

          const prestamosFiltrados = prestamos
            .filter((prestamo: any) => prestamo.zapatoId === this.producto.id)
            .map((prestamo: any) => ({
              ...prestamo,
              fechaPrestamo:
                prestamo.fechaPrestamo instanceof Date
                  ? prestamo.fechaPrestamo
                  : ((prestamo.fechaPrestamo as any)?.toDate?.() ?? null),
            }));

          this.producto.prestamos = prestamosFiltrados;

          this.ingresos = ingresos
            .filter((ingreso) => ingreso.zapatoId === this.producto.id)
            .map((ingreso) => ({
              ...ingreso,
              fecha: ingreso.fecha?.toDate
                ? ingreso.fecha.toDate()
                : new Date(ingreso.fecha),
            }))
            .sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

          this.ingresosFiltrados = [...this.ingresos];

          const stockInicialCalculado = this.ingresos.reduce(
            (total, ingreso) => {
              const cantidad = Number(ingreso.cantIngresada) || 0;
              return total + cantidad;
            },
            0,
          );

          this.producto.stockInicial = stockInicialCalculado;

          this.ventasFiltradas = ventas.filter(
            (venta) =>
              venta.zapatoId === this.producto.id &&
              venta.tipoVenta !== 'Devuelto por bono' &&
              venta.tipoVenta !== 'Devuelto por cambio',
          );

          this.cantidadVentas = this.ventasFiltradas.length;

          // Lo que ya se archivó (ventas e ingresos antiguos) sigue contando para este producto
          getDoc(doc(this.firestore, 'contadoresArchivo', String(zapatoId)))
            .then((snap) => {
              if (!snap.exists()) return;
              const a = snap.data() as { ventas?: number; ingresos?: number };
              this.producto.stockInicial =
                (this.producto.stockInicial ?? 0) + (Number(a.ingresos) || 0);
              this.cantidadVentas += Number(a.ventas) || 0;
              this.cdr.markForCheck();
            })
            .catch(() => {});

          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error cargando datos:', error);
          this.loading = false;
          setTimeout(() => this.cdr.detectChanges());
        },
      });
    }
  }

  get totalEnSistema(): number {
    const stockActual = Number(this.producto?.stock) || 0;
    const prestados = this.producto?.prestamos?.length || 0;

    return (
      stockActual +
      prestados +
      this.cantidadPedidos +
      this.cantidadExhibidos +
      this.cantidadEnLocales +
      this.cantidadVentas
    );
  }

  compararTallas = (
    a: KeyValue<string, number>,
    b: KeyValue<string, number>,
  ): number => Number(a.key) - Number(b.key);

  iniciarEdicion(ingreso: any): void {
    this.ingresoAEliminar = null;
    this.ingresoEnEdicion = ingreso;
    this.cantidadEditando = Number(ingreso.cantIngresada) || 0;
  }

  cancelarEdicion(): void {
    this.ingresoEnEdicion = null;
    this.cantidadEditando = 0;
  }

  async guardarEdicion(ingreso: any): Promise<void> {
    if (!ingreso.id) {
      console.warn('El ingreso no tiene id, no se puede actualizar.');
      return;
    }

    const nueva = Number(this.cantidadEditando);
    if (isNaN(nueva) || nueva < 1) return;

    if (nueva === Number(ingreso.cantIngresada)) {
      this.cancelarEdicion();
      return;
    }

    this.guardandoEdicion = true;

    try {
      const ref = doc(this.firestore, 'ingresosProductos', ingreso.id);
      await updateDoc(ref, { cantIngresada: String(nueva) });

      const actualizar = (lista: any[]) =>
        lista.map((r) =>
          r.id === ingreso.id ? { ...r, cantIngresada: String(nueva) } : r,
        );

      this.ingresos = actualizar(this.ingresos) as typeof this.ingresos;
      this.ingresosFiltrados = actualizar(this.ingresosFiltrados);

      this.producto.stockInicial = this.ingresos.reduce(
        (total, r) => total + (Number(r.cantIngresada) || 0),
        0,
      );

      this.cancelarEdicion();
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error al actualizar ingreso:', error);
    } finally {
      this.guardandoEdicion = false;
    }
  }

  pedirConfirmacionEliminar(ingreso: any): void {
    this.cancelarEdicion();
    this.ingresoAEliminar =
      this.ingresoAEliminar?.id === ingreso.id ? null : ingreso;
  }

  cancelarEliminar(): void {
    this.ingresoAEliminar = null;
  }

  async confirmarEliminar(ingreso: any): Promise<void> {
    if (!ingreso.id) {
      console.warn('El ingreso no tiene id, no se puede eliminar.');
      return;
    }

    this.eliminando = true;

    try {
      const ref = doc(this.firestore, 'ingresosProductos', ingreso.id);
      await deleteDoc(ref);

      this.ingresos = this.ingresos.filter((r) => r.id !== ingreso.id);
      this.ingresosFiltrados = this.ingresosFiltrados.filter(
        (r) => r.id !== ingreso.id,
      );

      this.producto.stockInicial = this.ingresos.reduce(
        (total, r) => total + (Number(r.cantIngresada) || 0),
        0,
      );

      this.cancelarEliminar();
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error al eliminar ingreso:', error);
    } finally {
      this.eliminando = false;
    }
  }

  formatearFecha(fecha: any): string {
    let fechaFormateada: Date;

    if (fecha && fecha.toDate) {
      fechaFormateada = fecha.toDate();
    } else {
      fechaFormateada = new Date(fecha);
    }

    return fechaFormateada.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  filtrarPorFecha(): void {
    this.cancelarEdicion();
    this.cancelarEliminar();

    if (!this.selectedFecha) {
      this.ingresosFiltrados = [...this.ingresos];
      return;
    }

    const filtroDia = new Date(this.selectedFecha).setHours(0, 0, 0, 0);

    this.ingresosFiltrados = this.ingresos.filter((ingreso) => {
      const raw = ingreso.fecha;
      const fecha: Date = raw?.toDate ? raw.toDate() : new Date(raw);
      return fecha.setHours(0, 0, 0, 0) === filtroDia;
    });
  }

  limpiarFiltro(): void {
    this.selectedFecha = null;
    this.ingresosFiltrados = [...this.ingresos];
    this.cancelarEdicion();
    this.cancelarEliminar();
  }

  obtenerExhibiciones(): void {
    const zapatoId = String(this.producto?.id);

    if (!zapatoId) {
      console.warn('⚠️ zapatoId no definido');
      return;
    }
    this.exhibicionesService
      .obtenerExhibicionesPorZapatoId(zapatoId)
      .then((exhibiciones) => {
        this.ngZone.run(() => {
          this.exhibicionesFiltradas = exhibiciones;
          this.producto.exhibiciones = this.exhibicionesFiltradas;
          this.cantidadExhibidos = this.exhibicionesFiltradas.length;
        });
      })

      .catch((error) => {
        console.error('❌ Error al obtener exhibiciones por zapatoId:', error);
      });
  }

  obtenerPrestamos(): void {
    if (this.prestamosSub) {
      this.prestamosSub.unsubscribe();
    }

    this.prestamosSub = this.prestamosService
      .getPrestamos$()
      .subscribe((prestamos: any[]) => {
        const prestamosFiltrados = prestamos
          .filter((prestamo: any) => prestamo.zapatoId === this.producto.id)
          .map((prestamo: any) => ({
            ...prestamo,
            fechaPrestamo: prestamo.fechaPrestamo?.toDate
              ? prestamo.fechaPrestamo.toDate()
              : new Date(prestamo.fechaPrestamo),
          }));

        this.producto.prestamos = prestamosFiltrados;
      });
  }

  cerrar() {
    this.close.emit();
  }

  getBadgeSeverity(index: number): 'success' | 'info' | 'warn' {
    if (index === 0) return 'success';
    if (index === 1) return 'info';
    return 'warn';
  }

  ngOnDestroy(): void {
    this.prestamosService.desregistrar();
    this.orderService.desregistrar();
    this.prestamosSub?.unsubscribe();
    this.localesInventarioSub?.unsubscribe();
  }
}
