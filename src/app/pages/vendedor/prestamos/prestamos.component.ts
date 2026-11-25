import { Component, OnInit } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Pedido, Prestamo, User, Venta } from '../../interfaces';
import { PrestamosService } from '../../../services/vendedorServices/prestamos/prestamos.service';
import { CommonModule } from '@angular/common';
import { BadgeModule } from 'primeng/badge';
import { TabsModule } from 'primeng/tabs';
import { CatalogoService } from '../../../services/catalogo/catalogo.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { SalesService } from '../../../services/vendedorServices/ventas/sales.service';
import { ModalVentaComponent } from '../vendedor-children/mis-pedidos/modal-venta/modal-venta.component';
import { AuthService } from '../../../services/auth/auth.service';
import { OrderService } from '../../../services/vendedorServices/order.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Timestamp } from 'firebase/firestore';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { PushNotificationService } from '../../../services/notifications push/push-notification.service';
import {
  collection,
  doc,
  Firestore,
  writeBatch,
} from '@angular/fire/firestore';

import { IaLoaderComponent } from '../../../shared/components/ia-loader/ia-loader.component';
@Component({
  selector: 'app-prestamos',
  standalone: true,
  imports: [
    IaLoaderComponent,
    ButtonModule,
    CommonModule,
    BadgeModule,
    TabsModule,
    ToastModule,
    ConfirmDialogModule,
    ModalVentaComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './prestamos.component.html',
  styleUrls: ['./prestamos.component.css'],
})
export class PrestamosComponent implements OnInit {
  prestamos$: Observable<Prestamo[]>;
  prestamosPrestados: Prestamo[] = [];
  prestamosDevueltos: Prestamo[] = [];
  prestamosVendidos: Prestamo[] = [];
  activeTabIndex = 0;

  mostrarModalVenta: boolean = false;
  prestamoSeleccionado!: Prestamo;
  nombreVendedor: string = '';
  localVendido: string;
  botonesDeshabilitados = new Set<string>();
  mostrarConfirmacion: boolean = false;
  prestamoADevolver!: Prestamo;
  loadingPantalla = true;
  procesandoAccion = false;
  usuarioActual: User | null = null;

  tipoDevolucion: 'bodega' | 'local' = 'bodega';
  constructor(
    private prestamosService: PrestamosService,
    private catalogoService: CatalogoService,
    private messageService: MessageService,
    private salesService: SalesService,
    private authService: AuthService,
    private orderService: OrderService,
    private firestore: Firestore,
    private pushNotificationService: PushNotificationService,
  ) {
    this.prestamos$ = this.prestamosService.getPrestamos$();
  }

  ngOnInit(): void {
    this.prestamosService.registrar();
    this.orderService.registrar();
    this.catalogoService.registrar();
    this.scrollToTop();
    const currentUser = this.authService.getCurrentUser();
    this.localVendido = currentUser.local;

    if (
      (currentUser && currentUser.role === 'vendedor') ||
      (currentUser && currentUser.role === 'admin')
    ) {
      this.nombreVendedor = currentUser.name;

      this.prestamos$
        .pipe(
          map((prestamos) =>
            prestamos.filter(
              (prestamo) => prestamo.vendedor === this.nombreVendedor,
            ),
          ),
        )
        .subscribe((prestamosFiltrados) => {
          this.prestamosPrestados = prestamosFiltrados.filter(
            (p) => p.estado === 'prestado',
          );
          this.prestamosDevueltos = prestamosFiltrados.filter(
            (p) => p.estado === 'devuelto',
          );
          this.prestamosVendidos = prestamosFiltrados.filter(
            (p) => p.estado === 'vendido',
          );
        });
    }
    setTimeout(() => {
      this.loadingPantalla = false;
    }, 1500);
  }

  get validarRestriccionPrecio(): boolean {
    return !!this.usuarioActual?.restriccionesActivas;
  }

  ngOnDestroy(): void {
    this.prestamosService.desregistrar();
    this.orderService.desregistrar();
    this.catalogoService.desregistrar();
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  convertirFecha(fecha: any): Date {
    if (fecha instanceof Timestamp) {
      return fecha.toDate();
    } else if (fecha instanceof Date) {
      return fecha;
    } else {
      return new Date(fecha);
    }
  }

  getPrestamosAgrupados() {
    const grupos: {
      [key: string]: { fecha: Date; prestamos: Prestamo[] };
    } = {};

    for (const prestamo of this.prestamosPrestados) {
      const fechaDate = this.convertirFecha(prestamo.fechaPrestamo);

      const año = fechaDate.getFullYear();
      const mes = String(fechaDate.getMonth() + 1).padStart(2, '0');
      const dia = String(fechaDate.getDate()).padStart(2, '0');
      const key = `${año}-${mes}-${dia}`;

      if (!grupos[key]) {
        grupos[key] = {
          fecha: fechaDate,
          prestamos: [],
        };
      }

      grupos[key].prestamos.push(prestamo);
    }

    return grupos;
  }

  get fechasOrdenadas(): string[] {
    const grupos = this.getPrestamosAgrupados();

    return Object.keys(grupos).sort(
      (a, b) => grupos[b].fecha.getTime() - grupos[a].fecha.getTime(),
    );
  }

  formatearFecha(fecha: Date): string {
    return fecha.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  async devolver(prestamo: Prestamo) {
    if (this.botonesDeshabilitados.has(prestamo.id)) return;
    this.botonesDeshabilitados.add(prestamo.id);

    try {
      if (prestamo.zapatoId === undefined) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error al devolver',
          detail: 'Este préstamo no tiene un zapatoId válido.',
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
        fila: producto?.fila || 'N/A',
        zapatoId: prestamo.zapatoId,
        vendedor: prestamo.vendedor ?? 'Sin asignar',
        hora: new Date().toISOString(),
        tipoDevolucion: 'prestamo',
      };

      const currentUser = this.authService.getCurrentUser();

      const pedidoLimpio = Object.fromEntries(
        Object.entries({
          ...pedidoDevuelto,
          vendedorId: currentUser?.id,
        }).filter(([, v]) => v !== undefined),
      );

      const batch = writeBatch(this.firestore);

      const pedidoRef = doc(collection(this.firestore, 'pedidos'));
      batch.set(pedidoRef, pedidoLimpio);

      const prestamoRef = doc(this.firestore, 'prestamos', prestamo.id);
      batch.delete(prestamoRef);

      await batch.commit();

      try {
        await this.pushNotificationService.enviarNotificacionABodegueros({
          title: '🔁 Devolución de préstamo',
          body: `${prestamo.vendedor ?? 'Sin asignar'} (Local ${prestamo.localInicio}) devolvió ${prestamo.marca} ${prestamo.referencia} - Talla ${prestamo.talla} - Código: ${prestamo.zapatoId}`,
          data: {
            zapatoId: prestamo.zapatoId.toString(),
            talla: prestamo.talla,
            local: prestamo.localInicio?.toString() || '',
            tipo: 'devolucion-prestamo',
          },
        });
      } catch (err) {
        console.error('Error enviando notificación devolución préstamo:', err);
      }

      this.messageService.add({
        severity: 'warn',
        summary: 'Devolución pendiente',
        detail: `${pedidoDevuelto.marca}, talla ${pedidoDevuelto.talla} debe ser aceptado en bodega para confirmar devolución.`,
        life: 5000,
      });
    } catch (error) {
      console.error('Error al devolver préstamo:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Ocurrió un problema al devolver el préstamo.',
      });
    } finally {
      this.botonesDeshabilitados.delete(prestamo.id);
    }
  }

  registrarVenta(prestamo: Prestamo) {
    this.prestamoSeleccionado = prestamo;
    this.mostrarModalVenta = true;
  }

  cerrarModalVenta() {
    this.mostrarModalVenta = false;
  }

  async confirmarVenta(data: any) {
    if (this.procesandoAccion) return;
    this.procesandoAccion = true;

    try {
      const { marca, talla, referencia, imagen, zapatoId, localPrestado } =
        this.prestamoSeleccionado;

      const tipoVenta =
        this.prestamoSeleccionado.tipoVenta === 'prestamo Exhibicion'
          ? 'prestamo Exhibicion'
          : 'prestamo';

      const producto = await this.catalogoService.getProductoPorId(zapatoId);
      const esPrecioBajo =
        producto &&
        data.precio + (data.segundoMetodo?.precio ?? 0) < producto.pl;

      const venta: Venta = {
        id: crypto.randomUUID(),
        zapatoId,
        marca,
        talla,
        referencia,
        imagen,
        local: this.localVendido,
        localPrestado,
        precio: data.precio + (data.segundoMetodo?.precio ?? 0),
        metodoPago: data.metodo,
        precioMetodoPrincipal: data.precio,
        fechaVenta: new Date(),
        esPL: this.prestamoSeleccionado.esPL === true,
        tipoVenta,
        vendedor: this.nombreVendedor,
        precioBajo: esPrecioBajo ? true : false,
        numCliente: data.numCliente,
        comentario: data.comentario,
        ...(data.segundoMetodo ? { segundoMetodo: data.segundoMetodo } : {}),
      };

      const currentUser = this.authService.getCurrentUser();

      const ventaLimpia = Object.fromEntries(
        Object.entries({
          ...venta,
          zapatoId: Number(venta.zapatoId),
          vendedor: currentUser.name,
          vendedorId: currentUser.id,
        }).filter(([, v]) => v !== undefined),
      );

      const batch = writeBatch(this.firestore);

      const ventaRef = doc(collection(this.firestore, 'ventas'));
      batch.set(ventaRef, ventaLimpia);

      const prestamoRef = doc(
        this.firestore,
        'prestamos',
        this.prestamoSeleccionado.id,
      );
      batch.delete(prestamoRef);

      await batch.commit();

      if (data.numCliente) {
        const link = this.salesService.generarLinkWhatsApp(venta);
        window.open(link, '_blank');
      }

      this.messageService.add({
        severity: 'success',
        summary: 'Venta realizada',
        detail: `Se vendió ${marca} ${referencia}, talla ${talla} por $${venta.precio}.`,
      });

      if (esPrecioBajo) {
        try {
          await this.pushNotificationService.enviarNotificacionAAdmins({
            title: '⚠️ Venta de préstamo bajo precio mínimo',
            body: `${currentUser?.name || 'N/A'} vendió préstamo ${marca} ${referencia} - Talla ${talla} por $${venta.precio} (mín: $${producto.precioMin})`,
            data: {
              zapatoId: zapatoId.toString(),
              talla,
              tipo: 'venta-prestamo-precio-bajo',
            },
          });
        } catch (err) {
          console.error(
            'Error enviando notificación precio bajo préstamo:',
            err,
          );
        }
      }
    } catch (error) {
      console.error('Error al confirmar venta de préstamo:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo registrar la venta. Intenta de nuevo.',
      });
    } finally {
      this.mostrarModalVenta = false;
      this.procesandoAccion = false;
    }
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
}
