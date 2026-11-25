import { CommonModule } from '@angular/common';
import { Component, HostListener, ViewEncapsulation } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { Pedido } from '../../../pages/interfaces';
import { OrderService } from '../../../services/vendedorServices/order.service';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { IaLoaderComponent } from '../../../shared/components/ia-loader/ia-loader.component';
@Component({
  selector: 'app-ver-pedidos-admin',
  imports: [
    IaLoaderComponent,
    CommonModule,
    RippleModule,
    ButtonModule,
    RouterModule,
    ToastModule,
  ],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './ver-pedidos-admin.component.html',
  styleUrls: ['./ver-pedidos-admin.component.css'],
  providers: [MessageService],
})
export class VerPedidosAdminComponent {
  pedidos: Pedido[] = [];
  statuses = [
    { label: 'Pendiente', count: 0 },
    { label: 'Recibido', count: 0 },
    { label: 'Devuelto', count: 0 },
  ];

  pedidosPorEstado: { [key: string]: Pedido[] } = {
    Pendiente: [],
    Recibido: [],
    Devuelto: [],
  };
  pedidoAEliminar: Pedido | null = null;
  eliminandoPedido = false;
  loading = true;
  mostrarScrollTop = false;
  desbloqueando: { [id: string]: boolean } = {};
  constructor(
    private orderService: OrderService,
    private messageService: MessageService,
  ) {}

  ngOnInit() {
    this.scrollToTop();
    this.loading = true;
    this.orderService.registrar();
    this.orderService.obtenerPedidos().subscribe((pedidos) => {
      this.pedidos = pedidos;
      this.organizarPedidos(pedidos);
      this.actualizarConteoEstados(pedidos);

      setTimeout(() => {
        this.loading = false;
      }, 1000);
    });
  }

  async desbloquearPedido(pedido: Pedido, event: Event) {
    event.stopPropagation();
    if (!pedido.id || this.desbloqueando[pedido.id]) return;

    this.desbloqueando[pedido.id] = true;

    const ok = await this.orderService.quitarBloqueo(pedido.id);

    this.messageService.add({
      severity: 'success',
      summary: 'Pedido desbloqueado',
      detail: `El pedido de ${pedido.marca} fue liberado por el administrador.`,
      life: 3000,
    });

    this.desbloqueando[pedido.id] = false;
  }

  ngOnDestroy(): void {
    this.orderService.desregistrar();
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.mostrarScrollTop = window.scrollY > 300;
  }

  organizarPedidos(pedidos: Pedido[]) {
    pedidos.sort(
      (a, b) => new Date(b.hora).getTime() - new Date(a.hora).getTime(),
    );

    this.pedidosPorEstado = {
      Pendiente: pedidos.filter((p) => p.estado === 'Pendiente'),
      Recibido: pedidos.filter((p) => p.estado === 'Recibido'),
      Devuelto: pedidos.filter((p) => p.estado === 'Devuelto'),
    };
  }

  actualizarConteoEstados(pedidos: Pedido[]) {
    const counts = { Pendiente: 0, Recibido: 0, Devuelto: 0 };
    pedidos.forEach((p) => {
      if (counts[p.estado] !== undefined) {
        counts[p.estado]++;
      }
    });
    this.statuses = [
      { label: 'Pendiente', count: counts.Pendiente },
      { label: 'Recibido', count: counts.Recibido },
      { label: 'Devuelto', count: counts.Devuelto },
    ];
  }

  getColorClasses(estado: string): string {
    switch (estado) {
      case 'Pendiente':
        return 'border-yellow-400 text-yellow-500 bg-yellow-100';
      case 'Recibido':
        return 'border-green-400 text-green-500 bg-green-100';
      case 'Devuelto':
        return 'border-rose-400 text-rose-500 bg-rose-100';
      default:
        return 'border-gray-200 text-gray-400 bg-gray-50';
    }
  }

  confirmarEliminar(pedido: Pedido) {
    this.pedidoAEliminar = pedido;
  }

  cancelarEliminar() {
    this.pedidoAEliminar = null;
  }

  async eliminarPedidoConfirmado() {
    if (!this.pedidoAEliminar?.id || this.eliminandoPedido) return;

    this.eliminandoPedido = true;

    const ok = await this.orderService.eliminarPedidoPorId(
      this.pedidoAEliminar.id,
    );

    this.eliminandoPedido = false;

    if (ok) {
      this.messageService.add({
        severity: 'success',
        summary: 'Pedido eliminado',
        detail: 'El pedido se eliminó correctamente.',
        life: 3000,
      });

      this.pedidoAEliminar = null;
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo eliminar el pedido.',
        life: 4000,
      });
    }
  }
}
