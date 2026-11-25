import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { SelectModule } from 'primeng/select';
import { exhibiciones, Pedido, Products } from '../../../pages/interfaces';
import { OrderService } from '../../../services/vendedorServices/order.service';
import { v4 as uuidv4 } from 'uuid';
import { AuthService } from '../../../services/auth/auth.service';
import { UsuarioService } from '../../../services/administracion/usuarios/usuario.service';
import { ExhibicionesService } from '../../../services/vendedorServices/exhibiciones/exhibiciones.service';
import { PushNotificationService } from '../../../services/notifications push/push-notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-producto-detalle',
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    FormsModule,
    ToastModule,
    SelectModule,
  ],
  templateUrl: './producto-detalle.component.html',
  styleUrl: './producto-detalle.component.css',
  providers: [MessageService],
})
export class ProductoDetalleComponent {
  @Input() visible: boolean = false;
  @Input() producto: Products | null = null;
  @Input() esVendedor: boolean = true;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() solicitar = new EventEmitter<void>();

  nombreVendedor: string = '';
  cargando: boolean = false;

  exhibiciones: exhibiciones[] = [];
  cargandoExhibiciones: boolean = false;

  tallaSeleccionada: number | null = null;
  localSeleccionado: any;

  /** Pedidos pendientes por talla (en tiempo real): definen qué tallas están reservadas. */
  pendientes: Record<string, number> = {};
  private pendientesSub: Subscription | null = null;
  private pendientesDe: number | null = null;
  readonly textoReservada =
    'Reservada: ya hay un pedido pendiente por esta talla';
  tallasDisponiblesFiltradas: any[] = [];

  tallasDisponibles = [
    { label: '35', value: 35 },
    { label: '36', value: 36 },
    { label: '37', value: 37 },
    { label: '38', value: 38 },
    { label: '39', value: 39 },
    { label: '40', value: 40 },
    { label: '41', value: 41 },
    { label: '42', value: 42 },
    { label: '43', value: 43 },
    { label: '44', value: 44 },
    { label: '45', value: 45 },
  ];

  tallas = [
    { label: 'Seleccionar talla', value: null },
    { label: '36', value: 36 },
    { label: '37', value: 37 },
    { label: '38', value: 38 },
    { label: '39', value: 39 },
    { label: '40', value: 40 },
    { label: '41', value: 41 },
    { label: '42', value: 42 },
    { label: '43', value: 43 },
    { label: '44', value: 44 },
    { label: '45', value: 45 },
  ];

  constructor(
    private messageService: MessageService,
    private orderService: OrderService,
    private authService: AuthService,
    private UsuarioService: UsuarioService,
    private exhibicionesService: ExhibicionesService,
    private notificationService: PushNotificationService,
  ) {}

  ngOnInit(): void {
    // El catálogo público no tiene sesión: no puede (ni necesita) leer usuarios
    if (this.esVendedor) this.UsuarioService.initUsuarios();
    const currentUser = this.authService.getCurrentUser();
    this.localSeleccionado = currentUser?.local;
    if (currentUser && currentUser.role === 'vendedor') {
      this.nombreVendedor = currentUser.name;
    }
  }

  ngOnDestroy(): void {
    this.orderService.desregistrar();
    this.dejarDeEscucharPendientes();
  }

  private dejarDeEscucharPendientes(): void {
    this.pendientesSub?.unsubscribe();
    this.pendientesSub = null;
    this.pendientesDe = null;
    this.pendientes = {};
  }

  /** Escucha los pedidos pendientes de la referencia abierta (solo mientras el detalle está visible). */
  private escucharPendientes(): void {
    const id = Number(this.producto?.id);
    if (!this.esVendedor || !this.visible || !this.producto || !Number.isFinite(id)) {
      this.dejarDeEscucharPendientes();
      return;
    }
    if (this.pendientesDe === id && this.pendientesSub) return;
    this.dejarDeEscucharPendientes();
    this.pendientesDe = id;
    this.pendientesSub = this.orderService.pendientesPorTalla$(id).subscribe({
      next: (porTalla) => {
        this.pendientes = porTalla;
        // Si la talla elegida quedó reservada por otro pedido, se suelta la selección
        if (
          this.tallaSeleccionada != null &&
          this.estaReservada(this.tallaSeleccionada)
        ) {
          this.tallaSeleccionada = null;
        }
      },
      error: (e) => console.error('Error escuchando pedidos pendientes', e),
    });
  }

  private estaReservada(talla: number): boolean {
    const enBodega = Number(this.producto?.tallasDisponibles?.[talla] ?? 0);
    return (this.pendientes[String(talla)] ?? 0) >= enBodega;
  }

  /** La talla tiene tantos pedidos pendientes como pares en bodega: no se puede pedir otra vez. */
  tallaReservada(talla: { value: number }): boolean {
    return this.estaReservada(talla.value);
  }

  ngOnChanges(): void {
    this.escucharPendientes();
    if (!this.producto?.id) return;

    if (this.producto.tallasDisponibles) {
      this.tallasDisponiblesFiltradas = Object.entries(
        this.producto.tallasDisponibles,
      )
        .filter(([_, cantidad]) => cantidad > 0)
        .map(([talla, cantidad]) => ({
          label: talla,
          value: Number(talla),
          cantidad,
        }));
      this.tallaSeleccionada = null;
    }

    this.cargarExhibiciones();
  }

  async cargarExhibiciones(): Promise<void> {
    // Solo los vendedores ven exhibiciones; el público no tiene permiso para leerlas
    if (!this.producto?.id || !this.esVendedor) return;

    this.cargandoExhibiciones = true;

    try {
      this.exhibiciones =
        await this.exhibicionesService.obtenerExhibicionesPorZapatoId(
          this.producto.id,
        );
    } catch (error) {
      console.error('Error cargando exhibiciones', error);
      this.exhibiciones = [];
    } finally {
      this.cargandoExhibiciones = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible) this.cerrarDialogo();
  }

  get tallasOrdenadas(): { label: string; value: number; cantidad: number }[] {
    return [...this.tallasDisponiblesFiltradas].sort(
      (a, b) => a.value - b.value,
    );
  }

  seleccionarTalla(valor: number): void {
    if (this.estaReservada(valor)) return;
    this.tallaSeleccionada = this.tallaSeleccionada === valor ? null : valor;
  }

  cerrarDialogo() {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  generarLinkWhatsApp(): string {
    const numero = '570000000000';
    const marca = this.producto?.marca || '';
    const referencia = this.producto?.referencia || '';
    const codigo = this.producto?.id || '';
    const mensaje = `Hola, estoy interesado en conocer las tallas y precios del  ${marca} - ${referencia} - Código: ${codigo}. ¿Podrías proporcionarme esa información, por favor? ¡Gracias!`;
    return `https://api.whatsapp.com/send?phone=${numero}&text=${encodeURIComponent(
      mensaje,
    )}`;
  }

  solicitarProducto() {
    if (this.cargando) return;
    if (!this.tallaSeleccionada || !this.producto) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Campos requeridos',
        detail: 'Por favor, seleccione una talla antes de solicitar.',
      });
      return;
    }

    const cantidadDisponible =
      this.producto.tallasDisponibles[this.tallaSeleccionada];
    if (cantidadDisponible <= 0) {
      this.messageService.add({
        severity: 'error',
        summary: 'Sin stock',
        detail: `No hay disponibilidad para la talla ${this.tallaSeleccionada}.`,
      });
      return;
    }

    this.cargando = true;

    const { referencia, marca, imagen, id: zapatoId, fila } = this.producto;
    const nuevoPedido: Pedido = {
      id: uuidv4(),
      marca,
      zapatoId,
      referencia,
      talla: this.tallaSeleccionada.toString(),
      imagen,
      fila,
      estado: 'Pendiente',
      local: this.localSeleccionado,
      hora: new Date().toISOString(),
      vendedor: this.nombreVendedor,
    };

    this.orderService
      .solicitarPedidoConReserva(nuevoPedido)
      .then(async () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Solicitud Enviada',
          detail: `Se ha enviado la solicitud para ${nuevoPedido.marca} ${nuevoPedido.referencia}, talla ${nuevoPedido.talla}, local ${this.localSeleccionado}.`,
          life: 3000,
        });

        try {
          await this.notificationService.enviarNotificacionABodegueros({
            title: '📦 Nuevo pedido',
            body: `${nuevoPedido.vendedor} solicitó ${nuevoPedido.marca} ${nuevoPedido.referencia} - Talla ${nuevoPedido.talla} - Local ${nuevoPedido.local}`,
            data: {
              zapatoId: nuevoPedido.zapatoId.toString(),
              talla: nuevoPedido.talla,
              local: nuevoPedido.local?.toString() || 'no asignado',
            },
          });
        } catch (err) {
          console.error('Error enviando notificación a bodegueros:', err);
        }

        this.tallaSeleccionada = null;
        this.localSeleccionado = null;
        this.solicitar.emit();
        this.cerrarDialogo();
      })
      .catch((error) => {
        const codigo = String(error?.message ?? '');
        if (codigo === 'TALLA_RESERVADA') {
          this.messageService.add({
            severity: 'warn',
            summary: 'Talla reservada',
            detail: `La talla ${this.tallaSeleccionada} ya tiene un pedido pendiente. Podrás pedirla si bodega lo rechaza o llega más stock.`,
            life: 5000,
          });
          this.tallaSeleccionada = null;
        } else if (codigo === 'SIN_STOCK') {
          this.messageService.add({
            severity: 'error',
            summary: 'Sin stock',
            detail: `Ya no hay disponibilidad para la talla ${this.tallaSeleccionada}.`,
          });
          this.tallaSeleccionada = null;
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error al solicitar',
            detail: 'No se pudo enviar la solicitud. Intenta nuevamente.',
          });
          console.error('Error al agregar pedido:', error);
        }
      })
      .finally(() => {
        this.cargando = false;
      });
  }
}
