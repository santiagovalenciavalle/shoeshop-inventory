import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { Pedido, Prestamo, Venta } from '../../../interfaces';
import { ToastModule } from 'primeng/toast';
import { MenuItem, MessageService } from 'primeng/api';
import { PedidoCardComponent } from './pedido-card/pedido-card.component';
import { Subscription } from 'rxjs';
import { OrderService } from '../../../../services/vendedorServices/order.service';
import { ModalVentaComponent } from './modal-venta/modal-venta.component';
import { SalesService } from '../../../../services/vendedorServices/ventas/sales.service';
import { montoCajaAlAnular } from '../../../../services/vendedorServices/ventas/caja-devuelta.util';
import { ModalPrestamoComponent } from './modal-prestamo/modal-prestamo.component';
import { PrestamosService } from '../../../../services/vendedorServices/prestamos/prestamos.service';
import { CatalogoService } from '../../../../services/catalogo/catalogo.service';
import { AuthService } from '../../../../services/auth/auth.service';

import { ModalBonoComponent } from './modal-bono/modal-bono.component';
import { BonosService } from '../../../../services/vendedorServices/bonos/bonos.service';
import { CambiosComponent } from '../../../../components/vendedor_components/cambios/cambios.component';
import { RouterModule } from '@angular/router';
import { PushNotificationService } from '../../../../services/notifications push/push-notification.service';
import { VisibilityService } from '../../../../services/visibilitychange/visibility.service';

import { IaSpinnerComponent } from '../../../../shared/components/ia-loader/ia-spinner.component';
@Component({
  selector: 'app-mis-pedidos',
  standalone: true,
  imports: [
    IaSpinnerComponent,
    CommonModule,
    ButtonModule,
    TabsModule,
    ToastModule,
    PedidoCardComponent,
    ModalVentaComponent,
    ModalPrestamoComponent,
    ModalBonoComponent,
    CambiosComponent,
    RouterModule,
  ],
  providers: [MessageService],
  templateUrl: './mis-pedidos.component.html',
  styleUrls: ['./mis-pedidos.component.css'],
})
export class MisPedidosComponent implements OnInit, OnDestroy {
  constructor(
    private messageService: MessageService,
    private orderService: OrderService,
    private salesService: SalesService,
    private prestamosService: PrestamosService,
    private catalogoService: CatalogoService,
    private authService: AuthService,
    private bonosService: BonosService,
    private pushNotificationService: PushNotificationService,
    public visibilityService: VisibilityService,
  ) {}

  items: MenuItem[] = [
    {
      label: 'Volver',
      icon: 'pi pi-arrow-left',
      routerLink: '/vendedor',
    },
  ];

  estadosOrdenados: string[] = ['Pendiente', 'Recibido', 'Devuelto'];
  seccionesPedidos: { estado: string; pedidos: Pedido[] }[] = [];

  mostrarModalPrestamo: boolean = false;
  pedidosSub!: Subscription;
  mostrarModalVenta: boolean = false;
  pedidoSeleccionado!: Pedido;
  mostrarModalBono: boolean = false;
  user: any;
  mostrarModalCambio: boolean = false;
  procesandoAccion: boolean = false;
  loading: boolean = true;
  plSeleccionado: number | null = null;

  ngOnInit(): void {
    this.prestamosService.registrar();
    this.orderService.registrar();
    this.catalogoService.registrar();
    this.scrollToTop();

    this.user = this.authService.getCurrentUser();
    setTimeout(() => {
      this.loading = false;
    }, 2500);
    this.pedidosSub = this.orderService.pedidos$.subscribe(
      (pedidos: Pedido[]) => {
        this.organizarPedidos(pedidos);
      },
    );
  }

  get validarRestriccionPrecio(): boolean {
    return !!this.user?.restriccionesActivas;
  }

  organizarPedidos(pedidos: Pedido[]) {
    const usuarioActual = this.authService.getCurrentUser();

    const filtrados = pedidos.filter((p) =>
      usuarioActual ? p.vendedorId === usuarioActual.id : true,
    );

    this.seccionesPedidos = this.estadosOrdenados.map((estado) => ({
      estado,
      pedidos: filtrados
        .filter((p) => p.estado === estado)
        .sort((a, b) => this.ordenarPorFechaHora(b, a)),
    }));
  }

  ordenarPorFechaHora(a: Pedido, b: Pedido) {
    if (!a.hora || !b.hora) return 0;
    return new Date(a.hora).getTime() - new Date(b.hora).getTime();
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  actualizarPedidosFiltrados() {
    this.orderService.obtenerPedidos().subscribe((pedidos) => {
      this.organizarPedidos(pedidos);
    });

    this.cerrarModalCambio();
  }

  marcarRecibido(pedido: Pedido) {
    if (this.procesandoAccion) return;
    this.procesandoAccion = true;

    const hora = new Date().toISOString();

    pedido.estado = 'Recibido';
    pedido.hora = hora;

    this.catalogoService.actualizarStockPorTalla(
      pedido.zapatoId,
      Number(pedido.talla),
    );

    this.orderService.actualizarPedido(pedido);

    this.messageService.add({
      severity: 'success',
      summary: 'Pedido recibido',
      detail: `Se ha marcado como recibido el pedido de ${pedido.marca}, talla ${pedido.talla}.`,
    });

    this.procesandoAccion = false;
  }

  marcarNoRecibido(pedido: Pedido) {
    const hora = new Date().toISOString();
    pedido.estado = 'No Recibido';
    pedido.hora = hora;

    this.messageService.add({
      severity: 'error',
      summary: 'Zapato no recibido',
      detail: 'Se notificará al administrador.',
    });

    this.orderService.actualizarPedido(pedido);
  }

  realizarVenta(pedido: Pedido) {
    this.pedidoSeleccionado = pedido;
    this.mostrarModalVenta = true;
  }

  cerrarModalVenta() {
    this.mostrarModalVenta = false;
  }

  async confirmarVenta(data: any) {
    if (this.procesandoAccion) return;
    this.procesandoAccion = true;

    try {
      await this.orderService.marcarComoProcesando(this.pedidoSeleccionado.id);
    } catch (e: any) {
      this.procesandoAccion = false;
      this.mostrarModalVenta = false;

      const msg =
        e?.message === 'PEDIDO_YA_EN_PROCESO'
          ? 'Este pedido ya está siendo procesado por otra sesión.'
          : e?.message === 'PEDIDO_NO_ENCONTRADO'
            ? 'El pedido ya no existe.'
            : 'No se pudo procesar el pedido.';

      this.messageService.add({
        severity: 'warn',
        summary: 'Atención',
        detail: msg,
      });
      return;
    }

    try {
      const { marca, talla, referencia, imagen, local, zapatoId } =
        this.pedidoSeleccionado;

      const id = await this.generarIdUnico();

      const producto = await this.catalogoService.getProductoPorId(zapatoId);
      const esPrecioBajo =
        producto &&
        data.precio + (data.segundoMetodo?.precio ?? 0) < producto.precioMin;

      const venta: Venta = {
        id,
        tipoVenta: 'venta',
        marca,
        talla,
        referencia,
        imagen,
        local,
        zapatoId,
        precio: data.precio + (data.segundoMetodo?.precio ?? 0),
        metodoPago: data.metodo,
        precioMetodoPrincipal: data.precio,
        fechaVenta: new Date(),
        vendedor: this.user.name,
        numCliente: data.numCliente,
        precioBajo: esPrecioBajo,
        comentario: data.comentario,
        ...(data.segundoMetodo ? { segundoMetodo: data.segundoMetodo } : {}),
      };

      const ok = await this.salesService.agregarVentaYEliminarPedido(
        venta,
        this.pedidoSeleccionado.id,
      );

      if (ok) {
        this.messageService.add({
          severity: 'success',
          summary: 'Venta realizada',
          detail: `Venta de ${marca} ${referencia}, talla ${talla} por $${venta.precio}.`,
        });

        if (esPrecioBajo) {
          try {
            await this.pushNotificationService.enviarNotificacionAAdmins({
              title: '⚠️ Venta bajo precio mínimo',
              body: `${this.user?.name || 'N/A'} vendió ${marca} ${referencia} - Talla ${talla} por $${venta.precio} (mín: $${producto.precioMin})`,
              data: {
                zapatoId: zapatoId.toString(),
                talla,
                tipo: 'venta-precio-bajo',
              },
            });
          } catch (err) {
            console.error('Error enviando notificación precio bajo:', err);
          }
        }
      } else {
        await this.orderService.quitarBloqueo(this.pedidoSeleccionado.id);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo registrar la venta. Intenta de nuevo.',
        });
      }
    } catch (error) {
      await this.orderService.quitarBloqueo(this.pedidoSeleccionado.id);
      this.messageService.add({
        severity: 'error',
        summary: 'Error inesperado',
        detail: 'Algo salió mal al registrar la venta.',
      });
    } finally {
      this.mostrarModalVenta = false;
      this.procesandoAccion = false;
    }
  }

  private async generarIdUnico(): Promise<string> {
    let nuevoId: string;
    let existe = true;

    do {
      nuevoId = crypto.randomUUID();
      existe = await this.salesService.idExiste(nuevoId);
    } while (existe);

    return nuevoId;
  }

  async abrirModalPrestamo(pedido: Pedido) {
    this.pedidoSeleccionado = pedido;

    const producto = await this.catalogoService.getProductoPorId(
      pedido.zapatoId,
    );
    const plNum =
      producto?.pl != null && producto.pl !== '' ? Number(producto.pl) : null;
    this.plSeleccionado = Number.isNaN(plNum as number) ? null : plNum;

    this.mostrarModalPrestamo = true;
  }

  cerrarModalPrestamo() {
    this.mostrarModalPrestamo = false;
    this.plSeleccionado = null;
  }

  realizarPrestamo(pedido: Pedido) {
    this.abrirModalPrestamo(pedido);
  }

  async confirmarPrestamo(data: any) {
    if (this.procesandoAccion) return;
    this.procesandoAccion = true;

    try {
      await this.orderService.marcarComoProcesando(this.pedidoSeleccionado.id);
    } catch (e: any) {
      this.procesandoAccion = false;
      this.mostrarModalPrestamo = false;

      const msg =
        e?.message === 'PEDIDO_YA_EN_PROCESO'
          ? 'Este pedido ya está siendo procesado por otra sesión.'
          : e?.message === 'PEDIDO_NO_ENCONTRADO'
            ? 'El pedido ya no existe.'
            : 'No se pudo procesar el pedido.';

      this.messageService.add({
        severity: 'warn',
        summary: 'Atención',
        detail: msg,
      });
      return;
    }

    try {
      const { marca, talla, referencia, imagen, zapatoId, vendedor, local } =
        this.pedidoSeleccionado;

      const id = await this.generarIdUnico();

      const prestamo: Prestamo = {
        id,
        marca,
        talla,
        referencia,
        imagen,
        zapatoId,
        tipoVenta: 'prestamo',
        estado: 'prestado',
        localInicio: local,
        localPrestado: data.local,
        precio: data.precio,
        esPL: data.esPL === true,
        fechaPrestamo: new Date(),
        vendedor,
        comentario: data.comentario,
      };

      const ok = await this.prestamosService.agregarPrestamoYEliminarPedido(
        prestamo,
        this.pedidoSeleccionado.id,
      );

      if (ok) {
        this.messageService.add({
          severity: 'success',
          summary: 'Préstamo registrado',
          detail: `Se prestó ${marca} ${referencia}, talla ${talla} al local ${data.local} por $${data.precio}`,
        });

        this.validarPrecioMinimo(zapatoId, data.precio, 'prestamo');
      } else {
        await this.orderService.quitarBloqueo(this.pedidoSeleccionado.id);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo registrar el préstamo. Intenta de nuevo.',
        });
      }
    } catch (error) {
      await this.orderService.quitarBloqueo(this.pedidoSeleccionado.id);
      this.messageService.add({
        severity: 'error',
        summary: 'Error inesperado',
        detail: 'Algo salió mal al registrar el préstamo.',
      });
    } finally {
      this.mostrarModalPrestamo = false;
      this.procesandoAccion = false;
    }
  }

  async realizarDevolucion(pedido: Pedido) {
    if (this.procesandoAccion) return;
    this.procesandoAccion = true;

    try {
      const hora = new Date().toISOString();

      const producto = await this.catalogoService.getProductoPorId(
        pedido.zapatoId,
      );

      pedido.estado = 'Devuelto';
      pedido.hora = hora;
      pedido.fila = producto?.fila || 'N/A';
      pedido.tipoDevolucion = 'pedido';

      await this.orderService.actualizarPedido(pedido);

      try {
        await this.pushNotificationService.enviarNotificacionABodegueros({
          title: '↩️ Devolución de pedido',
          body: `${pedido.vendedor} (Local ${pedido.local}) devolvió un ${pedido.marca} ${pedido.referencia} - Talla ${pedido.talla} - Código: ${pedido.zapatoId}`,
          data: {
            zapatoId: pedido.zapatoId.toString(),
            talla: pedido.talla,
            local: pedido.local?.toString() || '',
            tipo: 'devolucion-pedido',
          },
        });
      } catch (err) {
        console.error('Error enviando notificación devolución pedido:', err);
      }

      this.messageService.add({
        severity: 'warn',
        summary: 'Devolución Pendiente',
        detail: `El producto ${pedido.marca}, talla ${pedido.talla} debe ser aceptado en bodega.`,
        life: 3000,
      });
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Hubo un problema al devolver el pedido.',
      });
    } finally {
      setTimeout(() => {
        this.procesandoAccion = false;
      }, 2000);
    }
  }

  async validarPrecioMinimo(
    zapatoId: number,
    precio: number,
    tipo: 'venta' | 'prestamo',
  ) {
    const producto = await this.catalogoService.getProductoPorId(zapatoId);

    if (
      producto?.precioMin !== null &&
      producto?.precioMin !== undefined &&
      precio < producto.precioMin
    ) {
      this.messageService.add({
        severity: 'warn',
        summary: `Alerta de ${tipo}`,
        detail: `Se registró una ${tipo} por debajo del precio mínimo.`,
      });
    }
  }

  realizarCambio(pedido: Pedido, cardElement: HTMLElement) {
    this.pedidoSeleccionado = pedido;
    this.mostrarModalCambio = true;
  }

  cerrarModalCambio() {
    this.mostrarModalCambio = false;
  }

  async manejarProcesarCambio(event: {
    pedido: any;
    excedente: number;
    metodoPago: string;
    fechaAnterior: any;
  }) {
    if (this.procesandoAccion) return;
    this.procesandoAccion = true;

    try {
      await this.orderService.marcarComoProcesando(this.pedidoSeleccionado.id);
    } catch (e: any) {
      this.procesandoAccion = false;
      this.cerrarModalCambio();

      const msg =
        e?.message === 'PEDIDO_YA_EN_PROCESO'
          ? 'Este pedido ya está siendo procesado por otra sesión.'
          : e?.message === 'PEDIDO_NO_ENCONTRADO'
            ? 'El pedido ya no existe.'
            : 'No se pudo procesar el pedido.';

      this.messageService.add({
        severity: 'warn',
        summary: 'Atención',
        detail: msg,
      });
      return;
    }

    try {
      const nuevoId = crypto.randomUUID();

      let fechaAnteriorDate: Date;
      if (event.fechaAnterior?.seconds) {
        fechaAnteriorDate = new Date(event.fechaAnterior.seconds * 1000);
      } else {
        fechaAnteriorDate = new Date(event.fechaAnterior);
      }

      const hoy = new Date();
      const mismaFecha =
        fechaAnteriorDate.getFullYear() === hoy.getFullYear() &&
        fechaAnteriorDate.getMonth() === hoy.getMonth() &&
        fechaAnteriorDate.getDate() === hoy.getDate();

      const zapatoId = Number(this.pedidoSeleccionado.zapatoId);
      const producto1 = await this.catalogoService.getProductoPorId(zapatoId);
      const esPrecioBajo =
        producto1 &&
        Number(event.pedido.precio) + (event.excedente ?? 0) <
          producto1.precioMin;

      const ventaCambio: Venta = {
        id: nuevoId,
        zapatoId,
        marca: this.pedidoSeleccionado.marca,
        referencia: this.pedidoSeleccionado.referencia,
        talla: this.pedidoSeleccionado.talla,
        imagen: this.pedidoSeleccionado.imagen,
        tipoVenta: 'Cambio',
        metodoPago: event.pedido.metodoPago,
        precio: Number(event.pedido.precio) + (event.excedente ?? 0),
        precioMetodoPrincipal: event.pedido.precioMetodoPrincipal,
        fechaVenta: new Date(),
        vendedor: this.pedidoSeleccionado.vendedor,
        local: this.user.local,
        precioBono: Number(event.pedido.precio),
        excedente: event.excedente ?? 0,
        metodoExcedente: event.metodoPago,
        productoDevueltoId: event.pedido.id,
        precioBajo: esPrecioBajo,
        esMismoDia: mismaFecha,
        ...(event.pedido.segundoMetodo
          ? { segundoMetodo: event.pedido.segundoMetodo }
          : {}),
      };

      const ventaAgregada = await this.salesService.agregarVentaYEliminarPedido(
        ventaCambio,
        this.pedidoSeleccionado.id,
      );

      if (!ventaAgregada) {
        await this.orderService.quitarBloqueo(this.pedidoSeleccionado.id);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo registrar el cambio. Intenta de nuevo.',
        });
        return;
      }

      const actualizada = await this.salesService.actualizarVentaPorId(
        event.pedido.id,
        {
          tipoVenta: 'Devuelto por cambio',
          precio: 0,
          DevueltoCambio: true,
          // Si la venta era de otro día, se conserva el dinero que ya recibió el vendedor
          ...(mismaFecha
            ? {}
            : { precioAntesDeCambio: montoCajaAlAnular(event.pedido) }),
        },
      );

      if (!actualizada) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Cambio registrado',
          detail:
            'El cambio se procesó pero no se actualizó la venta anterior.',
        });
      } else {
        this.messageService.add({
          severity: 'success',
          summary: 'Cambio procesado',
          detail:
            'Se registró la nueva venta y se actualizó la venta anterior.',
        });
      }

      const producto = await this.catalogoService.getProductoPorId(
        event.pedido.zapatoId,
      );

      const nuevoPedido: Pedido = {
        id: crypto.randomUUID(),
        zapatoId: event.pedido.zapatoId,
        marca: event.pedido.marca,
        referencia: event.pedido.referencia,
        talla: event.pedido.talla,
        imagen: event.pedido.imagen,
        estado: 'Devuelto',
        hora: new Date().toISOString(),
        fila: producto?.fila || 'N/A',
        local: this.user.local,
        vendedor: event.pedido.vendedor,
        precio: event.pedido.precio,
        metodoPago: event.pedido.metodoPago,
        tipoDevolucion: 'cambio',
        productoDevueltoId: event.pedido.productoDevueltoId ?? null,
      };

      await this.orderService.agregarPedido(nuevoPedido);

      this.messageService.add({
        severity: 'info',
        summary: 'Pedido creado',
        detail: 'Nuevo pedido del producto devuelto.',
      });

      if (esPrecioBajo) {
        try {
          await this.pushNotificationService.enviarNotificacionAAdmins({
            title: '⚠️ Cambio bajo precio mínimo',
            body: `${this.user?.name || 'N/A'} realizó un cambio en ${this.pedidoSeleccionado.marca} ${this.pedidoSeleccionado.referencia} por $${ventaCambio.precio} (mín: $${producto1?.precioMin})`,
            data: {
              zapatoId: this.pedidoSeleccionado.zapatoId.toString(),
              talla: this.pedidoSeleccionado.talla,
              tipo: 'cambio-precio-bajo',
            },
          });
        } catch (err) {
          console.error('Error enviando notificación precio bajo cambio:', err);
        }
      }

      try {
        await this.pushNotificationService.enviarNotificacionABodegueros({
          title: '🔄 Devolución por cambio',
          body: `${event.pedido.vendedor} (Local ${this.user.local}) devolvió un ${event.pedido.marca} ${event.pedido.referencia} - Talla ${event.pedido.talla}`,
          data: {
            zapatoId: event.pedido.zapatoId.toString(),
            talla: event.pedido.talla,
            local: this.user.local?.toString() || '',
            tipo: 'devolucion-cambio',
          },
        });
      } catch (err) {
        console.error('Error enviando notificación devolución cambio:', err);
      }

      this.cerrarModalCambio();
    } catch (error) {
      await this.orderService.quitarBloqueo(this.pedidoSeleccionado.id);
      this.messageService.add({
        severity: 'error',
        summary: 'Error inesperado',
        detail: 'Algo salió mal al procesar el cambio.',
      });
    } finally {
      this.procesandoAccion = false;
    }
  }

  aplicarBono(pedido: Pedido) {
    this.pedidoSeleccionado = pedido;
    this.mostrarModalBono = true;
  }

  async onBonoRedimido(bono: any) {
    if (this.procesandoAccion) return;
    this.procesandoAccion = true;

    try {
      await this.orderService.marcarComoProcesando(this.pedidoSeleccionado.id);
    } catch (e: any) {
      this.procesandoAccion = false;
      this.mostrarModalBono = false;

      const msg =
        e?.message === 'PEDIDO_YA_EN_PROCESO'
          ? 'Este pedido ya está siendo procesado por otra sesión.'
          : e?.message === 'PEDIDO_NO_ENCONTRADO'
            ? 'El pedido ya no existe.'
            : 'No se pudo procesar el pedido.';

      this.messageService.add({
        severity: 'warn',
        summary: 'Atención',
        detail: msg,
      });
      return;
    }

    try {
      const idVentaNueva = crypto.randomUUID();

      const ventaNueva: Venta = {
        id: idVentaNueva,
        zapatoId: Number(this.pedidoSeleccionado.zapatoId),
        marca: this.pedidoSeleccionado.marca,
        referencia: this.pedidoSeleccionado.referencia,
        talla: this.pedidoSeleccionado.talla,
        imagen: this.pedidoSeleccionado.imagen,
        precio: bono.excedente ?? 0,
        tipoVenta: 'Bono',
        metodoPago: bono?.metodo ?? 'bono',
        fechaVenta: new Date(),
        vendedor: bono.bono.vendedor,
        local: this.user.local,
        precioBajo: false,
        precioBono: bono.bono.precioBono,
        excedente: bono.excedente,
        productoDevueltoId: bono.bono.producto.id,
      };

      const ok = await this.salesService.agregarVentaYEliminarPedido(
        ventaNueva,
        this.pedidoSeleccionado.id,
      );

      if (ok) {
        const actualizada = await this.salesService.actualizarVentaPorId(
          bono.bono.producto.id,
          { tipoVenta: 'Devuelto por bono' },
        );

        if (!actualizada) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Venta registrada',
            detail:
              'La venta se registró pero no se actualizó el bono anterior.',
          });
        } else {
          this.messageService.add({
            severity: 'success',
            summary: 'Bono redimido',
            detail: 'Se registró la venta con bono correctamente.',
          });
        }

        try {
          await this.bonosService.borrarBono(bono.bono.id);
        } catch (error) {
          console.error('Error al eliminar bono:', error);
          this.messageService.add({
            severity: 'warn',
            summary: 'Bono no eliminado',
            detail: 'La venta fue registrada, pero no se eliminó el bono.',
          });
        }

        try {
          await this.pushNotificationService.enviarNotificacionAAdmins({
            title: '🎟️ Bono redimido',
            body: `${ventaNueva.vendedor} redimió un bono — ${ventaNueva.marca} ${ventaNueva.referencia} - Talla ${ventaNueva.talla}`,
            data: {
              zapatoId: ventaNueva.zapatoId.toString(),
              talla: ventaNueva.talla,
              local: this.user?.local?.toString() || '',
              tipo: 'bono-redimido',
            },
          });
        } catch (err) {
          console.error('Error enviando notificación bono:', err);
        }
      } else {
        await this.orderService.quitarBloqueo(this.pedidoSeleccionado.id);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo registrar la venta con bono. Intenta de nuevo.',
        });
      }
    } catch (error) {
      await this.orderService.quitarBloqueo(this.pedidoSeleccionado.id);
      this.messageService.add({
        severity: 'error',
        summary: 'Error inesperado',
        detail: 'Algo salió mal al redimir el bono.',
      });
    } finally {
      this.mostrarModalBono = false;
      this.procesandoAccion = false;
    }
  }

  cerrarModalBono() {
    this.mostrarModalBono = false;
  }

  get noHayPedidos(): boolean {
    return this.seccionesPedidos.every((s) => s.pedidos.length === 0);
  }

  ngOnDestroy(): void {
    this.prestamosService.desregistrar();
    this.catalogoService.desregistrar();
    this.orderService.desregistrar();
    this.pedidosSub.unsubscribe();
  }
}
