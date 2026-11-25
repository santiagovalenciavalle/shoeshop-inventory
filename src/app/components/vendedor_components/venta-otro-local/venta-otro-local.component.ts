import { Component, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { TableModule } from 'primeng/table';
import { RouterModule } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { SalesService } from '../../../services/vendedorServices/ventas/sales.service';
import { Venta } from '../../../pages/interfaces';
import { AuthService } from '../../../services/auth/auth.service';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { InputNumberModule } from 'primeng/inputnumber';

@Component({
  selector: 'app-venta-otro-local',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SelectModule,
    InputTextModule,
    ButtonModule,
    TabsModule,
    TableModule,
    RouterModule,
    ToastModule,
    InputNumberModule,
  ],
  templateUrl: './venta-otro-local.component.html',
  styleUrl: './venta-otro-local.component.css',
  providers: [MessageService],
})
export class VentaOtroLocalComponent implements OnInit {
  ventas: Venta[] = [];
  nuevaVenta: any = {
    precioCompra: null,
    precioVenta: null,
  };

  metodosPago = [
    { nombre: 'Efectivo', valor: 'efectivo' },
    { nombre: 'Transferencia', valor: 'transferencia' },
    { nombre: 'Sistecrédito', valor: 'sistecredito' },
    { nombre: 'Addi', valor: 'addi' },
    { label: 'Bold', value: 'bold' },
  ];

  user: any;
  cargando = false;

  constructor(
    private salesService: SalesService,
    private authService: AuthService,
    private messageService: MessageService,
  ) {}

  ngOnInit(): void {
    this.salesService.getVentas$().subscribe((ventas) => {
      this.ventas = ventas
        .filter((venta) => venta.tipoVenta === 'otro-local')
        .map((venta) => ({
          ...venta,
          fechaVenta:
            (venta.fechaVenta as any).toDate?.() || new Date(venta.fechaVenta),
        }));
    });
    this.user = this.authService.getCurrentUser();
  }

  async registrarVenta() {
    if (this.cargando) return;

    if (
      !this.nuevaVenta.marca?.trim() ||
      !this.nuevaVenta.referencia?.trim() ||
      !this.nuevaVenta.precioCompra ||
      !this.nuevaVenta.precioVenta ||
      !this.nuevaVenta.metodoPago
    ) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Campos incompletos',
        detail:
          'Por favor completa todos los campos antes de registrar la venta.',
      });
      return;
    }

    this.cargando = true;

    const venta: Venta = {
      id: crypto.randomUUID(),
      marca: this.nuevaVenta.marca,
      referencia: this.nuevaVenta.referencia,
      talla: this.nuevaVenta.talla || '',
      precio: Number(this.nuevaVenta.precioVenta),
      metodoPago: this.nuevaVenta.metodoPago?.valor || '',
      fechaVenta: new Date(),
      local: this.user.local || '',
      tipoVenta: 'otro-local',
      vendedor: this.user.name,
      precioCompra: Number(this.nuevaVenta.precioCompra),
    };

    try {
      const fueExitosa = await this.salesService.agregarVenta(venta);

      if (fueExitosa) {
        this.messageService.add({
          severity: 'success',
          summary: 'Venta registrada',
          detail: 'La venta fue registrada exitosamente.',
        });
        this.nuevaVenta = {};
      } else {
        throw new Error('Error al registrar venta');
      }
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo registrar la venta.',
      });
    } finally {
      this.cargando = false;
    }
  }

  limpiarFormulario() {
    if (this.cargando) return;
    this.nuevaVenta = {};
  }
}
