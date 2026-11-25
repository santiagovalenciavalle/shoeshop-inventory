import {
  Component,
  EventEmitter,
  Input,
  Output,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';
import { Pedido, Prestamo } from '../../../../interfaces';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../../services/auth/auth.service';
import { CatalogoService } from '../../../../../services/catalogo/catalogo.service';

@Component({
  selector: 'app-modal-venta',
  imports: [
    DialogModule,
    SelectModule,
    InputTextModule,
    FormsModule,
    ButtonModule,
    InputNumberModule,
    ToastModule,
    CommonModule,
  ],
  templateUrl: './modal-venta.component.html',
  styleUrl: './modal-venta.component.css',
  providers: [MessageService],
  encapsulation: ViewEncapsulation.None,
})
export class ModalVentaComponent {
  @Input() visible: boolean = false;
  @Input() pedido!: Pedido | Prestamo | any;
  @Output() cerrar = new EventEmitter();
  @Output() confirmar = new EventEmitter<{
    precio: number;
    metodo: string;
    segundoMetodo?: {
      precio: number;
      metodo: string;
    };
    talla?: string;
    local?: string;
    numCliente?: string;
    comentario?: string;
  }>();

  @Input() ventaPorAlmacen: boolean = false;
  @Input() exhibicion: boolean = false;
  @Input() precioMinimoVenta: number | null = null;

  @Input() validarPrecioMinimoProducto: boolean = false;

  cargando: boolean = false;
  precioPrincipalTexto: string = '';
  precioSegundoTexto: string = '';

  precioPrincipal: number | null = null;
  precioSegundo: number | null = null;

  precioMinProducto: number | null = null;
  cargandoPrecioMin: boolean = false;

  constructor(
    private messageService: MessageService,
    private authService: AuthService,
    private catalogoService: CatalogoService,
  ) {}

  localSeleccionado: string | null = null;
  precio: number | null = null;
  metodos = [
    { nombre: 'Efectivo', valor: 'efectivo' },
    { nombre: 'Transferencia', valor: 'transferencia' },
    { nombre: 'Sistecrédito', valor: 'sistecredito' },
    { nombre: 'Addi', valor: 'addi' },
    { nombre: 'Bold', valor: 'bold' },
  ];
  numCliente: string | null = null;
  comentario: string = '';
  metodoPrincipal: string | null = null;

  mostrarSegundoMetodo: boolean = false;

  metodoSegundo: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['pedido'] &&
      this.pedido &&
      'precio' in this.pedido &&
      this.pedido.precio
    ) {
      this.precio = this.pedido.precio;
    }

    if (changes['visible'] && this.visible && this.exhibicion) {
      const usuario = this.authService.getCurrentUser();
      this.localSeleccionado = usuario?.local || null;
    }

    if (changes['pedido'] || changes['validarPrecioMinimoProducto']) {
      if (this.validarPrecioMinimoProducto && this.pedido?.zapatoId != null) {
        this.cargarPrecioMinProducto(this.pedido.zapatoId);
      } else {
        this.precioMinProducto = null;
        this.cargandoPrecioMin = false;
      }
    }
  }

  private async cargarPrecioMinProducto(zapatoId: number | string) {
    this.cargandoPrecioMin = true;
    this.precioMinProducto = null;
    try {
      const producto = await this.catalogoService.getProductoPorId(zapatoId);
      this.precioMinProducto = producto?.precioMin ?? null;
    } catch (error) {
      console.error('Error obteniendo precioMin del producto:', error);
      this.precioMinProducto = null;
    } finally {
      this.cargandoPrecioMin = false;
    }
  }

  get totalIngresado(): number {
    const principal = this.precioPrincipal ?? 0;
    const segundo = this.mostrarSegundoMetodo ? (this.precioSegundo ?? 0) : 0;
    return principal + segundo;
  }

  get precioPorDebajoDelPrestamo(): boolean {
    return (
      this.precioMinimoVenta != null &&
      this.totalIngresado < this.precioMinimoVenta
    );
  }

  get precioPorDebajoDelMinProducto(): boolean {
    return (
      this.validarPrecioMinimoProducto &&
      this.precioMinProducto != null &&
      this.totalIngresado < this.precioMinProducto
    );
  }

  get ventaBloqueadaPorPrecio(): boolean {
    return (
      this.precioPorDebajoDelPrestamo ||
      this.precioPorDebajoDelMinProducto ||
      (this.validarPrecioMinimoProducto && this.cargandoPrecioMin)
    );
  }

  cerrarDialog() {
    this.precioPrincipal = null;
    this.metodoPrincipal = null;

    this.precioSegundo = null;
    this.metodoSegundo = null;
    this.mostrarSegundoMetodo = false;

    this.tallaSeleccionada = null;
    this.localSeleccionado = null;
    this.numCliente = null;
    this.comentario = '';

    this.cargando = false;

    this.cerrar.emit();
  }

  confirmarVenta() {
    if (this.cargando || this.cargandoPrecioMin) return;

    if (!this.precioPrincipal || !this.metodoPrincipal) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Campos incompletos',
        detail: 'Precio y método de pago principal son obligatorios.',
      });
      return;
    }

    if (
      this.mostrarSegundoMetodo &&
      (!this.precioSegundo || !this.metodoSegundo)
    ) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Segundo método incompleto',
        detail: 'Completa el segundo método de pago o elimínalo.',
      });
      return;
    }

    if (this.precioPorDebajoDelPrestamo) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Precio no permitido',
        detail: `El total no puede ser menor al precio del préstamo ($${this.precioMinimoVenta?.toLocaleString('es-CO')}).`,
      });
      return;
    }

    if (this.precioPorDebajoDelMinProducto) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Precio no permitido',
        detail: `El total no puede ser menor al precio mínimo del producto ($${this.precioMinProducto?.toLocaleString('es-CO')}).`,
      });
      return;
    }

    this.cargando = true;

    const data: any = {
      precio: this.precioPrincipal,
      metodo: this.metodoPrincipal,
      talla: this.tallaSeleccionada || undefined,
      local: this.localSeleccionado || undefined,
      numCliente: this.numCliente || undefined,
      comentario: this.comentario || undefined,
    };

    if (this.mostrarSegundoMetodo) {
      data.segundoMetodo = {
        precio: this.precioSegundo!,
        metodo: this.metodoSegundo!,
      };
    }

    this.confirmar.emit(data);

    this.resetFormulario();
  }

  resetFormulario() {
    this.precioPrincipal = null;
    this.metodoPrincipal = null;
    this.precioSegundo = null;
    this.metodoSegundo = null;
    this.mostrarSegundoMetodo = false;
    this.numCliente = null;
    this.comentario = '';
    this.cargando = false;
    this.cerrar.emit();
  }

  tallaSeleccionada: any = null;
  obtenerTallasDisponibles() {
    if (!this.pedido || !Array.isArray(this.pedido.tallas)) return [];

    return this.pedido.tallas
      .filter(
        (talla) => typeof talla.cantidad === 'number' && talla.cantidad > 0,
      )
      .map((talla) => ({
        talla: talla.numero,
        cantidad: talla.cantidad,
      }));
  }

  obtenerOpcionesTallas() {
    return this.obtenerTallasDisponibles().map((t) => ({
      label: `${t.talla}`,
      value: t.talla,
    }));
  }

  cerrarModalSegundo() {
    this.mostrarSegundoMetodo = false;
    this.precioSegundoTexto = null;
    this.metodoSegundo = null;
  }

  formatearCOP(valor: string): string {
    return valor.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  onPrecioPrincipalChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const limpio = input.value.replace(/\D/g, '');

    this.precioPrincipal = limpio ? Number(limpio) : null;
    this.precioPrincipalTexto = this.formatearCOP(limpio);
  }

  onPrecioSegundoChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const limpio = input.value.replace(/\D/g, '');

    this.precioSegundo = limpio ? Number(limpio) : null;
    this.precioSegundoTexto = this.formatearCOP(limpio);
  }
}
