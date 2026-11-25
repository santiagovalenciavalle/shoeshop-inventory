import {
  Component,
  EventEmitter,
  Input,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { InputNumberModule } from 'primeng/inputnumber';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ingresoTalla, Products } from '../../../pages/interfaces';
import { ButtonModule } from 'primeng/button';
import { RegistroIngresosService } from '../../../services/administracion/registro de ingresos/registro-ingresos.service';
import { AuthService } from '../../../services/auth/auth.service';
import { BluetoothPrinterService } from '../../../services/bluetooth-printer/bluetooth-printer.service';
import {
  DEFAULT_LABEL_CONFIG,
  LabelTemplate,
  LabelVariables,
  PrinterTemplate,
  PrinterTemplateService,
} from '../../../services/printer-template/printer-template.service';

const FALLBACK_TEMPLATE: LabelTemplate = {
  nombre: 'Default',
  width: 50,
  height: 30,
  gap: 3,
  cols: 2,
  copies: 1,
  elements: [],
};
@Component({
  selector: 'app-add-numeracion',
  standalone: true,
  imports: [InputNumberModule, CommonModule, FormsModule, ButtonModule],
  templateUrl: './add-numeracion.component.html',
  styleUrl: './add-numeracion.component.css',
})
export class AddNumeracionComponent {
  @Input() producto: Products | null = null;
  @Input() soloLectura: boolean = false;
  @Output() actualizarTallas = new EventEmitter<Products>();
  @Output() cerrar = new EventEmitter<void>();

  private printerService = inject(BluetoothPrinterService);
  private templateService = inject(PrinterTemplateService);
  private registroIngresosService = inject(RegistroIngresosService);
  private authService = inject(AuthService);

  numbers = Array.from({ length: 23 }, (_, i) => i + 28);
  values: { [key: number]: number } = {};
  stockSuma = 0;
  user: any;
  guardando = false;

  modalImprimir = signal(false);
  imprimiendo = signal(false);
  tallasGuardadas: { talla: number; cantidad: number }[] = [];
  productoGuardado: Products | null = null;

  ngOnInit(): void {
    this.user = this.authService.getCurrentUser();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const productoCambió = changes['producto'] && this.producto;
    const modoCambió = changes['soloLectura'];
    if ((productoCambió || modoCambió) && this.producto != null) {
      if (this.soloLectura && this.producto.tallasDisponibles) {
        this.values = { ...this.producto.tallasDisponibles };
      } else {
        this.values = {};
      }
    }
    this.user = this.authService.getCurrentUser();
  }

  get total(): number {
    return Object.values(this.values).reduce((acc, val) => acc + (val || 0), 0);
  }

  async guardar() {
    if (!this.producto || this.guardando) return;
    this.guardando = true;

    try {
      const nuevasTallas = { ...this.producto.tallasDisponibles };

      for (const talla of this.numbers) {
        const cantidad = this.values[talla] || 0;
        nuevasTallas[talla] = (nuevasTallas[talla] || 0) + cantidad;
      }

      this.stockSuma = this.producto.stock + this.total;

      if (this.total > 0) {
        const nuevoIngreso: ingresoTalla = {
          zapatoId: this.producto.id,
          marca: this.producto.marca,
          referencia: this.producto.referencia,
          fecha: new Date(),
          nombre: this.user.name,
          cantIngresada: this.total.toString(),
        };
        await this.registroIngresosService.nuevoIngresoProducto(nuevoIngreso);
      }

      const nuevoStock = Object.values(nuevasTallas).reduce(
        (acc, val) => acc + (val || 0),
        0,
      );

      const productoActualizado: Products = {
        ...this.producto,
        tallasDisponibles: nuevasTallas,
        stock: nuevoStock,
        stockInicial: this.stockSuma,
      };

      this.actualizarTallas.emit(productoActualizado);

      this.tallasGuardadas = this.numbers
        .filter((t) => (this.values[t] || 0) > 0)
        .map((t) => ({ talla: t, cantidad: this.values[t] }));

      this.productoGuardado = productoActualizado;
      this.limpiarFormulario();

      if (
        this.printerService.isConnected() &&
        this.tallasGuardadas.length > 0
      ) {
        this.modalImprimir.set(true);
      } else {
        this.cerrar.emit();
      }
    } finally {
      this.guardando = false;
    }
  }

  async confirmarImpresion(): Promise<void> {
    if (!this.productoGuardado || !this.tallasGuardadas.length) return;
    this.imprimiendo.set(true);

    try {
      const baseTemplate =
        this.templateService.activeTemplate() ?? FALLBACK_TEMPLATE;

      const template: LabelTemplate = {
        ...baseTemplate,
        elements: baseTemplate.elements.map((el) => {
          const content: string =
            'content' in el ? String((el as any).content ?? '') : '';
          if (
            content.includes('local') ||
            content.includes('Local') ||
            content.includes('LOCAL')
          ) {
            return { ...el, visible: false };
          }
          if (el.type === 'qr') {
            return { ...el, visible: true };
          }
          return el;
        }),
      };

      const allVars: LabelVariables[] = [];
      for (const { talla, cantidad } of this.tallasGuardadas) {
        for (let i = 0; i < cantidad; i++) {
          allVars.push({
            marca: this.productoGuardado!.marca,
            referencia: this.productoGuardado!.referencia,
            codigo: this.productoGuardado!.id.toString(),
            talla: talla.toString(),
          });
        }
      }

      await this.printerService.printMultiple(template, allVars);
    } finally {
      this.imprimiendo.set(false);
      this.modalImprimir.set(false);
      this.cerrar.emit();
    }
  }

  get totalStickers(): number {
    return this.tallasGuardadas.reduce((acc, t) => acc + t.cantidad, 0);
  }

  cancelarImpresion() {
    this.modalImprimir.set(false);
    this.cerrar.emit();
  }

  limpiarFormulario() {
    this.values = {};
  }

  omitirImpresion(): void {
    this.modalImprimir.set(false);
    this.cerrar.emit();
  }
}
