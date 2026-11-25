import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { Pedido } from '../../../../interfaces';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { AuthService } from '../../../../../services/auth/auth.service';

import { IaSpinnerComponent } from '../../../../../shared/components/ia-loader/ia-spinner.component';
@Component({
  selector: 'app-modal-prestamo',
  standalone: true,
  imports: [
    IaSpinnerComponent,
    CommonModule,
    DialogModule,
    InputTextModule,
    ButtonModule,
    FormsModule,
    InputNumberModule,
    SelectModule,
    ToastModule,
  ],
  templateUrl: './modal-prestamo.component.html',
  providers: [MessageService],
  encapsulation: ViewEncapsulation.None,
})
export class ModalPrestamoComponent {
  @Input() visible: boolean = false;
  @Input() pedido!: Pedido | any;
  @Input() plMinimo: number | null = null;
  @Output() cerrar = new EventEmitter<void>();
  @Output() confirmar = new EventEmitter<{
    local: string;
    precio: number;
    localInicio?: string;
    zapatoId?: number;
    comentario?: string;
    esPL?: boolean;
  }>();
  @Input() exhibicion: boolean = false;
  cargando: boolean = false;

  constructor(
    private messageService: MessageService,
    private authService: AuthService,
  ) {}
  local: string = '';
  comentario: string = '';
  precio: number | null = null;
  localSeleccionado: string = '';
  user: any;

  ngOnInit(): void {
    this.agregarUsuario();
  }

  agregarUsuario() {
    this.user = this.authService.getCurrentUser();
    this.localSeleccionado = this.user.local;
  }

  get sinRestriccionPrecio(): boolean {
    return !this.authService.getCurrentUser()?.restriccionesActivas;
  }

  get precioPorDebajoDelPl(): boolean {
    if (this.sinRestriccionPrecio) return false;
    return (
      this.plMinimo != null &&
      this.precio != null &&
      this.precio < this.plMinimo
    );
  }

  get precioEsPl(): boolean {
    return (
      this.plMinimo != null &&
      this.precio != null &&
      this.precio === this.plMinimo
    );
  }

  onConfirmar() {
    if (this.cargando) return;

    if (this.precioPorDebajoDelPl) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Precio no permitido',
        detail: `El precio no puede ser menor al precio local ($${this.plMinimo?.toLocaleString('es-CO')}).`,
      });
      return;
    }

    const localFinal = this.exhibicion ? this.localSeleccionado : this.local;
    const camposCompletos =
      this.precio != null &&
      this.precio > 0 &&
      localFinal &&
      localFinal.trim().length > 0;

    if (!camposCompletos) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Completa los campos',
        detail: 'Verifica que todos los campos requeridos estén completos.',
      });
      return;
    }

    this.cargando = true;

    try {
      this.confirmar.emit({
        local: this.local,
        precio: this.precio!,
        localInicio: localFinal,
        zapatoId: this.pedido?.zapatoId,
        comentario: this.comentario,
        esPL: this.precioEsPl,
      });

      this.local = '';
      this.precio = null;
      this.localSeleccionado = '';

      this.cerrarModal();
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Ocurrió un error al registrar el préstamo.',
      });
    } finally {
      this.cargando = false;
    }
    this.agregarUsuario();
  }

  cerrarModal() {
    this.local = '';
    this.precio = null;
    this.cerrar.emit();
    this.agregarUsuario();
  }
}
