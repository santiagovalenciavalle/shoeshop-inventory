import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Products } from '../../../pages/interfaces';
import {
  ItemDistribucion,
  LocalesInventarioService,
} from '../../../services/locales-inventario/locales-inventario.service'; // ajusta la ruta real
import {
  Local,
  LocalesService,
} from '../../../services/locales/locales.service';
import { AuthService } from '../../../services/auth/auth.service';

import { IaSpinnerComponent } from '../../../shared/components/ia-loader/ia-spinner.component';
interface TallaEnvio {
  talla: number;
  disponible: number;
  cantidad: number;
}

interface MensajeModal {
  tipo: 'success' | 'error';
  texto: string;
}

@Component({
  selector: 'app-modal-pasar-locales',
  standalone: true,
  imports: [
    IaSpinnerComponent,CommonModule, FormsModule],
  templateUrl: './modal-pasar-locales.component.html',
})
export class ModalPasarLocalesComponent
  implements OnInit, OnDestroy, OnChanges
{
  @Input() visible = false;
  @Input() producto: Products | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() cerrar = new EventEmitter<void>();

  locales: Local[] = [];
  localSeleccionado: string | null = null;

  tallas: TallaEnvio[] = [];
  enviando = false;
  mensaje: MensajeModal | null = null;
  private mensajeTimeout: any = null;

  user: any;

  constructor(
    private localesInventarioService: LocalesInventarioService,
    private localesService: LocalesService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.user = this.authService.getCurrentUser();
    this.localesService.registrar();
    this.localesService.obtenerLocales().subscribe((locales) => {
      this.locales = locales.filter((l) => l.estado === 'Activo');
    });
  }

  ngOnDestroy(): void {
    this.localesService.desregistrar();
    if (this.mensajeTimeout) clearTimeout(this.mensajeTimeout);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['producto'] || changes['visible']) {
      this.resetFormulario();
    }
  }

  private resetFormulario(): void {
    this.localSeleccionado = null;
    this.enviando = false;
    this.mensaje = null;

    if (!this.producto) {
      this.tallas = [];
      return;
    }

    this.tallas = Object.entries(this.producto.tallasDisponibles ?? {})
      .map(([talla, cantidad]) => ({
        talla: Number(talla),
        disponible: Number(cantidad),
        cantidad: 0,
      }))
      .filter((t) => t.disponible > 0)
      .sort((a, b) => a.talla - b.talla);
  }

  incrementar(t: TallaEnvio): void {
    if (t.cantidad < t.disponible) t.cantidad++;
  }

  decrementar(t: TallaEnvio): void {
    if (t.cantidad > 0) t.cantidad--;
  }

  onCantidadManual(t: TallaEnvio, valor: string): void {
    const num = Math.floor(Number(valor));
    if (isNaN(num) || num < 0) {
      t.cantidad = 0;
      return;
    }
    t.cantidad = Math.min(num, t.disponible);
  }

  get totalAEnviar(): number {
    return this.tallas.reduce((acc, t) => acc + t.cantidad, 0);
  }

  get puedeEnviar(): boolean {
    return (
      !!this.localSeleccionado &&
      this.totalAEnviar > 0 &&
      !this.enviando &&
      !!this.producto
    );
  }

  private mostrarMensaje(msg: MensajeModal, duracionMs = 4000): void {
    if (this.mensajeTimeout) clearTimeout(this.mensajeTimeout);
    this.mensaje = msg;
    this.mensajeTimeout = setTimeout(() => {
      this.mensaje = null;
    }, duracionMs);
  }

  async confirmarEnvio(): Promise<void> {
    if (!this.puedeEnviar || !this.producto || !this.localSeleccionado) return;

    const localInfo = this.locales.find((l) => l.id === this.localSeleccionado);
    if (!localInfo) {
      this.mostrarMensaje({
        tipo: 'error',
        texto: 'Selecciona un local válido.',
      });
      return;
    }

    const items: ItemDistribucion[] = this.tallas
      .filter((t) => t.cantidad > 0)
      .map((t) => ({
        talla: t.talla,
        localId: localInfo.id,
        localNombre: localInfo.nombre,
        cantidad: t.cantidad,
      }));

    this.enviando = true;
    this.mensaje = null;

    try {
      await this.localesInventarioService.trasladarALocales(
        this.producto,
        items,
        this.user?.name ?? 'desconocido',
      );

      this.cerrarModal();
    } catch (error: any) {
      // Mensajes de validación reales del servicio, ej:
      // "No hay suficiente stock de la talla X en bodega (disponible: Y, solicitado: Z)."
      this.enviando = false;
      this.mostrarMensaje({
        tipo: 'error',
        texto: error?.message ?? 'Ocurrió un error al trasladar el producto.',
      });
    }
  }

  onBackdropClick(): void {
    if (this.enviando) return;
    this.cerrarModal();
  }

  cerrarModal(): void {
    this.visible = false;
    this.visibleChange.emit(false);
    this.cerrar.emit();
    this.resetFormulario();
  }
}
