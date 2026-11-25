import { Component } from '@angular/core';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { AddNewRefAlmacenComponent } from './add-new-ref-almacen/add-new-ref-almacen.component';
import { AlmacenService } from '../../../services/vendedorServices/almacen/almacen.service';
import { RouterModule } from '@angular/router';
import { ModalVentaComponent } from '../../../pages/vendedor/vendedor-children/mis-pedidos/modal-venta/modal-venta.component';
import { Pedido, Venta } from '../../../pages/interfaces';
import { BadgeModule } from 'primeng/badge';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { SalesService } from '../../../services/vendedorServices/ventas/sales.service';
import { AuthService } from '../../../services/auth/auth.service';

@Component({
  selector: 'app-almacen',
  imports: [
    InputTextModule,
    ButtonModule,
    CardModule,
    ToggleButtonModule,
    FormsModule,
    CommonModule,
    DialogModule,
    AddNewRefAlmacenComponent,
    RouterModule,
    BadgeModule,
    ToastModule,
    OverlayBadgeModule,
    ModalVentaComponent,
  ],
  templateUrl: './almacen.component.html',
  styleUrl: './almacen.component.css',
  providers: [MessageService],
})
export class AlmacenComponent {
  vistaCuadricula: boolean = true;
  showModal: boolean = false;

  mostrarModalVenta: boolean = false;
  pedidoSeleccionado: Pedido | null | any = null;

  productos = [];
  user: any;

  constructor(
    private almacenService: AlmacenService,
    private messageService: MessageService,
    private salesService: SalesService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.productos = this.almacenService.getProductos();
    this.user = this.authService?.getCurrentUser();
    this.user = this.user.name;
  }

  abrirModal() {
    this.showModal = true;
  }

  filtro: string = '';

  agregarProducto(producto: any) {
    this.almacenService.agregarProducto(producto);
    this.messageService.add({
      severity: 'success',
      summary: 'Nueva Referencia Agregada',
      detail: `Se ha agregado ${producto.marca + ' ' + producto.referencia}`,
    });

    this.productos = this.almacenService.getProductos();
    this.showModal = false;
  }

  abrirModalVenta(pedido: Pedido | any) {
    this.pedidoSeleccionado = pedido;
    this.mostrarModalVenta = true;
  }

  get productosFiltrados() {
    return this.productos.filter(
      (p) =>
        p.marca.toLowerCase().includes(this.filtro.toLowerCase()) ||
        p.referencia.toLowerCase().includes(this.filtro.toLowerCase())
    );
  }

  cerrarModalVenta() {
    this.mostrarModalVenta = false;
    this.pedidoSeleccionado = null;
  }

  confirmarVenta(evento: { precio: number; metodo: string; talla?: any }) {
    if (!this.pedidoSeleccionado) return;

    const generarIdUnico = (): string => {
      return Math.random().toString(36).substr(2, 9);
    };

    const venta: Venta = {
      id: generarIdUnico(),
      zapatoId: Number(this.pedidoSeleccionado.id),
      marca: this.pedidoSeleccionado.marca,
      referencia: this.pedidoSeleccionado.referencia,
      talla: evento.talla?.label || '',
      imagen: this.pedidoSeleccionado.imagen,
      precio: evento.precio,
      local: this.pedidoSeleccionado.local,
      metodoPago: evento.metodo,
      fechaVenta: new Date(),
      tipoVenta: this.pedidoSeleccionado.local,
      vendedor: this.user,
    };

    const exito = this.salesService.agregarVenta(venta);

    if (exito) {
      const tallaVendida = this.pedidoSeleccionado.tallas.find(
        (t) => t.numero === evento.talla.value
      );

      if (tallaVendida && tallaVendida.cantidad > 0) {
        tallaVendida.cantidad -= 1;

        this.messageService.add({
          severity: 'success',
          summary: 'Venta registrada',
          detail: `Venta registrada y se descontó 1 unidad de la talla ${tallaVendida.numero}`,
        });
      } else {
        this.messageService.add({
          severity: 'warn',
          summary: 'Talla no disponible',
          detail: `No hay unidades disponibles para la talla ${evento.talla.label}`,
        });
      }
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Error al registrar venta',
        detail: `Ya existe una venta con ID ${venta.id}`,
      });
    }

    this.cerrarModalVenta();
  }
}
