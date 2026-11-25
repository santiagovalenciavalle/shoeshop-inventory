import { ChangeDetectorRef, Component } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Pedido } from '../interfaces';
import { TabsModule } from 'primeng/tabs';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { OrderService } from '../../services/vendedorServices/order.service';
import { AuthService } from '../../services/auth/auth.service';
import { ToastModule } from 'primeng/toast';
import { Observable } from 'rxjs';
import { NotificationsComponent } from '../../shared/components/notifications/notifications.component';
import { HistorialBodegaService } from '../../services/administracion/registro de bodega/historial-bodega.service';
import { RouterModule } from '@angular/router';
import { OtherSitesComponent } from '../../components/administracion_components/other-sites/other-sites.component';
import { PushNotificationService } from '../../services/notifications push/push-notification.service';
import {
  LabelTemplate,
  PrinterTemplateService,
} from '../../services/printer-template/printer-template.service';
import { BluetoothPrinterService } from '../../services/bluetooth-printer/bluetooth-printer.service';

@Component({
  selector: 'app-bodega',
  standalone: true,
  imports: [
    TabsModule,
    CommonModule,
    ButtonModule,
    ToastModule,
    NotificationsComponent,
    RouterModule,
    OtherSitesComponent,
  ],
  templateUrl: './bodega.component.html',
  styleUrls: ['./bodega.component.css'],
  providers: [MessageService],
})
export class BodegaComponent {
  pedidos$: Observable<Pedido[]>;
  selectedTab = 0;
  esBodega: boolean = true;
  loadingPedidos: { [id: string]: boolean } = {};
  esAdmin: boolean = false;
  estadosFiltrados: (string | null)[] = [
    null,
    'Pendiente',
    'Recibido',
    'Devuelto',
  ];
  showPendientesModal = false;
  pedidosPendientes: Pedido[] = [];

  private audioAlerta: HTMLAudioElement | null = null;
  private pedidosYaDevueltos = new Set<string>();
  nombreUsuario: string = '';
  loading = true;
  constructor(
    private orderService: OrderService,
    private authService: AuthService,
    private messageService: MessageService,
    private historialService: HistorialBodegaService,
    private pushNotificationService: PushNotificationService,
    public printer: BluetoothPrinterService,
    private templateService: PrinterTemplateService,
    private cdr: ChangeDetectorRef,
  ) {}

  user: any;
  showPrintModal = false;
  pedidoParaImprimir: Pedido | null = null;
  printLoading = false;
  devolviendoDirecto = false;
  printSuccess = false;
  printError: string | null = null;
  confirmando = false;
  modoConfirm: 'print' | 'skip' | null = null;

  async ngOnInit() {
    this.orderService.registrar();
    this.loading = true;

    this.pedidos$ = this.orderService.pedidos$;

    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.nombreUsuario = currentUser.name;
      this.esAdmin = currentUser.role === 'admin';
    }

    if (!this.audioAlerta) {
      this.audioAlerta = new Audio('/notificacion.mp3');
      this.audioAlerta.loop = false;

      this.audioAlerta.addEventListener('ended', () => {
        setTimeout(() => {
          if (this.showPendientesModal) {
            this.audioAlerta?.play().catch(() => {});
          }
        }, 1000);
      });
    }

    this.pedidos$.subscribe((pedidos) => {
      this.pedidosPendientes = pedidos.filter((p) => p.estado === 'Pendiente');

      setTimeout(() => {
        this.loading = false;
        this.cdr.markForCheck();
      }, 1000);
      this.cdr.markForCheck();

      if (this.pedidosPendientes.length > 0) {
        this.showPendientesModal = true;
        this.audioAlerta?.play().catch(() => {});
      } else {
        this.showPendientesModal = false;
        this.habilitarScroll();
        this.audioAlerta?.pause();
        this.audioAlerta!.currentTime = 0;
      }
    });
  }

  filtrarPedidos(pedidos: Pedido[], estado: string | null): Pedido[] {
    const estadosPermitidos = ['Pendiente', 'Recibido', 'Devuelto'];

    let pedidosFiltrados = pedidos.filter((p) =>
      estadosPermitidos.includes(p.estado),
    );

    if (estado !== null) {
      pedidosFiltrados = pedidosFiltrados.filter((p) => p.estado === estado);
    }

    return pedidosFiltrados.sort((a, b) => {
      const fechaA = a.hora ? new Date(a.hora).getTime() : 0;
      const fechaB = b.hora ? new Date(b.hora).getTime() : 0;
      return fechaB - fechaA;
    });
  }

  async aceptarPedido(pedido: Pedido) {
    if (this.loadingPedidos[pedido.id]) return;
    if (pedido.estado !== 'Pendiente') return;

    this.loadingPedidos[pedido.id] = true;

    try {
      await this.orderService.aceptarPedidoAtomico(
        pedido.id,
        pedido.zapatoId,
        Number(pedido.talla),
      );

      const fecha = new Date().toISOString();

      await this.historialService.agregarHistorial({
        marca: pedido.marca,
        referencia: pedido.referencia,
        zapatoId: pedido.zapatoId,
        talla: pedido.talla.toString(),
        vendedor: pedido.vendedor,
        fecha,
        tipo: 'salida',
        lugar: 'pedido',
        bodega: this.nombreUsuario,
      });

      this.messageService.add({
        severity: 'success',
        summary: 'Pedido recibido',
        detail: `Pedido de ${pedido.marca}, talla ${pedido.talla} aceptado.`,
      });

      if (pedido.vendedorId) {
        this.pushNotificationService
          .enviarNotificacionAVendedor(pedido.vendedorId, {
            title: '📦 Pedido aceptado',
            body: `${this.nombreUsuario} aceptó tu pedido de ${pedido.marca} ${pedido.referencia} - Talla ${pedido.talla}.`,
            data: {
              zapatoId: pedido.zapatoId.toString(),
              talla: pedido.talla,
              tipo: 'pedido-aceptado',
            },
          })
          .catch((err) => console.error('Error notificación:', err));
      }
    } catch (error: any) {
      const msg = error?.message ?? '';

      if (msg === 'PEDIDO_YA_PROCESADO') {
        this.messageService.add({
          severity: 'warn',
          summary: 'Ya procesado',
          detail: 'Este pedido ya fue tomado por otro usuario.',
        });
        return;
      }

      this.messageService.add({
        severity: 'error',
        summary: 'Error al procesar pedido',
        detail: msg || 'Error desconocido.',
      });
      console.error('❌ Error al aceptar pedido:', error);
    } finally {
      this.loadingPedidos[pedido.id] = false;
    }
  }

  formatDate(fecha: any): string {
    if (fecha) {
      const date = fecha.toDate ? fecha.toDate() : new Date(fecha);

      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      };

      return date.toLocaleString('es-ES', options);
    }
    return '';
  }

  async realizarDevolucion(pedido: Pedido) {
    if (this.loadingPedidos[pedido.id]) return;
    if (pedido.estado !== 'Devuelto') return;

    this.loadingPedidos[pedido.id] = true;

    try {
      await this.orderService.devolverPedidoAtomico(
        pedido.id,
        pedido.zapatoId,
        Number(pedido.talla),
      );

      const fecha = new Date().toISOString();
      await this.historialService.agregarHistorial({
        marca: pedido.marca,
        referencia: pedido.referencia,
        zapatoId: pedido.zapatoId,
        talla: pedido.talla.toString(),
        vendedor: pedido.vendedor,
        fecha,
        tipo: 'devolucion',
        lugar: 'pedido',
        bodega: this.nombreUsuario,
      });

      this.messageService.add({
        severity: 'success',
        summary: 'Devolución realizada',
        detail: `${pedido.marca}, talla ${pedido.talla} devuelto al inventario.`,
      });

      if (pedido.vendedorId) {
        this.pushNotificationService
          .enviarNotificacionAVendedor(pedido.vendedorId, {
            title: '↩️ Devolución aceptada',
            body: `${this.nombreUsuario} aceptó la devolución de ${pedido.marca} talla ${pedido.talla}.`,
            data: {
              zapatoId: pedido.zapatoId.toString(),
              talla: pedido.talla,
              tipo: 'devolucion-aceptada',
            },
          })
          .catch(() => {});
      }

      if (this.printer.isConnected()) {
        this.abrirModalImpresion(pedido);
      }
    } catch (error: any) {
      const msg = error?.message ?? '';
      if (msg === 'DEVOLUCION_YA_PROCESADA') {
        this.messageService.add({
          severity: 'warn',
          summary: 'Ya procesada',
          detail: 'Esta devolución ya fue registrada.',
        });
      } else {
        this.messageService.add({
          severity: 'error',
          summary: 'Error en devolución',
          detail: msg || 'No se pudo completar.',
        });
      }
    } finally {
      this.loadingPedidos[pedido.id] = false;
    }
  }

  getEstadoClase(estado: string): string {
    switch (estado) {
      case 'Pendiente':
        return 'border-red-500';
      case 'Recibido':
        return 'border-green-500';
      case 'Devuelto':
        return 'border-yellow-700';
      default:
        return 'border-gray-300';
    }
  }

  tienePedidos(estado: string): boolean {
    let hayPedidos = false;
    this.pedidos$.subscribe((pedidos) => {
      hayPedidos = pedidos.some((p) => p.estado === estado);
    });
    return hayPedidos;
  }

  getEstadoTexto(estado: string): string {
    switch (estado) {
      case 'Pendiente':
        return 'text-red-400';
      case 'Recibido':
        return 'text-green-400';
      case 'Devuelto':
        return 'text-yellow-700';
      default:
        return 'text-gray-300';
    }
  }

  getTabLabel(estado: string | null): string {
    switch (estado) {
      case 'Pendiente':
        return 'Pendientes';
      case 'Recibido':
        return 'Recibidos';
      case 'Devuelto':
        return 'Devueltos';
      default:
        return 'Todos';
    }
  }

  private habilitarScroll() {
    document.body.style.overflow = '';
  }

  ngOnDestroy(): void {
    this.orderService.desregistrar();
    sessionStorage.removeItem('reloaded');
  }

  cerrarPrintModal() {
    if (this.printLoading || this.devolviendoDirecto) return;
    this.showPrintModal = false;
    this.pedidoParaImprimir = null;
    this.printSuccess = false;
    this.printError = null;
    this.confirmando = false;
    this.modoConfirm = null;
  }

  pedirConfirmacion(modo: 'print' | 'skip') {
    this.modoConfirm = modo;
    this.confirmando = true;
    this.printError = null;
  }

  async confirmar() {
    await this.imprimirSticker();
    this.confirmando = false;
    this.modoConfirm = null;
  }

  abrirModalImpresion(pedido: Pedido) {
    this.pedidoParaImprimir = pedido;
    this.printSuccess = false;
    this.printError = null;
    this.confirmando = false;
    this.modoConfirm = null;
    this.showPrintModal = true;
  }

  cancelarConfirmacion() {
    this.confirmando = false;
    this.modoConfirm = null;
  }

  async connectPrinter() {
    await this.printer.connectBluetooth();
  }

  async imprimirSticker() {
    if (!this.pedidoParaImprimir) return;
    const pedido = this.pedidoParaImprimir;

    this.printLoading = true;
    this.printError = null;

    try {
      const baseTemplate = this.templateService.activeTemplate();
      if (!baseTemplate)
        throw new Error(
          'No hay plantilla activa. Configúrala en el botón de impresora.',
        );

      const template: LabelTemplate = {
        ...baseTemplate,
        elements: baseTemplate.elements.map((el) => {
          const content: string =
            'content' in el ? String((el as any).content ?? '') : '';

          if (content.toLowerCase().includes('local')) {
            return { ...el, visible: false };
          }
          return el;
        }),
      };

      await this.printer.printLabel(template, {
        marca: pedido.marca,
        referencia: pedido.referencia,
        codigo: pedido.zapatoId?.toString() ?? '',
        talla: pedido.talla?.toString() ?? '',
        local: pedido.local ?? '',
      });

      this.printSuccess = true;
      this.confirmando = false;

      setTimeout(() => this.cerrarPrintModal(), 2800);
    } catch (err: any) {
      this.printError = err?.message ?? 'Error al enviar a la impresora';
      this.confirmando = false;
    } finally {
      this.printLoading = false;
    }
  }

  async devolverSinImprimir() {
    if (!this.pedidoParaImprimir) return;
    const pedido = this.pedidoParaImprimir;
    this.devolviendoDirecto = true;
    try {
      await this.ejecutarDevolucion(pedido);
    } finally {
      this.devolviendoDirecto = false;
    }
  }

  private async ejecutarDevolucion(pedido: Pedido) {
    if (this.pedidosYaDevueltos.has(pedido.id)) return;
    this.pedidosYaDevueltos.add(pedido.id);

    this.loadingPedidos[pedido.id] = true;

    try {
      await this.orderService.devolverPedidoAtomico(
        pedido.id,
        pedido.zapatoId,
        Number(pedido.talla),
      );

      const fecha = new Date().toISOString();
      await this.historialService.agregarHistorial({
        marca: pedido.marca,
        referencia: pedido.referencia,
        zapatoId: pedido.zapatoId,
        talla: pedido.talla.toString(),
        vendedor: pedido.vendedor,
        fecha,
        tipo: 'devolucion',
        lugar: 'pedido',
        bodega: this.nombreUsuario,
      });

      this.messageService.add({
        severity: 'success',
        summary: 'Devolución realizada',
        detail: `${pedido.marca}, talla ${pedido.talla} devuelto al inventario.`,
      });

      if (pedido.vendedorId) {
        this.pushNotificationService
          .enviarNotificacionAVendedor(pedido.vendedorId, {
            title: '↩️ Devolución aceptada',
            body: `${this.nombreUsuario} aceptó la devolución de ${pedido.marca} talla ${pedido.talla}.`,
            data: {
              zapatoId: pedido.zapatoId.toString(),
              talla: pedido.talla,
              tipo: 'devolucion-aceptada',
            },
          })
          .catch(() => {});
      }
    } catch (error: any) {
      const msg = error?.message ?? '';
      if (msg !== 'DEVOLUCION_YA_PROCESADA') {
        this.messageService.add({
          severity: 'error',
          summary: 'Error en devolución',
          detail: msg || 'No se pudo completar.',
        });
      }
      this.pedidosYaDevueltos.delete(pedido.id);
    } finally {
      this.loadingPedidos[pedido.id] = false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
