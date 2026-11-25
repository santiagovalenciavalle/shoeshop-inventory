import {
  Component,
  Input,
  Output,
  EventEmitter,
  SimpleChanges,
  inject,
} from '@angular/core';
import { Pedido, User } from '../../../../interfaces';
import { CommonModule } from '@angular/common';
import { ProgressBarModule } from 'primeng/progressbar';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../../../../services/auth/auth.service';

import { IaSpinnerComponent } from '../../../../../shared/components/ia-loader/ia-spinner.component';
@Component({
  selector: 'app-pedido-card',
  imports: [
    IaSpinnerComponent,CommonModule, ProgressBarModule, ButtonModule],
  templateUrl: './pedido-card.component.html',
  styleUrls: ['./pedido-card.component.css'],
})
export class PedidoCardComponent {
  @Input() pedido!: Pedido;
  @Input() procesando: boolean = false;

  @Input() reconectando: boolean = false;

  @Output() recibido = new EventEmitter<any>();
  @Output() noRecibido = new EventEmitter<any>();
  @Output() vender = new EventEmitter<any>();
  @Output() prestamo = new EventEmitter<any>();
  @Output() devolver = new EventEmitter<any>();
  @Output() cambio = new EventEmitter<any>();
  @Output() bono = new EventEmitter<any>();

  user: User;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.user = this.authService.getCurrentUser();
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.user = this.authService.getCurrentUser();
  }

  get bloqueado(): boolean {
    return (
      this.procesando || this.reconectando || this.pedido?.procesando === true
    );
  }

  marcarRecibido() {
    if (this.bloqueado) return;
    this.recibido.emit();
  }

  marcarNoRecibido() {
    if (this.bloqueado) return;
    this.noRecibido.emit();
  }

  realizarVenta() {
    if (this.bloqueado) return;
    this.vender.emit();
  }

  realizarPrestamo() {
    if (this.bloqueado) return;
    this.prestamo.emit();
  }

  realizarDevolucion() {
    if (this.bloqueado) return;
    this.devolver.emit();
  }

  realizarCambio(cardElement: HTMLElement) {
    if (this.bloqueado) return;
    this.cambio.emit(cardElement);
  }

  aplicarBono() {
    if (this.bloqueado) return;
    this.bono.emit();
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

  getEstadoWidth(estado: string): string {
    switch (estado) {
      case 'Recibido':
        return '100%';
      case 'Aceptado':
        return '75%';
      case 'Pendiente':
        return '50%';
      case 'Devuelto':
        return '25%';
      default:
        return '0%';
    }
  }
}
