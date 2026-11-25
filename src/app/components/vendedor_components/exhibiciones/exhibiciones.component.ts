import {
  ChangeDetectorRef,
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { RippleModule } from 'primeng/ripple';
import { DividerModule } from 'primeng/divider';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { BadgeModule } from 'primeng/badge';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';

import { v4 as uuidv4 } from 'uuid';

import {
  exhibiciones,
  Prestamo,
  Venta,
  Pedido,
} from '../../../pages/interfaces';
import { ExhibicionesService } from '../../../services/vendedorServices/exhibiciones/exhibiciones.service';
import { AuthService } from '../../../services/auth/auth.service';
import { SalesService } from '../../../services/vendedorServices/ventas/sales.service';
import { montoCajaAlAnular } from '../../../services/vendedorServices/ventas/caja-devuelta.util';
import { PrestamosService } from '../../../services/vendedorServices/prestamos/prestamos.service';
import { CatalogoService } from '../../../services/catalogo/catalogo.service';
import { NotificationsService } from '../../../services/notifications/notifications.service';

import { MessageService } from 'primeng/api';

import { ModalVentaComponent } from '../../../pages/vendedor/vendedor-children/mis-pedidos/modal-venta/modal-venta.component';
import { ModalPrestamoComponent } from '../../../pages/vendedor/vendedor-children/mis-pedidos/modal-prestamo/modal-prestamo.component';
import { SkeletonModule } from 'primeng/skeleton';
import {
  Local,
  LocalesService,
} from '../../../services/locales/locales.service';
import { Subscription } from 'rxjs';
import { CambiosComponent } from '../cambios/cambios.component';
import { OrderService } from '../../../services/vendedorServices/order.service';
import { PushNotificationService } from '../../../services/notifications push/push-notification.service';
import { VisibilityService } from '../../../services/visibilitychange/visibility.service';
import {
  collection,
  doc,
  Firestore,
  writeBatch,
} from '@angular/fire/firestore';
import { AvisosLocalOrigenService } from '../../../services/vendedorServices/avisos-local-origen/avisos-local-origen.service';

import { IaSpinnerComponent } from '../../../shared/components/ia-loader/ia-spinner.component';
import { IaLoaderComponent } from '../../../shared/components/ia-loader/ia-loader.component';
@Component({
  selector: 'app-exhibiciones',
  standalone: true,
  imports: [
    IaLoaderComponent,
    IaSpinnerComponent,
    InputTextModule,
    ButtonModule,
    CardModule,
    RippleModule,
    DividerModule,
    CommonModule,
    BadgeModule,
    RouterModule,
    FormsModule,
    ModalVentaComponent,
    ModalPrestamoComponent,
    ToastModule,
    SkeletonModule,
    CambiosComponent,
  ],
  templateUrl: './exhibiciones.component.html',
  styleUrl: './exhibiciones.component.css',
  providers: [MessageService],
})
export class ExhibicionesComponent implements OnInit, OnDestroy {
  allShoes: exhibiciones[] = [];
  filteredShoes: exhibiciones[] = [];
  exhibicionesPendientes: exhibiciones[] = [];
  searchText: string = '';
  user: any;
  searchCode: string = '';
  mostrarModalCambio = false;
  exhibicionSeleccionada: exhibiciones | null = null;
  procesandoAccion = false;
  mostrarModalVenta = false;
  mostrarModalPrestamo = false;
  pedidoSeleccionado: any = null;
  selectedLocal: string = '';
  locales: Local[] = [];
  loading = true;
  cargandoMas = false;
  buscando = false;
  itemsToShow: number = 30;
  mostrarModalConfirmacion = false;
  accionPendiente: 'vender' | 'prestar' | 'cambio' | null = null;
  shoePendiente: exhibiciones | null = null;
  btnPendiente: HTMLButtonElement | null = null;
  plSeleccionado: number | null = null;
  mostrarEscaner = false;
  escaneando = false;
  qrError = '';
  private stream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private jsQR: any = null;

  exhibicionesPendientesRecibir: exhibiciones[] = [];
  mostrarModalRecepcion = false;

  exhibicionRecibiendo: exhibiciones | null = null;
  codigoIngresado: string | number = '';
  errorRecepcion = '';
  procesandoRecepcion = false;

  mostrarEscanerRecepcion = false;
  escaneandoRecepcion = false;
  qrErrorRecepcion = '';
  private streamRecepcion: MediaStream | null = null;
  private animFrameIdRecepcion: number | null = null;
  private jsQRRecepcion: any = null;

  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasEl!: ElementRef<HTMLCanvasElement>;

  @ViewChild('videoElRecepcion')
  videoElRecepcion!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElRecepcion')
  canvasElRecepcion!: ElementRef<HTMLCanvasElement>;

  private subscripcionExhibiciones?: Subscription;

  constructor(
    public exhibicionesService: ExhibicionesService,
    private authService: AuthService,
    private salesService: SalesService,
    private prestamosService: PrestamosService,
    private messageService: MessageService,
    private catalogoService: CatalogoService,
    private notificationsService: NotificationsService,
    private localesService: LocalesService,
    private orderService: OrderService,
    private pushNotificationService: PushNotificationService,
    private cdr: ChangeDetectorRef,
    public visibilityService: VisibilityService,
    private firestore: Firestore,
    private avisosLocalOrigenService: AvisosLocalOrigenService,

    @Inject(PLATFORM_ID) private platformId: Object,
  ) {}

  async ngOnInit(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      this.cargarJsQR();
    }
    this.localesService.registrar();
    this.prestamosService.registrar();
    this.orderService.registrar();
    this.catalogoService.registrar();
    this.scrollToTop();
    this.loading = true;

    try {
      this.user = this.authService.getCurrentUser();
      this.exhibicionesService.cargarTodasExhibiciones();
      this.subscripcionExhibiciones = this.exhibicionesService
        .getExhibiciones$()
        .subscribe((exhibiciones) => {
          this.allShoes = [...exhibiciones];

          this.exhibicionesPendientes = this.allShoes.filter(
            (shoe) =>
              (shoe.estado === 'solicitado' &&
                this.isLocalMatch(shoe.locales)) ||
              (shoe.estado === 'prestamo aceptado' &&
                !this.isLocalMatch(shoe.locales)) ||
              (shoe.estado === 'solicitado' &&
                this.isLocalMatch(shoe.localPedido)) ||
              (shoe.estado === 'pendiente devolucion' &&
                this.isLocalMatch(shoe.localPedido)) ||
              (shoe.estado === 'pendiente devolucion' &&
                this.isLocalMatch(shoe.locales)) ||
              (shoe.estado === 'pendiente devolucion' &&
                this.isLocalMatch(shoe.localPedido)),
          );

          this.exhibicionesPendientesRecibir = this.allShoes.filter(
            (shoe) =>
              shoe.pendienteRecibir === true && this.isLocalMatch(shoe.locales),
          );

          if (
            this.exhibicionRecibiendo &&
            !this.exhibicionesPendientesRecibir.some(
              (e) => e.id === this.exhibicionRecibiendo?.id,
            )
          ) {
            this.cerrarDetalleRecepcion();
          }

          this.aplicarFiltro();
          setTimeout(() => {
            this.loading = false;
          }, 1500);

          this.cdr.detectChanges();
        });

      this.cargarLocales();
    } catch (error) {
      console.error('❌ Error en ngOnInit:', error);
      this.loading = false;
    }
  }

  get validarRestriccionPrecio(): boolean {
    return !!this.user?.restriccionesActivas;
  }

  private async cargarJsQR() {
    try {
      const mod = await import('jsqr' as any);
      this.jsQR = mod.default || mod;
    } catch (e) {
      console.warn('jsQR no disponible:', e);
    }
  }

  async abrirEscaner() {
    this.qrError = '';
    this.mostrarEscaner = true;
    this.escaneando = true;
    setTimeout(() => this.iniciarCamara(), 100);
  }

  private async iniciarCamara() {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      const video = this.videoEl?.nativeElement;
      if (!video) return;
      video.srcObject = this.stream;
      video.setAttribute('playsinline', 'true');
      await video.play();
      this.leerFrames();
    } catch (err: any) {
      this.qrError = 'No se pudo acceder a la cámara. Verifica los permisos.';
      this.escaneando = false;
    }
  }

  private leerFrames() {
    if (!this.jsQR) {
      this.animFrameId = requestAnimationFrame(() => this.leerFrames());
      return;
    }
    const video = this.videoEl?.nativeElement;
    const canvas = this.canvasEl?.nativeElement;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      this.animFrameId = requestAnimationFrame(() => this.leerFrames());
      return;
    }
    const ctx = canvas.getContext('2d')!;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = this.jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });
    if (code?.data) {
      this.onQRDetectado(code.data);
    } else {
      this.animFrameId = requestAnimationFrame(() => this.leerFrames());
    }
  }

  private onQRDetectado(valor: string) {
    this.cerrarEscaner();
    if (navigator.vibrate) navigator.vibrate(80);
    this.searchCode = valor.trim();
    this.onSearchCodeChange();
  }

  cerrarEscaner() {
    this.mostrarEscaner = false;
    this.escaneando = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  ngOnDestroy(): void {
    this.cerrarEscaner();
    this.cerrarEscanerRecepcion();
    this.localesService.desregistrar();
    this.prestamosService.desregistrar();
    this.orderService.desregistrar();
    this.catalogoService.desregistrar();
    if (this.subscripcionExhibiciones) {
      this.subscripcionExhibiciones.unsubscribe();
    }
  }

  cargarLocales(): void {
    this.localesService.obtenerLocales().subscribe({
      next: (data: Local[]) => {
        this.locales = data.map((loc) => ({
          ...loc,
          nombre: loc.nombre.toLowerCase().replace('local ', ''),
        }));
        this.aplicarFiltro();
      },
      error: (error) => {
        console.error('Error al obtener locales:', error);
      },
    });
  }

  get visibleShoes() {
    return this.filteredShoes.slice(0, this.itemsToShow);
  }

  verMas() {
    this.itemsToShow += 30;
  }

  hayMas(): boolean {
    return this.itemsToShow < this.filteredShoes.length;
  }

  aplicarFiltro(): void {
    const term = this.searchText.toLowerCase().trim();
    const code = this.searchCode.trim();

    this.filteredShoes = this.allShoes.filter((shoe) => {
      const coincideLocal =
        !this.selectedLocal || this.selectedLocal === 'todos'
          ? true
          : shoe.locales?.some((loc) =>
              loc.toLowerCase().includes(this.selectedLocal.toLowerCase()),
            );

      const coincideBusqueda =
        term === '' ||
        shoe.marca.toLowerCase().includes(term) ||
        shoe.referencia.toLowerCase().includes(term);

      const coincideCodigo = code === '' || String(shoe.zapatoId) === code;

      return coincideLocal && coincideBusqueda && coincideCodigo;
    });
  }

  async buscarConCarga(): Promise<void> {
    const term = this.searchText.toLowerCase().trim();
    let intentos = 0;
    const maxIntentos = 10;

    this.filteredShoes = this.filtrar(this.allShoes, term);

    while (this.filteredShoes.length < 10 && intentos < maxIntentos) {
      this.cargandoMas = true;
      this.cargandoMas = false;

      const actuales = this.exhibicionesService.getSnapshot();
      this.filteredShoes = this.filtrar(actuales, term);

      intentos++;
    }

    this.aplicarFiltro();
  }

  filtrar(lista: exhibiciones[], term: string): exhibiciones[] {
    return lista.filter(
      (shoe) =>
        shoe.marca.toLowerCase().includes(term) ||
        shoe.referencia.toLowerCase().includes(term),
    );
  }

  async onSearchChange(): Promise<void> {
    this.buscando = true;
    await this.buscarConCarga();
    this.aplicarFiltro();
    this.buscando = false;
  }

  realizarCambioExhibicion(exhibicion: exhibiciones, cardElement: HTMLElement) {
    this.exhibicionSeleccionada = exhibicion;
    this.mostrarModalCambio = true;
  }

  async manejarCambioExhibicion(event: {
    pedido: any;
    excedente: number;
    metodoPago: string;
    fechaAnterior: any;
  }) {
    if (this.procesandoAccion) return;
    const exSelected = this.exhibicionSeleccionada;
    if (!exSelected) return;
    this.procesandoAccion = true;

    try {
      const exhibicionAun = await this.exhibicionesService.existeExhibicion(
        exSelected.id,
      );
      if (!exhibicionAun) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Exhibición ya procesada',
          detail:
            'Esta exhibición ya fue vendida o procesada. Recarga si ves datos desactualizados.',
        });
        this.cerrarModalCambio();
        return;
      }

      let fechaAnteriorDate: Date;
      if (event.fechaAnterior?.seconds) {
        fechaAnteriorDate = new Date(event.fechaAnterior.seconds * 1000);
      } else {
        fechaAnteriorDate = new Date(event.fechaAnterior);
      }

      const hoy = new Date();
      const mismaFecha =
        fechaAnteriorDate.getFullYear() === hoy.getFullYear() &&
        fechaAnteriorDate.getMonth() === hoy.getMonth() &&
        fechaAnteriorDate.getDate() === hoy.getDate();

      const excedenteAcumulado = mismaFecha
        ? (event.excedente || 0) + (event.pedido.excedente || 0)
        : event.excedente || 0;

      const zapatoId = Number(exSelected.zapatoId);
      const producto1 = await this.catalogoService.getProductoPorId(zapatoId);
      const esPrecioBajo =
        producto1 &&
        Number(event.pedido.precio) + (event.excedente ?? 0) <
          producto1.precioMin;

      const nuevaVenta: Venta = {
        id: crypto.randomUUID(),
        zapatoId,
        marca: exSelected.marca,
        referencia: exSelected.referencia,
        talla: exSelected.talla,
        imagen: exSelected.imagen,
        precio: Number(event.pedido.precio) + (event.excedente ?? 0),
        tipoVenta: 'Cambio',
        metodoPago: event.pedido.metodoPago,
        fechaVenta: new Date(),
        vendedor: this.user.name,
        vendedorId: this.user.id,
        local: this.user.local,
        precioBono: Number(event.pedido.precio),
        excedente: excedenteAcumulado,
        metodoExcedente: event.metodoPago,
        productoDevueltoId: event.pedido.id,
        precioBajo: esPrecioBajo,
        esMismoDia: mismaFecha,
        ...(event.pedido.segundoMetodo
          ? { segundoMetodo: event.pedido.segundoMetodo }
          : {}),
      };

      const batch = writeBatch(this.firestore);

      const ventaRef = doc(collection(this.firestore, 'ventas'));
      const ventaLimpia = Object.fromEntries(
        Object.entries(nuevaVenta).filter(([, v]) => v !== undefined),
      );
      batch.set(ventaRef, ventaLimpia);

      const exhibicionRef = doc(
        this.firestore,
        'exhibiciones',
        String(exSelected.id),
      );
      batch.delete(exhibicionRef);

      await batch.commit();

      const producto = await this.catalogoService.getProductoPorId(
        event.pedido.zapatoId,
      );

      const nuevoPedido: Pedido = {
        id: crypto.randomUUID(),
        zapatoId: event.pedido.zapatoId,
        marca: event.pedido.marca,
        referencia: event.pedido.referencia,
        talla: event.pedido.talla,
        imagen: event.pedido.imagen,
        estado: 'Devuelto',
        hora: new Date().toISOString(),
        fila: producto?.fila || 'N/A',
        local: this.user.local,
        vendedor: event.pedido.vendedor,
        precio: event.pedido.precio,
        metodoPago: event.pedido.metodoPago,
        productoDevueltoId: event.pedido.id ?? null,
        tipoDevolucion: 'cambio',
      };

      await this.orderService.agregarPedido(nuevoPedido);

      await this.salesService.actualizarVentaPorId(event.pedido.id, {
        tipoVenta: 'Devuelto por cambio',
        precio: 0,
        DevueltoCambio: true,
        // Si la venta era de otro día, se conserva el dinero que ya recibió el vendedor
        ...(mismaFecha
          ? {}
          : { precioAntesDeCambio: montoCajaAlAnular(event.pedido) }),
      });

      if (esPrecioBajo) {
        try {
          await this.pushNotificationService.enviarNotificacionAAdmins({
            title: '⚠️ Cambio de exhibición bajo precio mínimo',
            body: `${this.user?.name || 'N/A'} realizó un cambio en exhibición ${nuevaVenta.marca} ${nuevaVenta.referencia} - Talla ${nuevaVenta.talla} por $${nuevaVenta.precio} (mín: $${producto1?.precioMin})`,
            data: {
              zapatoId: nuevaVenta.zapatoId.toString(),
              talla: nuevaVenta.talla,
              tipo: 'cambio-exhibicion-precio-bajo',
            },
          });
        } catch (err) {
          console.error(
            'Error enviando notificación precio bajo cambio exhibición:',
            err,
          );
        }
      }

      try {
        await this.pushNotificationService.enviarNotificacionABodegueros({
          title: '🔄 Devolución por cambio de exhibición',
          body: `${this.user?.name || 'N/A'} (Local ${this.user?.local}) devolvió exhibición ${nuevaVenta.marca} ${nuevaVenta.referencia} - Talla ${nuevaVenta.talla}`,
          data: {
            zapatoId: nuevaVenta.zapatoId.toString(),
            talla: nuevaVenta.talla,
            local: this.user?.local?.toString() || '',
            tipo: 'devolucion-cambio-exhibicion',
          },
        });
      } catch (err) {
        console.error(
          'Error enviando notificación devolución cambio exhibición:',
          err,
        );
      }

      if (exSelected.origenLocal) {
        this.avisosLocalOrigenService.agregarAviso({
          id: crypto.randomUUID(),
          tipo: 'cambio-exhibicion-local',
          titulo: 'Cambio en exhibición',
          producto: {
            nombre: nuevaVenta.marca,
            referencia: nuevaVenta.referencia,
            talla: nuevaVenta.talla,
            zapatoId: nuevaVenta.zapatoId,
          },
          fecha: new Date().toLocaleString(),
          fila: producto?.fila || 'N/A',
          nueva: true,
          image: nuevaVenta.imagen,
          vendedor: this.user.name,
          locales: exSelected.locales,
          mensaje: `Se realizó el cambio en una exhibición (cód. ${zapatoId}). Enviarla a los locales: ${
            exSelected.locales?.join(', ') || 'no especificado'
          }.`,
          precioVenta: nuevaVenta.precio,
          localSalido: exSelected.localSalido,
        });
      } else {
        this.notificationsService.agregarNotificacion({
          id: crypto.randomUUID(),
          tipo: 'cambio-exhibicion',
          titulo: 'Cambio en exhibición',
          producto: {
            nombre: nuevaVenta.marca,
            referencia: nuevaVenta.referencia,
            talla: nuevaVenta.talla,
            zapatoId: nuevaVenta.zapatoId,
          },
          fecha: new Date().toLocaleString(),
          fila: producto?.fila || 'N/A',
          nueva: true,
          image: nuevaVenta.imagen,
          vendedor: this.user.name,
          locales: exSelected.locales,
          mensaje: `Se realizó el cambio en una exhibición. Enviarla a los locales: ${
            exSelected.locales?.join(', ') || 'no especificado'
          }.`,
        });
      }

      this.messageService.add({
        severity: 'success',
        summary: 'Cambio realizado',
        detail: 'El cambio de exhibición fue registrado correctamente.',
      });

      this.cerrarModalCambio();
    } catch (e) {
      console.error('Error al procesar cambio exhibición:', e);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo procesar el cambio. Intenta de nuevo.',
      });
    } finally {
      this.procesandoAccion = false;
    }
  }

  cerrarModalCambio() {
    this.mostrarModalCambio = false;
  }

  onSearchCodeChange(): void {
    this.aplicarFiltro();
  }

  async onSearch(): Promise<void> {
    this.buscando = true;
    await this.buscarConCarga();
    this.buscando = false;
  }

  abrirModalVenta(zapato: any) {
    this.pedidoSeleccionado = {
      ...zapato,
      tallas: zapato.tallas || [],
      precio: zapato.precio || null,
    };
    this.mostrarModalVenta = true;
  }

  cerrarModalVenta() {
    this.mostrarModalVenta = false;
    this.pedidoSeleccionado = null;
  }

  abrirConfirmacion(
    shoe: exhibiciones,
    accion: 'vender' | 'prestar' | 'cambio',
    btn?: HTMLButtonElement,
  ): void {
    this.shoePendiente = shoe;
    this.accionPendiente = accion;
    this.btnPendiente = btn ?? null;
    this.mostrarModalConfirmacion = true;
  }
  confirmarAccion(): void {
    this.mostrarModalConfirmacion = false;
    const shoe = this.shoePendiente!;
    const btn = this.btnPendiente;

    switch (this.accionPendiente) {
      case 'vender':
        this.abrirModalVenta(shoe);
        break;
      case 'prestar':
        this.abrirModalPrestamo(shoe);
        break;
      case 'cambio':
        this.realizarCambioExhibicion(shoe, btn!);
        break;
    }

    this.shoePendiente = null;
    this.accionPendiente = null;
    this.btnPendiente = null;
  }

  cancelarConfirmacion(): void {
    this.mostrarModalConfirmacion = false;
    this.shoePendiente = null;
    this.accionPendiente = null;
    this.btnPendiente = null;
  }

  async confirmarVenta(event: any) {
    if (!this.pedidoSeleccionado || this.procesandoAccion) return;
    this.procesandoAccion = true;

    try {
      const zapato = { ...this.pedidoSeleccionado };
      const zapatoId = Number(zapato.zapatoId);
      const producto = await this.catalogoService.getProductoPorId(zapatoId);
      const esPrecioBajo =
        producto &&
        event.precio + (event.segundoMetodo?.precio ?? 0) < producto.precioMin;

      const nuevaVenta: Venta = {
        id: uuidv4(),
        zapatoId,
        vendedor: this.user.name,
        marca: zapato.marca,
        referencia: zapato.referencia,
        talla: zapato.talla,
        imagen: zapato.imagen,
        precio: event.precio + (event.segundoMetodo?.precio ?? 0),
        metodoPago: event.metodo,
        precioMetodoPrincipal: event.precio,
        fechaVenta: new Date(),
        numCliente: event?.numCliente,
        tipoVenta: 'venta exhibicion',
        local: this.user.local,
        precioBajo: esPrecioBajo,
        ...(event.segundoMetodo ? { segundoMetodo: event.segundoMetodo } : {}),
      };

      const batch = writeBatch(this.firestore);

      const ventaRef = doc(collection(this.firestore, 'ventas'));
      const ventaLimpia = Object.fromEntries(
        Object.entries({
          ...nuevaVenta,
          vendedor: this.user.name,
          vendedorId: this.user.id,
        }).filter(([, v]) => v !== undefined),
      );
      batch.set(ventaRef, ventaLimpia);

      const exhibicionRef = doc(
        this.firestore,
        'exhibiciones',
        String(zapato.id),
      );
      batch.delete(exhibicionRef);

      await batch.commit();

      if (nuevaVenta.numCliente) {
        const link = this.salesService.generarLinkWhatsApp(nuevaVenta);
        window.open(link, '_blank');
      }

      if (esPrecioBajo) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Venta por debajo del mínimo',
          detail: 'Se notificará a administración.',
          life: 3000,
        });

        try {
          await this.pushNotificationService.enviarNotificacionAAdmins({
            title: '⚠️ Exhibición vendida bajo precio mínimo',
            body: `${this.user?.name || 'N/A'} vendió exhibición ${nuevaVenta.marca} ${nuevaVenta.referencia} - Talla ${nuevaVenta.talla} por $${nuevaVenta.precio} (mín: $${producto.precioMin})`,
            data: {
              zapatoId: zapatoId.toString(),
              talla: nuevaVenta.talla,
              tipo: 'venta-exhibicion-precio-bajo',
            },
          });
        } catch (err) {
          console.error(
            'Error enviando notificación precio bajo exhibición:',
            err,
          );
        }
      }

      this.messageService.add({
        severity: 'success',
        summary: 'Venta realizada',
        detail: `Se vendió ${nuevaVenta.marca} ${nuevaVenta.referencia}, talla ${nuevaVenta.talla} por $${nuevaVenta.precio}.`,
      });

      if (zapato.origenLocal) {
        this.avisosLocalOrigenService.agregarAviso({
          id: crypto.randomUUID(),
          tipo: 'venta-exhibicion-local',
          producto: {
            nombre: nuevaVenta.marca,
            referencia: nuevaVenta.referencia,
            talla: nuevaVenta.talla,
            zapatoId,
          },
          fecha: new Date().toLocaleString(),
          fila: producto?.fila || 'N/A',
          nueva: true,
          image: zapato.imagen,
          mensaje: `Se vendió una exhibición (cód. ${zapatoId}). Enviarla a los locales: ${
            zapato.locales?.join(', ') || 'no especificado'
          }.`,
          locales: zapato.locales,
          precioVenta: nuevaVenta.precio,
          localSalido: zapato.localSalido,
        });
      } else {
        this.notificationsService.agregarNotificacion({
          id: crypto.randomUUID(),
          tipo: 'venta-exhibicion',
          producto: {
            nombre: nuevaVenta.marca,
            referencia: nuevaVenta.referencia,
            talla: nuevaVenta.talla,
            zapatoId,
          },
          fecha: new Date().toLocaleString(),
          fila: producto?.fila || 'N/A',
          nueva: true,
          image: zapato.imagen,
          mensaje: `Se vendió una exhibición. Enviarla a los locales: ${
            zapato.locales?.join(', ') || 'no especificado'
          }.`,
          locales: zapato.locales,
        });
      }
    } catch (e) {
      console.error('Error al confirmar venta exhibición:', e);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo registrar la venta. Intenta de nuevo.',
      });
    } finally {
      this.mostrarModalVenta = false;
      this.pedidoSeleccionado = null;
      this.procesandoAccion = false;
    }
  }

  async limpiarFiltros(): Promise<void> {
    this.searchText = '';
    this.searchCode = '';
    this.selectedLocal = 'todos';
    this.buscando = true;

    await this.exhibicionesService.cargarTodasExhibiciones();
    this.aplicarFiltro();

    this.buscando = false;
  }

  isLocalMatch(locales: string[] | string): boolean {
    if (!locales || !this.user?.local) return false;

    const userLocalRaw = this.user.local.trim();
    const userLocalNum = userLocalRaw.replace(/[^0-9]/g, '').trim();
    const userLocalNorm = userLocalRaw.toLowerCase();

    const localesArray = Array.isArray(locales) ? locales : [locales];

    return localesArray.some((loc) => {
      if (!loc) return false;
      const locStr = String(loc).trim();
      const locNumMatch = locStr.match(/\d+/);
      const locNum = locNumMatch ? locNumMatch[0] : '';
      const locNorm = locStr.toLowerCase();

      if (locNum && userLocalNum && locNum === userLocalNum) return true;
      if (locNorm === userLocalNorm) return true;
      if (locNorm.includes(userLocalNorm)) return true;
      if (userLocalNorm.includes(locNum) && locNum !== '') return true;

      return false;
    });
  }

  solicitarExhibicion(shoe: exhibiciones): void {
    if (shoe.estado !== 'solicitado') {
      shoe.estado = 'solicitado';
      shoe.porFuera = true;
      shoe.localPedido = 'Local ' + this.user.local;
      shoe.localOriginal = [...(shoe.locales || [])];
      shoe.vendedor = this.user.name;
      shoe.vendedorId = this.user.id;
      shoe.fechaPedido = new Date().toLocaleString();
      this.exhibicionesService.actualizarExhibicion(shoe);

      this.pushNotificationService
        .enviarNotificacionAVendedoresPorLocales(shoe.locales || [], {
          title: '📦 Solicitud de exhibición prestada',
          body: `${this.user.name} ha solicitado la exhibición ${shoe.marca} - ${shoe.referencia} - Talla ${shoe.talla} - Cód: ${shoe.zapatoId}. Acepta el préstamo cuando pase a tu local.`,
          data: {
            zapatoId: shoe.zapatoId?.toString() || '',
            talla: shoe.talla,
            tipo: 'solicitud-exhibicion-prestada',
          },
        })
        .catch((err) =>
          console.error(
            'Error enviando notificación solicitud exhibición:',
            err,
          ),
        );

      this.messageService.add({
        severity: 'success',
        summary: 'Exhibición solicitada',
        detail: 'La exhibición ha sido marcada como solicitada.',
      });
    }
  }

  async aceptarPrestamo(shoe: exhibiciones) {
    shoe.estado = 'prestamo aceptado';
    shoe.fechaAceptado = new Date().toLocaleString();
    shoe.vendedorAceptado = this.user.name;
    await this.exhibicionesService.actualizarExhibicion(shoe);

    if (shoe.localPedido) {
      try {
        await this.pushNotificationService.enviarNotificacionAVendedoresPorLocalExacto(
          shoe.localPedido,
          {
            title: '✅ Préstamo de exhibición aceptado',
            body: `${this.user.name} aceptó el préstamo de la exhibición ${shoe.marca} - ${shoe.referencia} - Talla ${shoe.talla} - Cód: ${shoe.zapatoId}.`,
            data: {
              zapatoId: shoe.zapatoId?.toString() || '',
              talla: shoe.talla,
              tipo: 'prestamo-exhibicion-aceptado',
            },
          },
        );
      } catch (err) {
        console.error('Error enviando notificación préstamo aceptado:', err);
      }
    }

    this.messageService.add({
      severity: 'success',
      summary: 'Préstamo Aceptado',
      detail: `El préstamo para ${shoe.marca} ha sido aceptado.`,
    });
  }

  async aceptarDevolucion(shoe: exhibiciones): Promise<void> {
    try {
      const localPedidoOriginal = shoe.localPedido;

      shoe.estado = 'disponible';
      shoe.porFuera = false;
      shoe.fechaDevAceptada = new Date().toLocaleString();
      shoe.vendedor = null;
      shoe.vendedorId = null;
      shoe.localPedido = null;
      shoe.fechaPedido = null;
      shoe.fechaAceptado = null;
      shoe.vendedorAceptado = null;
      shoe.fechaDevuelto = null;

      const exito = await this.exhibicionesService.actualizarExhibicion(shoe);

      if (exito) {
        if (localPedidoOriginal) {
          try {
            await this.pushNotificationService.enviarNotificacionAVendedoresPorLocalExacto(
              localPedidoOriginal,
              {
                title: '✅ Devolución de exhibición aceptada',
                body: `${this.user.name} aceptó la devolución de la exhibición ${shoe.marca} - ${shoe.referencia} - Talla ${shoe.talla} - Cód: ${shoe.zapatoId}.`,
                data: {
                  zapatoId: shoe.zapatoId?.toString() || '',
                  talla: shoe.talla,
                  tipo: 'devolucion-exhibicion-aceptada',
                },
              },
            );
          } catch (err) {
            console.error(
              'Error enviando notificación devolución aceptada:',
              err,
            );
          }
        }

        this.messageService.add({
          severity: 'success',
          summary: 'Devolución Aceptada',
          detail: `La exhibición ${shoe.marca} - ${shoe.referencia} fue aceptada.`,
        });
      } else {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo aceptar la devolución. Intenta nuevamente.',
        });
      }
    } catch (error) {
      console.error('❌ Error al aceptar devolución:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error inesperado',
        detail: 'Ocurrió un error al aceptar la devolución.',
      });
    }
  }

  async devolverAlLocal(shoe: exhibiciones) {
    shoe.estado = 'pendiente devolucion';
    shoe.fechaDevuelto = new Date().toLocaleString();
    await this.exhibicionesService.actualizarExhibicion(shoe);
    try {
      await this.pushNotificationService.enviarNotificacionAVendedoresPorLocales(
        shoe.locales || [],
        {
          title: '↩️ Devolución de exhibición prestada',
          body: `${this.user.name} devolvió la exhibición ${shoe.marca} - ${shoe.referencia} - Talla ${shoe.talla} - Cód: ${shoe.zapatoId}. Acepta la devolución cuando recibas el zapato.`,
          data: {
            zapatoId: shoe.zapatoId?.toString() || '',
            talla: shoe.talla,
            tipo: 'devolucion-exhibicion-pendiente',
          },
        },
      );
    } catch (err) {
      console.error('Error enviando notificación devolución al local:', err);
    }

    this.messageService.add({
      severity: 'success',
      summary: 'Exhibición devuelta al local, en espera de aceptación',
      detail: `El préstamo para ${shoe.marca} ha sido devuelto.`,
    });
  }

  async abrirModalPrestamo(zapato: any) {
    this.pedidoSeleccionado = {
      ...zapato,
      tallas: zapato.tallas || [],
      precio: zapato.precio || null,
    };

    const producto = await this.catalogoService.getProductoPorId(
      zapato.zapatoId,
    );
    const plNum =
      producto?.pl != null && producto.pl !== '' ? Number(producto.pl) : null;
    this.plSeleccionado = Number.isNaN(plNum as number) ? null : plNum;

    this.mostrarModalPrestamo = true;
  }

  cerrarModalPrestamo() {
    this.mostrarModalPrestamo = false;
    this.pedidoSeleccionado = null;
    this.plSeleccionado = null;
  }

  async confirmarPrestamo(event: any): Promise<void> {
    if (!this.pedidoSeleccionado || this.procesandoAccion) return;
    this.procesandoAccion = true;

    try {
      const pedido = { ...this.pedidoSeleccionado };
      const { zapatoId, precio, local } = event;
      const producto = await this.catalogoService.getProductoPorId(zapatoId);

      const nuevoPrestamo: Prestamo = {
        id: crypto.randomUUID(),
        zapatoId,
        marca: pedido.marca,
        referencia: pedido.referencia,
        talla: pedido.talla,
        imagen: pedido.imagen,
        vendedor: this.user.name,
        vendedorId: this.user.id,
        precio,
        estado: 'prestado',
        localInicio: this.user.local,
        localPrestado: local,
        esprecioBajo: producto ? precio < producto.precioMin : false,
        esPL: event.esPL === true,
        fechaPrestamo: new Date(),
        tipoVenta: 'prestamo Exhibicion',
      };

      const batch = writeBatch(this.firestore);

      const prestamoRef = doc(collection(this.firestore, 'prestamos'));
      const prestamoLimpio = Object.fromEntries(
        Object.entries({ ...nuevoPrestamo, zapatoId: Number(zapatoId) }).filter(
          ([, v]) => v !== undefined,
        ),
      );
      batch.set(prestamoRef, prestamoLimpio);

      const exhibicionRef = doc(
        this.firestore,
        'exhibiciones',
        String(pedido.id),
      );
      batch.delete(exhibicionRef);

      await batch.commit();

      this.messageService.add({
        severity: 'success',
        summary: 'Préstamo registrado',
        detail: `Se registró el préstamo para el local ${local}`,
      });

      if (pedido.origenLocal) {
        this.avisosLocalOrigenService.agregarAviso({
          id: crypto.randomUUID(),
          tipo: 'prestamo-exhibicion-local',
          producto: {
            nombre: nuevoPrestamo.marca,
            referencia: nuevoPrestamo.referencia,
            talla: nuevoPrestamo.talla,
            zapatoId,
          },
          locales: pedido.locales,
          image: pedido.imagen,
          fecha: new Date().toLocaleString(),
          nueva: true,
          fila: producto?.fila || 'N/A',
          mensaje: `Se prestó una exhibición (cód. ${zapatoId}). Enviarla a: ${
            pedido.locales?.join(', ') || 'no especificado'
          }.`,
          precioVenta: nuevoPrestamo.precio,
          localSalido: pedido.localSalido,
        });
      } else {
        this.notificationsService.agregarNotificacion({
          id: crypto.randomUUID(),
          tipo: 'prestamo-exhibicion',
          producto: {
            nombre: nuevoPrestamo.marca,
            referencia: nuevoPrestamo.referencia,
            talla: nuevoPrestamo.talla,
            zapatoId,
          },
          locales: pedido.locales,
          image: pedido.imagen,
          fecha: new Date().toLocaleString(),
          nueva: true,
          fila: producto?.fila || 'N/A',
          mensaje: `Se prestó una exhibición. Enviarla a: ${
            pedido.locales?.join(', ') || 'no especificado'
          }.`,
        });
      }
    } catch (e) {
      console.error('Error al confirmar préstamo exhibición:', e);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo registrar el préstamo. Intenta de nuevo.',
      });
    } finally {
      this.mostrarModalPrestamo = false;
      this.pedidoSeleccionado = null;
      this.procesandoAccion = false;
    }
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private async exhibicionExiste(id: string): Promise<boolean> {
    return this.exhibicionesService.existeExhibicion(id);
  }

  abrirModalRecepcion(): void {
    this.mostrarModalRecepcion = true;
  }

  cerrarModalRecepcion(): void {
    this.cerrarDetalleRecepcion();
    this.mostrarModalRecepcion = false;
  }

  abrirDetalleRecepcion(shoe: exhibiciones): void {
    this.exhibicionRecibiendo = shoe;
    this.codigoIngresado = '';
    this.errorRecepcion = '';
  }

  cerrarDetalleRecepcion(): void {
    this.cerrarEscanerRecepcion();
    this.exhibicionRecibiendo = null;
    this.codigoIngresado = '';
    this.errorRecepcion = '';
  }

  async confirmarCodigoManualRecepcion(): Promise<void> {
    const codigo = String(this.codigoIngresado ?? '').trim();
    if (!codigo) {
      this.errorRecepcion = 'Ingresa un código.';
      return;
    }
    await this.procesarCodigoRecepcion(codigo);
  }

  private async procesarCodigoRecepcion(codigo: string): Promise<void> {
    const shoe = this.exhibicionRecibiendo;
    if (!shoe || this.procesandoRecepcion) return;

    const codigoNormalizado = codigo.trim();
    const zapatoIdNormalizado = String(shoe.zapatoId ?? '').trim();

    if (codigoNormalizado !== zapatoIdNormalizado) {
      this.errorRecepcion = 'El código no coincide con esta exhibición.';
      return;
    }

    this.procesandoRecepcion = true;
    this.errorRecepcion = '';

    try {
      const actualizacion: Partial<exhibiciones> = {
        ...shoe,
        pendienteRecibir: false,
        recibidoPor: this.user.name,
        fechahoraRecibido: new Date(),
      };

      const exito = await this.exhibicionesService.actualizarExhibicion(
        actualizacion as exhibiciones,
      );

      if (exito) {
        this.messageService.add({
          severity: 'success',
          summary: 'Exhibición recibida',
          detail: `${shoe.marca} - ${shoe.referencia} fue marcada como recibida.`,
        });
        this.cerrarDetalleRecepcion();

        if (this.exhibicionesPendientesRecibir.length === 0) {
          this.mostrarModalRecepcion = false;
        }
      } else {
        this.errorRecepcion =
          'No se pudo registrar la recepción. Intenta de nuevo.';
      }
    } catch (error) {
      console.error('Error al recibir exhibición:', error);
      this.errorRecepcion = 'Ocurrió un error inesperado. Intenta de nuevo.';
    } finally {
      this.procesandoRecepcion = false;
    }
  }

  private async cargarJsQRRecepcion() {
    if (this.jsQRRecepcion) return;
    try {
      const mod = await import('jsqr' as any);
      this.jsQRRecepcion = mod.default || mod;
    } catch (e) {
      console.warn('jsQR no disponible (recepción):', e);
    }
  }

  async abrirEscanerRecepcion(): Promise<void> {
    this.qrErrorRecepcion = '';
    this.mostrarEscanerRecepcion = true;
    this.escaneandoRecepcion = true;
    await this.cargarJsQRRecepcion();
    setTimeout(() => this.iniciarCamaraRecepcion(), 100);
  }

  private async iniciarCamaraRecepcion(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      this.streamRecepcion = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      const video = this.videoElRecepcion?.nativeElement;
      if (!video) return;
      video.srcObject = this.streamRecepcion;
      video.setAttribute('playsinline', 'true');
      await video.play();
      this.leerFramesRecepcion();
    } catch (err: any) {
      this.qrErrorRecepcion =
        'No se pudo acceder a la cámara. Verifica los permisos.';
      this.escaneandoRecepcion = false;
    }
  }

  private leerFramesRecepcion(): void {
    if (!this.jsQRRecepcion) {
      this.animFrameIdRecepcion = requestAnimationFrame(() =>
        this.leerFramesRecepcion(),
      );
      return;
    }
    const video = this.videoElRecepcion?.nativeElement;
    const canvas = this.canvasElRecepcion?.nativeElement;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      this.animFrameIdRecepcion = requestAnimationFrame(() =>
        this.leerFramesRecepcion(),
      );
      return;
    }
    const ctx = canvas.getContext('2d')!;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = this.jsQRRecepcion(
      imageData.data,
      imageData.width,
      imageData.height,
      { inversionAttempts: 'dontInvert' },
    );
    if (code?.data) {
      this.onQRDetectadoRecepcion(code.data);
    } else {
      this.animFrameIdRecepcion = requestAnimationFrame(() =>
        this.leerFramesRecepcion(),
      );
    }
  }

  private onQRDetectadoRecepcion(valor: string): void {
    this.cerrarEscanerRecepcion();
    if (navigator.vibrate) navigator.vibrate(80);
    this.procesarCodigoRecepcion(valor.trim());
  }

  cerrarEscanerRecepcion(): void {
    this.mostrarEscanerRecepcion = false;
    this.escaneandoRecepcion = false;
    if (this.animFrameIdRecepcion !== null) {
      cancelAnimationFrame(this.animFrameIdRecepcion);
      this.animFrameIdRecepcion = null;
    }
    if (this.streamRecepcion) {
      this.streamRecepcion.getTracks().forEach((t) => t.stop());
      this.streamRecepcion = null;
    }
  }
}
