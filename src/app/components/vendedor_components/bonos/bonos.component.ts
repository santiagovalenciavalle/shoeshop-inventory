import { Component } from '@angular/core';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { TextareaModule } from 'primeng/textarea';
import { RouterModule } from '@angular/router';
import { TabsModule } from 'primeng/tabs';
import { InputNumberModule } from 'primeng/inputnumber';
import { ModalBuscarProductoComponent } from './modal-buscar-producto/modal-buscar-producto.component';
import { Bono, Venta } from '../../../pages/interfaces';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { BonosService } from '../../../services/vendedorServices/bonos/bonos.service';
import { OrderService } from '../../../services/vendedorServices/order.service';
import { CatalogoService } from '../../../services/catalogo/catalogo.service';
import { PushNotificationService } from '../../../services/notifications push/push-notification.service';
import { PedidosLocalesService } from '../../../services/administracion/pedidos-locales/pedidos-locales.service';
import { AccionesLocalesService } from '../../../services/vendedorServices/acciones-locales/acciones-locales.service';

@Component({
  selector: 'app-bonos',
  standalone: true,
  imports: [
    InputTextModule,
    SelectModule,
    ButtonModule,
    FormsModule,
    TextareaModule,
    RouterModule,
    TabsModule,
    InputNumberModule,
    ModalBuscarProductoComponent,
    DialogModule,
    TableModule,
    CommonModule,
    ToastModule,
  ],
  templateUrl: './bonos.component.html',
  styleUrl: './bonos.component.css',
  providers: [MessageService],
})
export class BonosComponent {
  mostrarModalBuscarProducto = false;
  precioBono = 0;
  vendedor: any = '';
  vendedorId: string = '';
  tallaDevolver: string | null = null;
  motivo: string | null = null;
  comentario = '';
  producto: Venta | null = null;
  idBuscar: string = '';
  mostrarModalConfirmacion = false;
  codigoBonoGenerado: string | null = null;
  localActual: string;
  bonos: Bono[] = [];
  numeroCliente: string = '';

  destinoDevolucion: 'bodega' | 'locales' | null = null;
  destinosDevolucion = [
    { label: 'Devolver a bodega', value: 'bodega' },
    { label: 'Devolver a locales', value: 'locales' },
  ];

  motivos = [
    { label: 'Garantía', value: 'garantia' },
    { label: 'Talla', value: 'talla' },
    { label: 'Otro estilo', value: 'otro' },
  ];

  tallasDisponibles = [
    { label: '35', value: '35' },
    { label: '36', value: '36' },
    { label: '37', value: '37' },
    { label: '38', value: '38' },
    { label: '39', value: '39' },
    { label: '40', value: '40' },
    { label: '41', value: '41' },
    { label: '42', value: '42' },
    { label: '43', value: '43' },
    { label: '44', value: '44' },
    { label: '45', value: '45' },
  ];

  constructor(
    private messageService: MessageService,
    private bonosService: BonosService,
    private orderService: OrderService,
    private catalogoService: CatalogoService,
    private pushNotificationService: PushNotificationService,
    private pedidosLocalesService: PedidosLocalesService,
    private accionesLocalesService: AccionesLocalesService,
  ) {}

  ngOnInit(): void {
    this.orderService.registrar();
    this.catalogoService.registrar();
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('currentUser');
      const user = userStr ? JSON.parse(userStr) : null;

      this.vendedor = user?.name ?? '';
      this.vendedorId = user?.id ?? '';
      this.localActual = user?.local ?? null;

      if (user?.id) {
        this.bonosService.getBonos().subscribe({
          next: (bonos) => {
            this.bonos = bonos.filter((bono) => bono.vendedorId === user.id);
          },
          error: (err) => console.error('Error obteniendo bonos:', err),
        });
      }
    }
  }

  ngOnDestroy(): void {
    this.orderService.desregistrar();
    this.catalogoService.desregistrar();
  }

  switchTab(tab: 'crear' | 'ver') {
    const panelCrear = document.getElementById('panelCrear');
    const panelVer = document.getElementById('panelVer');
    const btnCrear = document.getElementById('tabBtnCrear');
    const btnVer = document.getElementById('tabBtnVer');

    if (tab === 'crear') {
      panelCrear?.classList.remove('hidden');
      panelVer?.classList.add('hidden');
      btnCrear?.classList.add('bon-seg-active');
      btnVer?.classList.remove('bon-seg-active');
    } else {
      panelVer?.classList.remove('hidden');
      panelCrear?.classList.add('hidden');
      btnVer?.classList.add('bon-seg-active');
      btnCrear?.classList.remove('bon-seg-active');
    }
  }

  buscarProducto() {
    this.mostrarModalBuscarProducto = true;
  }

  productoSeleccionado(producto: Venta | null) {
    if (producto) {
      this.producto = producto;
    } else {
      this.mostrarModalBuscarProducto = false;
    }
    this.mostrarModalBuscarProducto = false;
  }

  async crearBono() {
    if (!this.producto) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Campos obligatorios',
        detail: 'Verifique que todos los campos estén completos',
        life: 4000,
      });
      return;
    }

    if (!this.destinoDevolucion) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Falta seleccionar destino',
        detail: 'Debes elegir si el producto se devuelve a bodega o a locales.',
        life: 4000,
      });
      return;
    }

    if (this.destinoDevolucion === 'locales' && !this.producto.localOrigenId) {
      this.messageService.add({
        severity: 'error',
        summary: 'No se puede devolver a locales',
        detail:
          'Este producto no tiene un local de origen registrado, no se puede devolver a locales.',
        life: 5000,
      });
      return;
    }

    const precioDelBono = this.producto.precio;
    const nuevoBono: Bono = {
      id: Math.random().toString(36).substring(2, 5),
      precioBono: this.producto.precio,
      vendedor: this.producto.vendedor,
      tallaADevolver: this.producto.talla,
      motivo: this.motivo,
      comentario: this.comentario,
      producto: this.producto,
    };

    const producto = await this.catalogoService.getProductoPorId(
      Number(this.producto.zapatoId),
    );
    const talla = this.producto.talla;

    try {
      await this.bonosService.agregarBono(nuevoBono);
      this.codigoBonoGenerado = nuevoBono.id;
      this.mostrarModalConfirmacion = true;

      if (this.destinoDevolucion === 'bodega') {
        const pedidoDevuelto = {
          id: crypto.randomUUID(),
          zapatoId: Number(this.producto.zapatoId),
          marca: this.producto.marca,
          referencia: this.producto.referencia,
          talla,
          fila: producto?.fila || 'N/A',
          imagen: this.producto.imagen || null,
          estado: 'Devuelto' as const,
          hora: new Date().toISOString(),
          vendedor: this.vendedor,
          local: this.localActual,
          tipoDevolucion: 'bono' as const,
        };

        await this.orderService.agregarPedido(pedidoDevuelto);

        try {
          await this.pushNotificationService.enviarNotificacionABodegueros({
            title: '🎟️ Devolución por bono',
            body: `${this.vendedor} (Local ${this.localActual}) devolvió ${this.producto.marca} ${this.producto.referencia} - Talla ${talla} - Código: ${this.producto.zapatoId}`,
            data: {
              zapatoId: this.producto.zapatoId.toString(),
              talla: talla,
              local: this.localActual?.toString() || '',
              tipo: 'devolucion-bono',
            },
          });
        } catch (err) {
          console.error('Error enviando notificación devolución bono:', err);
        }
      } else {
        await this.accionesLocalesService.crearPedidoDevuelto(
          {
            productoId: Number(this.producto.zapatoId),
            talla: Number(talla),
            marca: this.producto.marca,
            referencia: this.producto.referencia,
            imagen: this.producto.imagen ?? '',
            localOrigenId: this.producto.localOrigenId!,
            localOrigenNombre:
              this.producto.localSalido ?? this.producto.local ?? '',
            devueltoPorNombre: this.vendedor,
            devueltoPorId: this.vendedorId,
            productoDevueltoId: this.producto.id,
          },
          'bono',
        );
      }

      this.messageService.add({
        severity: 'success',
        summary: 'Bono y pedido registrados',
        detail:
          'El bono y su pedido asociado han sido registrados correctamente',
        life: 4000,
      });

      this.limpiarFormulario();
      this.enviarMensajeWhatsApp(
        this.numeroCliente,
        nuevoBono.id,
        precioDelBono,
      );
      this.numeroCliente = null;
    } catch (error) {
      console.error('Error al crear bono o pedido:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo registrar el bono o el pedido',
        life: 4000,
      });
    }
  }

  enviarMensajeWhatsApp(numero: string, codigoBono: string, precioBono: any) {
    if (numero) {
      const telefono = numero.startsWith('+57') ? numero : `+57${numero}`;
      const mensaje = `¡Hola! 👋, desde ShoeShop se ha creado un bono por devolución de ${this.formatearPrecio(
        precioBono,
      )}. Tiene 1 mes para redimirlo con el código: ${codigoBono}`;
      const mensajeCodificado = encodeURIComponent(mensaje);
      const link = `https://api.whatsapp.com/send?phone=${telefono}&text=${mensajeCodificado}`;
      window.open(link, '_blank');
    } else {
      console.warn('Número de cliente no proporcionado.');
    }
  }

  formatearPrecio(valor: any): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(valor);
  }

  limpiarFormulario() {
    this.precioBono = 0;
    this.tallaDevolver = null;
    this.motivo = null;
    this.comentario = '';
    this.producto = null;
    this.destinoDevolucion = null;
  }
}
