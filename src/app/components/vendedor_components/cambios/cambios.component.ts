import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ModalBuscarProductoComponent } from '../bonos/modal-buscar-producto/modal-buscar-producto.component';
import { ImageModule } from 'primeng/image';
import { exhibiciones, Pedido, Venta } from '../../../pages/interfaces';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';

@Component({
  selector: 'app-cambios',
  standalone: true,
  imports: [
    ButtonModule,
    CardModule,
    CommonModule,
    DialogModule,
    InputTextModule,
    ImageModule,
    FormsModule,
    InputNumberModule,
    ModalBuscarProductoComponent,
  ],
  templateUrl: './cambios.component.html',
  styleUrl: './cambios.component.css',
})
export class CambiosComponent {
  @Input() pedido!: Pedido | exhibiciones;
  @Output() procesarCambio = new EventEmitter<any>();
  @Output() cancelar = new EventEmitter<void>();
  metodoPagoSeleccionado: string | null = null;
  metodosPago = [
    { label: 'Efectivo', value: 'efectivo' },
    { label: 'Transferencia', value: 'transferencia' },
    { label: 'Sistecredito', value: 'sistecredito' },
    { label: 'Addi', value: 'addi' },
    { label: 'Bold', value: 'bold' },
  ];
  modalVisible = false;
  productoSeleccionado: Venta | null = null;
  excedente: number = 0;
  fechaAnterior: any;
  abrirModal() {
    this.modalVisible = true;
  }

  cerrarModal() {
    this.modalVisible = false;
  }

  onProductoSeleccionado(producto: Venta | null) {
    if (producto) {
      this.productoSeleccionado = producto;
      this.fechaAnterior = producto.fechaVenta;

      this.metodoPagoSeleccionado = producto.metodoPago || null;
    }
    this.cerrarModal();
  }

  onCancelar() {
    this.cancelar.emit();
  }

  cancelarAction() {
    this.productoSeleccionado = null;
    this.excedente = 0;
    this.metodoPagoSeleccionado = null;
  }

  procesarCambioClick() {
    if (this.excedente > 0 && !this.metodoPagoSeleccionado) {
      alert('Debe seleccionar un método de pago para el excedente.');
      return;
    }

    this.procesarCambio.emit({
      pedido: this.productoSeleccionado,
      excedente: this.excedente,
      metodoPago: this.metodoPagoSeleccionado,
      fechaAnterior: this.fechaAnterior,
    });
  }

  esBotonDeshabilitado(): boolean {
    if (!this.productoSeleccionado) return true;
    if (this.excedente > 0 && !this.metodoPagoSeleccionado) return true;
    return false;
  }
}
