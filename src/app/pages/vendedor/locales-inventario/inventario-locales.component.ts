import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  Inject,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { debounceTime, of, switchMap } from 'rxjs';
import {
  AvisoExhibicionLocal,
  InventarioLocal,
  PedidoLocal,
  Prestamo,
  Venta,
} from '../../interfaces';
import {
  Local,
  LocalesService,
} from '../../../services/locales/locales.service';
import { LocalesInventarioService } from '../../../services/locales-inventario/locales-inventario.service';
import { PedidosLocalesService } from '../../../services/administracion/pedidos-locales/pedidos-locales.service';
import { AuthService } from '../../../services/auth/auth.service';
import { BonosService } from '../../../services/vendedorServices/bonos/bonos.service';
import { PrestamosService } from '../../../services/vendedorServices/prestamos/prestamos.service';
import { SalesService } from '../../../services/vendedorServices/ventas/sales.service';
import { montoCajaAlAnular } from '../../../services/vendedorServices/ventas/caja-devuelta.util';
import { ModalVentaComponent } from '../vendedor-children/mis-pedidos/modal-venta/modal-venta.component';
import { ModalPrestamoComponent } from '../vendedor-children/mis-pedidos/modal-prestamo/modal-prestamo.component';
import { ModalBonoComponent } from '../vendedor-children/mis-pedidos/modal-bono/modal-bono.component';
import { CambiosComponent } from '../../../components/vendedor_components/cambios/cambios.component';
import {
  AccionesLocalesService,
  ContextoAccionLocal,
} from '../../../services/vendedorServices/acciones-locales/acciones-locales.service';
import { CatalogoService } from '../../../services/catalogo/catalogo.service';
import { PushNotificationService } from '../../../services/notifications push/push-notification.service';
import {
  LabelTemplate,
  LabelVariables,
  PrinterTemplateService,
} from '../../../services/printer-template/printer-template.service';
import { ExhibicionesService } from '../../../services/vendedorServices/exhibiciones/exhibiciones.service';
import { BluetoothPrinterService } from '../../../services/bluetooth-printer/bluetooth-printer.service';
import { ModalEnviarExhibicionLocalComponent } from '../modal-enviar-exhibicion-local/modal-enviar-exhibicion-local.component';
import { HistorialLocalesService } from '../../../services/administracion/HistorialLocalesService/historial-locales.service';
import { AvisosLocalOrigenService } from '../../../services/vendedorServices/avisos-local-origen/avisos-local-origen.service';

import { IaSpinnerComponent } from '../../../shared/components/ia-loader/ia-spinner.component';
import { IaLoaderComponent } from '../../../shared/components/ia-loader/ia-loader.component';
interface TallaConCantidad {
  talla: number;
  cantidad: number;
}

interface ContextoAccion {
  origen: 'inventario' | 'pedidoLocal';
  productoId: number;
  talla: number;
  marca: string;
  referencia: string;
  imagen: string;
  localCodigo: string;
  localDocId: string;
  pedidoLocalId?: string;
}

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
  selector: 'app-inventario-locales',
  standalone: true,
  imports: [
    IaLoaderComponent,
    IaSpinnerComponent,
    CommonModule,
    FormsModule,
    ModalVentaComponent,
    ModalPrestamoComponent,
    ModalBonoComponent,
    CambiosComponent,
    ModalEnviarExhibicionLocalComponent,
  ],
  templateUrl: './inventario-locales.component.html',
  styleUrl: './inventario-locales.component.css',
})
export class InventarioLocalesComponent implements OnInit {
  private localesInventarioService = inject(LocalesInventarioService);
  private localesService = inject(LocalesService);
  private destroyRef = inject(DestroyRef);
  private accionesLocalesService = inject(AccionesLocalesService);
  private catalogoService = inject(CatalogoService);
  private pushNotificationService = inject(PushNotificationService);
  private inventarioCompleto = toSignal(
    this.localesInventarioService.getInventarioCompleto(),
    { initialValue: undefined },
  );
  plSeleccionado = signal<number | null>(null);

  procesandoPedidos = signal<Set<string>>(new Set());
  private historialLocalesService = inject(HistorialLocalesService);
  private setProcesando(id: string, valor: boolean): void {
    this.procesandoPedidos.update((set) => {
      const nuevo = new Set(set);
      if (valor) {
        nuevo.add(id);
      } else {
        nuevo.delete(id);
      }
      return nuevo;
    });
  }

  estaProcesando(id?: string): boolean {
    return !!id && this.procesandoPedidos().has(id);
  }
  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private aContextoLocal(ctx: ContextoAccion): ContextoAccionLocal {
    return {
      origen: ctx.origen,
      productoId: ctx.productoId,
      talla: ctx.talla,
      localDocId: ctx.localDocId,
      pedidoLocalId: ctx.pedidoLocalId,
    };
  }

  private localesRaw = toSignal(this.localesService.obtenerLocales(), {
    initialValue: [] as Local[],
  });

  private salesService = inject(SalesService);
  private prestamosService = inject(PrestamosService);
  private bonosService = inject(BonosService);

  contextoAccion = signal<ContextoAccion | null>(null);

  mostrarModalVenta = signal(false);
  mostrarModalPrestamo = signal(false);
  mostrarModalBono = signal(false);
  mostrarModalCambio = signal(false);
  procesandoAccionLocal = signal(false);

  mensajeAccion = signal<{
    tipo: 'success' | 'error' | 'warn';
    texto: string;
  } | null>(null);
  private mostrarMensaje(
    tipo: 'success' | 'error' | 'warn',
    texto: string,
  ): void {
    this.mensajeAccion.set({ tipo, texto });
    setTimeout(() => this.mensajeAccion.set(null), 3500);
  }

  cargando = computed(() => this.inventarioCompleto() === undefined);

  locales = computed(() =>
    this.localesRaw().filter((l) => l.estado === 'Activo'),
  );

  productoParaModal = computed(() => {
    const ctx = this.contextoAccion();
    if (!ctx) return null;

    return {
      marca: ctx.marca,
      referencia: ctx.referencia,
      imagen: ctx.imagen,
      zapatoId: ctx.productoId,

      tallas: [{ numero: ctx.talla, cantidad: 1 }],
    };
  });

  localSeleccionado = signal<string | null>(null);
  codigoBusqueda = signal('');
  textoBusqueda = signal('');
  tallaSeleccionada = signal<number | null>(null);

  readonly tallasFiltro: number[] = Array.from(
    { length: 46 - 36 + 1 },
    (_, i) => 36 + i,
  );

  private codigoDebounced = toSignal(
    toObservable(this.codigoBusqueda).pipe(debounceTime(250)),
    { initialValue: '' },
  );
  private textoDebounced = toSignal(
    toObservable(this.textoBusqueda).pipe(debounceTime(250)),
    { initialValue: '' },
  );

  inventarioFiltrado = computed(() => {
    const inventario = this.inventarioCompleto() ?? [];
    const codigo = this.codigoDebounced().trim();
    const texto = this.textoDebounced().trim().toLowerCase();
    const local = this.localSeleccionado();
    const talla = this.tallaSeleccionada();

    return inventario
      .filter((item) => {
        const coincideLocal = !local || item.localId === local;
        const coincideCodigo = !codigo || String(item.productoId) === codigo;

        const marca = (item.marca || '').toLowerCase();
        const referencia = (item.referencia || '').toLowerCase();
        const combinado = `${marca} ${referencia}`;
        const combinadoInverso = `${referencia} ${marca}`;

        const coincideTexto =
          !texto ||
          marca.includes(texto) ||
          referencia.includes(texto) ||
          combinado.includes(texto) ||
          combinadoInverso.includes(texto);

        const coincideTalla =
          talla == null || (item.tallasDisponibles?.[talla] ?? 0) > 0;

        return (
          coincideLocal && coincideCodigo && coincideTexto && coincideTalla
        );
      })
      .sort((a, b) => b.productoId - a.productoId);
  });

  private readonly incremento = 30;
  limite = signal(this.incremento);

  quedanMasPorMostrar = computed(
    () => this.inventarioFiltrado().length > this.limite(),
  );

  hayFiltrosActivos = computed(
    () =>
      !!this.localSeleccionado() ||
      !!this.codigoBusqueda().trim() ||
      !!this.textoBusqueda().trim() ||
      this.tallaSeleccionada() != null,
  );

  modalVisible = signal(false);
  productoSeleccionado = signal<InventarioLocal | null>(null);
  tallaSeleccionadaModal = signal<number | null>(null);

  tallasModal = computed(() => {
    const producto = this.productoSeleccionado();
    return producto ? this.tallasOrdenadas(producto) : [];
  });

  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasEl!: ElementRef<HTMLCanvasElement>;

  mostrarEscaner = signal(false);
  qrError = signal('');
  private escaneando = false;
  private stream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private jsQR: any = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    effect(() => {
      this.inventarioFiltrado();
      this.limite.set(this.incremento);
    });
  }

  private pedidosLocalesService = inject(PedidosLocalesService);
  private authService = inject(AuthService);

  currentUser = toSignal(this.authService.user$, {
    initialValue: this.authService.getCurrentUser(),
  });

  private currentUser$ = toObservable(this.currentUser);

  private misSolicitudesRaw = toSignal(
    this.currentUser$.pipe(
      switchMap((user) =>
        user?.id
          ? this.pedidosLocalesService.getPedidosPorSolicitante(user.id)
          : of([] as PedidoLocal[]),
      ),
    ),
    { initialValue: undefined as PedidoLocal[] | undefined },
  );

  private pedidosDeMiLocal = toSignal(
    this.currentUser$.pipe(
      switchMap((user) =>
        user?.local
          ? this.pedidosLocalesService.getPedidosPorLocal(user.local)
          : of([] as PedidoLocal[]),
      ),
    ),
    { initialValue: undefined as PedidoLocal[] | undefined },
  );

  private pedidosDelProductoActual = toSignal(
    toObservable(this.productoSeleccionado).pipe(
      switchMap((producto) =>
        producto?.productoId != null && producto?.localId
          ? this.pedidosLocalesService.getPedidosPorProductoYLocal(
              producto.productoId,
              producto.localId,
            )
          : of([] as PedidoLocal[]),
      ),
    ),
    { initialValue: undefined as PedidoLocal[] | undefined },
  );

  misSolicitudes = computed(() =>
    [...(this.misSolicitudesRaw() ?? [])].sort(
      (a, b) =>
        this.toDate(b.fechaSolicitud).getTime() -
        this.toDate(a.fechaSolicitud).getTime(),
    ),
  );

  pendientesPorAceptar = computed(() =>
    (this.pedidosDeMiLocal() ?? []).filter((p) => p.estado === 'solicitado'),
  );

  devolucionesPorAceptar = computed(() =>
    (this.pedidosDeMiLocal() ?? []).filter((p) => p.estado === 'devuelto'),
  );

  totalPendientes = computed(
    () =>
      this.pendientesPorAceptar().length +
      this.devolucionesPorAceptar().length +
      this.misSolicitudes().length,
  );

  cargandoPendientes = computed(
    () =>
      this.pedidosDeMiLocal() === undefined ||
      this.misSolicitudesRaw() === undefined,
  );

  panelPendientesVisible = signal(false);

  togglePanelPendientes(): void {
    this.panelPendientesVisible.update((v) => !v);
  }

  /**
   * FIX: se compara producto.localNombre (código de tienda, ej. "180")
   * contra user.local (también código de tienda), NUNCA producto.localId,
   * porque ese es el ID de documento de Firestore y no coincide con el
   * código guardado en el usuario.
   */
  esMiLocal = computed(() => {
    const producto = this.productoSeleccionado();
    const user = this.currentUser();
    if (!producto || !user) return false;

    const codigoProducto = String(producto.localNombre ?? '')
      .trim()
      .toLowerCase();
    const codigoUsuario = String(user.local ?? '')
      .trim()
      .toLowerCase();

    return !!codigoProducto && codigoProducto === codigoUsuario;
  });

  cargandoTallasParaSolicitar = computed(
    () => this.pedidosDelProductoActual() === undefined,
  );

  tallasParaSolicitar = computed(() => {
    const pedidosDeEsteProducto = this.pedidosDelProductoActual() ?? [];
    return this.tallasModal().filter(
      (t) => !pedidosDeEsteProducto.some((p) => p.talla === t.talla),
    );
  });

  solicitando = signal(false);
  solicitudConfirmada = signal(false);

  async solicitarZapato(): Promise<void> {
    const producto = this.productoSeleccionado();
    const user = this.currentUser();
    const talla = this.tallaSeleccionadaModal();

    if (!producto || !user || talla == null || this.solicitando()) return;

    this.solicitando.set(true);
    try {
      await this.pedidosLocalesService.solicitar({
        productoId: producto.productoId,
        talla,
        marca: producto.marca,
        referencia: producto.referencia,
        imagen: producto.imagen,
        localOrigenId: producto.localId,
        localOrigenNombre: producto.localNombre,
        solicitadoPorNombre: user.name,
        solicitadoPorId: user.id,
        localSolicitanteId: user.local,
      });

      try {
        await this.pushNotificationService.enviarNotificacionAVendedoresPorLocalExacto(
          producto.localNombre,
          {
            title: '📦 Nueva solicitud de zapato',
            body: `${user.name} (Local ${user.local}) solicitó ${producto.marca} ${producto.referencia} - Talla ${talla}`,
            data: {
              zapatoId: producto.productoId.toString(),
              talla: String(talla),
              local: user.local?.toString() || '',
              tipo: 'solicitud-pedido-local',
            },
          },
        );
      } catch (err) {
        console.error('Error enviando notificación de solicitud:', err);
      }

      this.solicitudConfirmada.set(true);
      setTimeout(() => this.cerrarModal(), 1800);
    } catch (e) {
      console.error(e);
    } finally {
      this.solicitando.set(false);
    }
  }

  async aceptarPedido(pedido: PedidoLocal): Promise<void> {
    const user = this.currentUser();
    if (!user || !pedido.id || this.estaProcesando(pedido.id)) return;

    this.setProcesando(pedido.id, true);
    try {
      await this.pedidosLocalesService.aceptarSolicitud(
        pedido,
        user.name,
        user.id,
      );

      try {
        await this.historialLocalesService.agregarHistorial({
          marca: pedido.marca,
          referencia: pedido.referencia,
          zapatoId: pedido.productoId,
          talla: String(pedido.talla),
          fecha: new Date().toISOString(),
          tipo: 'salida',
          lugar: 'pedido',
          localOrigen: pedido.localOrigenNombre,
          locales: [pedido.localSolicitanteId],
          solicitadoPorNombre: pedido.solicitadoPorNombre,
          solicitadoPorId: pedido.solicitadoPorId,
          fechaSolicitud: this.toDate(pedido.fechaSolicitud).toISOString(),
          aceptadoPorNombre: user.name,
          aceptadoPorId: user.id,
          fechaAceptacion: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Error registrando historial de pedido aceptado:', err);
      }
    } catch (e) {
      console.error(e);
      this.mostrarMensaje(
        'error',
        (e as Error).message ?? 'No se pudo aceptar la solicitud.',
      );
    } finally {
      this.setProcesando(pedido.id, false);
    }
  }

  async devolverPedido(pedido: PedidoLocal): Promise<void> {
    const user = this.currentUser();
    if (!user || !pedido.id || this.estaProcesando(pedido.id)) return;

    this.setProcesando(pedido.id, true);
    try {
      await this.pedidosLocalesService.devolver(pedido, user.name, user.id);

      try {
        await this.pushNotificationService.enviarNotificacionAVendedoresPorLocalExacto(
          pedido.localOrigenNombre,
          {
            title: '↩️ Devolución de pedido',
            body: `${user.name} (Local ${user.local}) devolvió ${pedido.marca} ${pedido.referencia} - Talla ${pedido.talla}`,
            data: {
              zapatoId: pedido.productoId.toString(),
              talla: String(pedido.talla),
              local: user.local?.toString() || '',
              tipo: 'devolucion-pedido-local',
            },
          },
        );
      } catch (err) {
        console.error('Error enviando notificación de devolución:', err);
      }
    } catch (e) {
      console.error(e);
      this.mostrarMensaje('error', 'No se pudo devolver el pedido.');
    } finally {
      this.setProcesando(pedido.id, false);
    }
  }

  async aceptarDevolucionPedido(pedido: PedidoLocal): Promise<void> {
    const user = this.currentUser();
    if (!user || !pedido.id || this.estaProcesando(pedido.id)) return;

    this.setProcesando(pedido.id, true);
    try {
      await this.pedidosLocalesService.aceptarDevolucion(
        pedido,
        user.name,
        user.id,
      );

      try {
        await this.historialLocalesService.agregarHistorial({
          marca: pedido.marca,
          referencia: pedido.referencia,
          zapatoId: pedido.productoId,
          talla: String(pedido.talla),
          fecha: new Date().toISOString(),
          tipo: 'entrada',
          lugar: 'pedido',
          localOrigen: pedido.localSolicitanteId,
          locales: [pedido.localOrigenNombre],
          devueltoPorNombre: pedido.devueltoPorNombre,
          devueltoPorId: pedido.devueltoPorId,
          fechaDevolucion: this.toDate(pedido.fechaDevolucion).toISOString(),
          aceptadoPorNombre: user.name,
          aceptadoPorId: user.id,
          fechaAceptacion: new Date().toISOString(),
        });
      } catch (err) {
        console.error(
          'Error registrando historial de devolución aceptada:',
          err,
        );
      }
    } catch (e) {
      console.error(e);
      this.mostrarMensaje('error', 'No se pudo aceptar la devolución.');
    } finally {
      this.setProcesando(pedido.id, false);
    }
  }

  toDate(fecha: any): Date {
    if (!fecha) return new Date(0);
    if (fecha instanceof Date) return fecha;
    if (typeof fecha?.toDate === 'function') return fecha.toDate();
    return new Date(fecha);
  }

  ngOnInit(): void {
    this.scrollToTop();
    if (isPlatformBrowser(this.platformId)) {
      this.cargarJsQR();
    }
    this.scrollToTop();
  }

  ngOnDestroy(): void {
    this.cerrarEscaner();
  }

  private async cargarJsQR() {
    try {
      const mod = await import('jsqr' as any);
      this.jsQR = mod.default || mod;
    } catch (e) {
      console.warn('jsQR no disponible:', e);
    }
  }

  async abrirEscaner(): Promise<void> {
    this.qrError.set('');
    this.mostrarEscaner.set(true);
    this.escaneando = true;
    setTimeout(() => this.iniciarCamara(), 100);
  }

  private async iniciarCamara(): Promise<void> {
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
    } catch {
      this.qrError.set(
        'No se pudo acceder a la cámara. Verifica los permisos del navegador.',
      );
      this.escaneando = false;
    }
  }

  private leerFrames(): void {
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

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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

  private onQRDetectado(valor: string): void {
    const codigo = valor.trim();
    this.cerrarEscaner();

    if (navigator.vibrate) navigator.vibrate(80);

    this.codigoBusqueda.set(codigo);
  }

  cerrarEscaner(): void {
    this.mostrarEscaner.set(false);
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

  limpiarFiltros(): void {
    this.localSeleccionado.set(null);
    this.codigoBusqueda.set('');
    this.textoBusqueda.set('');
    this.tallaSeleccionada.set(null);
  }

  verMas(): void {
    this.limite.update((v) => v + this.incremento);
  }

  private cache = new WeakMap<object, TallaConCantidad[]>();

  tallasOrdenadas(item: InventarioLocal): TallaConCantidad[] {
    const tallas = item.tallasDisponibles;
    if (!tallas) return [];

    if (this.cache.has(tallas)) {
      return this.cache.get(tallas)!;
    }

    const resultado = Object.entries(tallas)
      .map(([talla, cantidad]) => ({
        talla: Number(talla),
        cantidad: Number(cantidad),
      }))
      .filter((t) => t.cantidad > 0)
      .sort((a, b) => a.talla - b.talla);

    this.cache.set(tallas, resultado);
    return resultado;
  }

  trackById(index: number, item: InventarioLocal): string {
    return item.id ?? `${item.productoId}_${item.localId}`;
  }

  abrirProducto(item: InventarioLocal): void {
    this.productoSeleccionado.set(item);
    const tallas = this.tallasOrdenadas(item);
    this.tallaSeleccionadaModal.set(tallas.length ? tallas[0].talla : null);
    this.modalVisible.set(true);
  }

  cerrarModal(): void {
    this.modalVisible.set(false);
    this.productoSeleccionado.set(null);
    this.tallaSeleccionadaModal.set(null);
    this.solicitudConfirmada.set(false);
    this.solicitando.set(false);
  }

  onBackdropClick(): void {
    this.cerrarModal();
  }

  private contextoDesdeInventario(): ContextoAccion | null {
    const p = this.productoSeleccionado();
    const talla = this.tallaSeleccionadaModal();
    if (!p || talla == null) return null;
    return {
      origen: 'inventario',
      productoId: p.productoId,
      talla,
      marca: p.marca,
      referencia: p.referencia,
      imagen: p.imagen,
      localCodigo: p.localNombre,
      localDocId: p.localId,
    };
  }

  private contextoDesdePedido(p: PedidoLocal): ContextoAccion {
    return {
      origen: 'pedidoLocal',
      productoId: p.productoId,
      talla: p.talla,
      marca: p.marca,
      referencia: p.referencia,
      imagen: p.imagen,
      localCodigo: p.localOrigenNombre,
      localDocId: p.localOrigenId,
      pedidoLocalId: p.id,
    };
  }

  abrirVenta(pedido?: PedidoLocal): void {
    const ctx = pedido
      ? this.contextoDesdePedido(pedido)
      : this.contextoDesdeInventario();
    if (!ctx) return;

    this.contextoAccion.set(ctx);
    this.cerrarModal();
    this.mostrarModalVenta.set(true);
  }

  abrirPrestamo(pedido?: PedidoLocal): void {
    const ctx = pedido
      ? this.contextoDesdePedido(pedido)
      : this.contextoDesdeInventario();
    if (!ctx) return;

    this.contextoAccion.set(ctx);
    this.cerrarModal();
    this.mostrarModalPrestamo.set(true);

    // NUEVO
    this.catalogoService.getProductoPorId(ctx.productoId).then((producto) => {
      const plNum =
        producto?.pl != null && producto.pl !== '' ? Number(producto.pl) : null;
      this.plSeleccionado.set(Number.isNaN(plNum as number) ? null : plNum);
    });
  }

  cerrarModalesAccion(): void {
    this.mostrarModalVenta.set(false);
    this.mostrarModalPrestamo.set(false);
    this.mostrarModalBono.set(false);
    this.mostrarModalCambio.set(false);
    this.contextoAccion.set(null);
    this.plSeleccionado.set(null);
  }

  abrirBono(pedido?: PedidoLocal): void {
    const ctx = pedido
      ? this.contextoDesdePedido(pedido)
      : this.contextoDesdeInventario();
    if (!ctx) return;

    this.contextoAccion.set(ctx);
    this.cerrarModal();
    this.mostrarModalBono.set(true);
  }

  abrirCambio(pedido?: PedidoLocal): void {
    const ctx = pedido
      ? this.contextoDesdePedido(pedido)
      : this.contextoDesdeInventario();
    if (!ctx) return;

    this.contextoAccion.set(ctx);
    this.cerrarModal();
    this.mostrarModalCambio.set(true);
  }

  private async generarIdUnicoVenta(): Promise<string> {
    let id: string;
    let existe = true;
    do {
      id = crypto.randomUUID();
      existe = await this.salesService.idExiste(id);
    } while (existe);
    return id;
  }

  private async resolverOrigen(ctx: ContextoAccion): Promise<void> {
    if (ctx.origen === 'inventario') {
      await this.pedidosLocalesService.descontarStock(
        ctx.productoId,
        ctx.localDocId,
        ctx.talla,
      );
    } else {
      await this.pedidosLocalesService.eliminarPedidoLocal(ctx.pedidoLocalId!);
    }
  }

  async confirmarVentaLocal(data: any): Promise<void> {
    const ctx = this.contextoAccion();
    const user = this.currentUser();
    if (!ctx || !user || this.procesandoAccionLocal()) return;
    this.procesandoAccionLocal.set(true);

    try {
      const id = await this.generarIdUnicoVenta();

      const productoCatalogo = await this.catalogoService.getProductoPorId(
        ctx.productoId,
      );
      const precioFinal = data.precio + (data.segundoMetodo?.precio ?? 0);
      const esPrecioBajo =
        productoCatalogo && precioFinal < productoCatalogo.precioMin;

      const venta: Venta = {
        id,
        zapatoId: ctx.productoId,
        marca: ctx.marca,
        referencia: ctx.referencia,
        talla: String(ctx.talla),
        imagen: ctx.imagen,
        precio: precioFinal,
        metodoPago: data.metodo,
        precioMetodoPrincipal: data.precio,
        fechaVenta: new Date(),
        vendedor: user.name,
        vendedorId: user.id,
        local: user.local,
        localSalido: ctx.localCodigo,
        localOrigenId: ctx.localDocId,
        numCliente: data.numCliente,
        comentario: data.comentario,
        tipoVenta: 'venta',
        precioBajo: esPrecioBajo,
        ...(data.segundoMetodo ? { segundoMetodo: data.segundoMetodo } : {}),
      };

      await this.accionesLocalesService.registrarVenta(
        this.aContextoLocal(ctx),
        venta,
      );

      if (venta.numCliente) {
        window.open(this.salesService.generarLinkWhatsApp(venta), '_blank');
      }

      if (esPrecioBajo) {
        try {
          await this.pushNotificationService.enviarNotificacionAAdmins({
            title: '⚠️ Venta bajo precio mínimo',
            body: `${user.name} (Local ${user.local}) vendió ${ctx.marca} ${ctx.referencia} - Talla ${ctx.talla} por $${venta.precio} (mín: $${productoCatalogo.precioMin})`,
            data: {
              zapatoId: ctx.productoId.toString(),
              talla: String(ctx.talla),
              tipo: 'venta-precio-bajo',
            },
          });
        } catch (err) {
          console.error('Error enviando notificación precio bajo:', err);
        }
      }

      this.mostrarMensaje(
        'success',
        `Venta registrada: ${ctx.marca} ${ctx.referencia}, talla ${ctx.talla}.`,
      );
      this.cerrarModalesAccion();
      this.cerrarModal();
    } catch (e) {
      console.error(e);
      this.mostrarMensaje(
        'error',
        (e as Error).message ?? 'No se pudo registrar la venta.',
      );
    } finally {
      this.procesandoAccionLocal.set(false);
    }
  }

  async confirmarPrestamoLocal(data: any): Promise<void> {
    const ctx = this.contextoAccion();
    const user = this.currentUser();
    if (!ctx || !user || this.procesandoAccionLocal()) return;
    this.procesandoAccionLocal.set(true);

    try {
      const prestamo: Prestamo = {
        id: '',
        zapatoId: ctx.productoId,
        marca: ctx.marca,
        referencia: ctx.referencia,
        talla: String(ctx.talla),
        imagen: ctx.imagen,
        tipoVenta: 'prestamo',
        estado: 'prestado',
        localInicio: user.local,
        esPL: data.esPL === true,
        localPrestado: data.local,
        localSalido: ctx.localCodigo,
        localOrigenId: ctx.localDocId,
        precio: data.precio,
        fechaPrestamo: new Date(),
        vendedor: user.name,
        vendedorId: user.id,
        comentario: data.comentario,
      };

      await this.accionesLocalesService.registrarPrestamo(
        this.aContextoLocal(ctx),
        prestamo,
      );

      this.mostrarMensaje(
        'success',
        `Préstamo registrado: ${ctx.marca} ${ctx.referencia}, talla ${ctx.talla}.`,
      );
      this.cerrarModalesAccion();
      this.cerrarModal();
    } catch (e) {
      console.error(e);
      this.mostrarMensaje(
        'error',
        (e as Error).message ?? 'No se pudo registrar el préstamo.',
      );
    } finally {
      this.procesandoAccionLocal.set(false);
    }
  }

  async confirmarCambioLocal(event: {
    pedido: Venta;
    excedente: number;
    metodoPago: string;
    fechaAnterior: any;
  }): Promise<void> {
    const ctx = this.contextoAccion();
    const user = this.currentUser();
    if (!ctx || !user || this.procesandoAccionLocal()) return;
    this.procesandoAccionLocal.set(true);

    try {
      const nuevoId = await this.generarIdUnicoVenta();

      const productoCatalogo = await this.catalogoService.getProductoPorId(
        ctx.productoId,
      );
      const precioTotal = Number(event.pedido.precio) + (event.excedente ?? 0);
      const esPrecioBajo =
        productoCatalogo && precioTotal < productoCatalogo.precioMin;

      // Antes este flujo nunca marcaba si la venta anterior era del mismo día,
      // y el cambio siempre se contaba como de un día distinto.
      const fechaAnteriorDate = event.fechaAnterior?.seconds
        ? new Date(event.fechaAnterior.seconds * 1000)
        : new Date(event.fechaAnterior);
      const hoy = new Date();
      const mismaFecha =
        fechaAnteriorDate.getFullYear() === hoy.getFullYear() &&
        fechaAnteriorDate.getMonth() === hoy.getMonth() &&
        fechaAnteriorDate.getDate() === hoy.getDate();

      const ventaCambio: Venta = {
        id: nuevoId,
        zapatoId: ctx.productoId,
        marca: ctx.marca,
        referencia: ctx.referencia,
        talla: String(ctx.talla),
        imagen: ctx.imagen,
        tipoVenta: 'Cambio',
        metodoPago: event.pedido.metodoPago,
        precio: precioTotal,
        precioBono: Number(event.pedido.precio),
        excedente: event.excedente ?? 0,
        metodoExcedente: event.metodoPago,
        productoDevueltoId: event.pedido.id,
        fechaVenta: new Date(),
        vendedor: user.name,
        vendedorId: user.id,
        local: user.local,
        localSalido: ctx.localCodigo,
        localOrigenId: ctx.localDocId,
        precioBajo: esPrecioBajo,
        esMismoDia: mismaFecha,
      };

      const localDestinoDevolucion =
        event.pedido.localSalido ?? event.pedido.local ?? '';

      await this.accionesLocalesService.registrarCambio(
        this.aContextoLocal(ctx),
        ventaCambio,
        event.pedido.id,
        {
          tipoVenta: 'Devuelto por cambio',
          precio: 0,
          DevueltoCambio: true,
          // Si la venta era de otro día, se conserva el dinero que ya recibió el vendedor
          ...(mismaFecha
            ? {}
            : { precioAntesDeCambio: montoCajaAlAnular(event.pedido) }),
        },
        {
          productoId: event.pedido.zapatoId!,
          talla: Number(event.pedido.talla),
          marca: event.pedido.marca,
          referencia: event.pedido.referencia,
          imagen: event.pedido.imagen ?? '',
          localOrigenId: event.pedido.localOrigenId ?? '',
          localOrigenNombre: localDestinoDevolucion,
          devueltoPorNombre: user.name,
          devueltoPorId: user.id,
          productoDevueltoId: event.pedido.id,
        },
      );

      if (esPrecioBajo) {
        try {
          await this.pushNotificationService.enviarNotificacionAAdmins({
            title: '⚠️ Cambio bajo precio mínimo',
            body: `${user.name} (Local ${user.local}) realizó un cambio en ${ctx.marca} ${ctx.referencia} por $${ventaCambio.precio} (mín: $${productoCatalogo.precioMin})`,
            data: {
              zapatoId: ctx.productoId.toString(),
              talla: String(ctx.talla),
              tipo: 'cambio-precio-bajo',
            },
          });
        } catch (err) {
          console.error('Error enviando notificación precio bajo cambio:', err);
        }
      }

      try {
        await this.pushNotificationService.enviarNotificacionAVendedoresPorLocalExacto(
          localDestinoDevolucion,
          {
            title: '🔄 Devolución por cambio',
            body: `${user.name} (Local ${user.local}) devolvió ${event.pedido.marca} ${event.pedido.referencia} - Talla ${event.pedido.talla}`,
            data: {
              zapatoId: String(event.pedido.zapatoId ?? ''),
              talla: String(event.pedido.talla),
              local: user.local?.toString() || '',
              tipo: 'devolucion-cambio-local',
            },
          },
        );
      } catch (err) {
        console.error('Error enviando notificación devolución cambio:', err);
      }

      this.mostrarMensaje('success', 'Cambio procesado correctamente.');
      this.cerrarModalesAccion();
      this.cerrarModal();
    } catch (e) {
      console.error(e);
      this.mostrarMensaje(
        'error',
        (e as Error).message ?? 'No se pudo procesar el cambio.',
      );
    } finally {
      this.procesandoAccionLocal.set(false);
    }
  }

  async onBonoRedimidoLocal(bono: any): Promise<void> {
    const ctx = this.contextoAccion();
    const user = this.currentUser();
    if (!ctx || !user || this.procesandoAccionLocal()) return;
    this.procesandoAccionLocal.set(true);

    try {
      const idVentaNueva = await this.generarIdUnicoVenta();
      const ventaNueva: Venta = {
        id: idVentaNueva,
        zapatoId: ctx.productoId,
        marca: ctx.marca,
        referencia: ctx.referencia,
        talla: String(ctx.talla),
        imagen: ctx.imagen,
        precio: bono.excedente ?? 0,
        tipoVenta: 'Bono',
        metodoPago: bono?.metodo ?? 'bono',
        fechaVenta: new Date(),
        vendedor: user.name,
        vendedorId: user.id,
        local: user.local,
        localSalido: ctx.localCodigo,
        localOrigenId: ctx.localDocId,
        precioBajo: false,
        precioBono: bono.bono.precioBono,
        excedente: bono.excedente,
        productoDevueltoId: bono.bono.producto.id,
      };

      await this.accionesLocalesService.redimirBono(
        this.aContextoLocal(ctx),
        ventaNueva,
        bono.bono.producto.id,
        { tipoVenta: 'Devuelto por bono' },
      );

      try {
        await this.bonosService.borrarBono(bono.bono.id);
      } catch (err) {
        console.error('Error al eliminar bono:', err);
      }

      try {
        await this.pushNotificationService.enviarNotificacionAAdmins({
          title: '🎟️ Bono redimido',
          body: `${user.name} redimió un bono — ${ctx.marca} ${ctx.referencia} - Talla ${ctx.talla}`,
          data: {
            zapatoId: ctx.productoId.toString(),
            talla: String(ctx.talla),
            local: user.local?.toString() || '',
            tipo: 'bono-redimido',
          },
        });
      } catch (err) {
        console.error('Error enviando notificación bono:', err);
      }

      this.mostrarMensaje('success', 'Bono redimido correctamente.');
      this.cerrarModalesAccion();
      this.cerrarModal();
    } catch (e) {
      console.error(e);
      this.mostrarMensaje('error', 'No se pudo redimir el bono.');
    } finally {
      this.procesandoAccionLocal.set(false);
    }
  }

  private exhibicionesService = inject(ExhibicionesService);
  public printerService = inject(BluetoothPrinterService);
  public templateService = inject(PrinterTemplateService);

  modalExhibicion = signal(false);

  abrirModalExhibicion(): void {
    this.modalExhibicion.set(true);
  }

  async enviarExhibicionLocal(event: {
    producto: InventarioLocal;
    talla: number;
    locales: string[];
    id: number;
    localId: string;
  }): Promise<void> {
    const { producto, talla, locales, id, localId } = event;
    const user = this.currentUser();
    if (!user) return;

    const recibir =
      await this.exhibicionesService.obtenerConfiguracionRecepcion();
    const productoCatalogo = await this.catalogoService.getProductoPorId(id);

    const nuevaExhibicion = {
      marca: producto.marca,
      referencia: producto.referencia,
      talla: talla.toString(),
      locales,
      imagen: producto.imagen,
      zapatoId: id.toString(),
      pendienteRecibir: recibir === true,
      enviadoPor: user.name,
      fechahoraEnviado: new Date(),
      origenLocal: true,
      localSalido: producto.localNombre ?? '',
      precioAdquisicion: productoCatalogo?.precioAdquisicion ?? 0,
    };

    try {
      await this.pedidosLocalesService.descontarStockYCrearExhibicion(
        id,
        localId,
        talla,
        nuevaExhibicion,
      );

      try {
        await this.historialLocalesService.agregarHistorial({
          marca: producto.marca,
          referencia: producto.referencia,
          zapatoId: id,
          talla: talla.toString(),
          fecha: new Date().toISOString(),
          tipo: 'salida',
          lugar: 'exhibicion',
          localOrigen: user.local ?? '',
          locales,
          enviadoPor: user.name,
        });
      } catch (err) {
        console.error('Error registrando historial de exhibición local:', err);
      }

      this.mostrarMensaje(
        'success',
        `Se envió "${producto.marca} - ${producto.referencia}" en talla ${talla}.`,
      );

      if (this.printerService.isConnected()) {
        const baseTemplate =
          this.templateService.activeTemplate() ?? FALLBACK_TEMPLATE;

        const templateExhibicion: LabelTemplate = {
          ...baseTemplate,
          elements: baseTemplate.elements.map((el) => {
            if (el.type === 'qr') return { ...el, visible: true };
            return el;
          }),
        };

        const allVars: LabelVariables[] = locales.map((local: string) => ({
          marca: producto.marca,
          referencia: producto.referencia,
          codigo: id.toString(),
          talla: talla.toString(),
          local,
        }));

        await this.printerService.printMultiple(templateExhibicion, allVars);
      }

      this.modalExhibicion.set(false);
    } catch (error: any) {
      this.mostrarMensaje(
        'error',
        error?.message || 'No se pudo registrar la exhibición.',
      );
    }
  }

  private avisosLocalOrigenService = inject(AvisosLocalOrigenService);

  private avisosLocalRaw = toSignal(
    this.avisosLocalOrigenService.obtenerAvisos(),
    { initialValue: [] as AvisoExhibicionLocal[] },
  );

  misAvisosLocal = computed(() => {
    const user = this.currentUser();
    if (!user?.local) return [];
    const miLocal = String(user.local).trim().toLowerCase();
    return this.avisosLocalRaw().filter(
      (a) =>
        String(a.localSalido ?? '')
          .trim()
          .toLowerCase() === miLocal,
    );
  });

  totalAvisosLocal = computed(() => this.misAvisosLocal().length);

  modalAvisosLocalVisible = signal(false);
  avisoSeleccionado = signal<AvisoExhibicionLocal | null>(null);
  tallaReenvio = signal<number | null>(null);
  procesandoReenvio = signal(false);

  toggleModalAvisosLocal(): void {
    this.modalAvisosLocalVisible.update((v) => !v);
    if (!this.modalAvisosLocalVisible()) {
      this.cerrarDetalleAviso();
    }
  }

  private inventarioDelAviso = computed(() => {
    const aviso = this.avisoSeleccionado();
    const user = this.currentUser();
    if (!aviso || !user?.local) return null;

    const miLocal = String(user.local).trim().toLowerCase();
    const inventario = this.inventarioCompleto() ?? [];

    return (
      inventario.find(
        (item) =>
          String(item.productoId) === String(aviso.producto.zapatoId) &&
          String(item.localNombre ?? '')
            .trim()
            .toLowerCase() === miLocal,
      ) ?? null
    );
  });

  tallasDisponiblesReenvio = computed(() => {
    const item = this.inventarioDelAviso();
    return item ? this.tallasOrdenadas(item) : [];
  });

  sinStockReenvio = computed(
    () =>
      this.inventarioDelAviso() === null ||
      this.tallasDisponiblesReenvio().length === 0,
  );

  abrirDetalleAviso(aviso: AvisoExhibicionLocal): void {
    this.avisoSeleccionado.set(aviso);
    this.tallaReenvio.set(null);
  }

  cerrarDetalleAviso(): void {
    this.avisoSeleccionado.set(null);
    this.tallaReenvio.set(null);
    this.procesandoReenvio.set(false);
  }

  async eliminarAvisoManual(aviso: AvisoExhibicionLocal): Promise<void> {
    if (!aviso.id) return;
    try {
      await this.avisosLocalOrigenService.eliminarAviso(aviso.id);
      this.mostrarMensaje('success', 'Notificación eliminada.');
      if (this.avisoSeleccionado()?.id === aviso.id) {
        this.cerrarDetalleAviso();
      }
    } catch (e) {
      console.error(e);
      this.mostrarMensaje('error', 'No se pudo eliminar la notificación.');
    }
  }

  async confirmarReenvioExhibicion(): Promise<void> {
    const aviso = this.avisoSeleccionado();
    const user = this.currentUser();
    const talla = this.tallaReenvio();
    const item = this.inventarioDelAviso();

    if (
      !aviso ||
      !aviso.id ||
      !user ||
      talla == null ||
      !item ||
      this.procesandoReenvio()
    ) {
      return;
    }

    this.procesandoReenvio.set(true);

    try {
      const recibir =
        await this.exhibicionesService.obtenerConfiguracionRecepcion();

      const nuevaExhibicion = {
        marca: aviso.producto.nombre,
        referencia: aviso.producto.referencia,
        talla: talla.toString(),
        locales: aviso.locales ?? [],
        imagen: aviso.image ?? '',
        zapatoId: String(aviso.producto.zapatoId ?? ''),
        pendienteRecibir: recibir === true,
        enviadoPor: user.name,
        fechahoraEnviado: new Date(),
        origenLocal: true,
        localSalido: user.local,
      };

      await this.pedidosLocalesService.descontarStockYCrearExhibicionYEliminarAviso(
        item.productoId,
        item.localId,
        talla,
        nuevaExhibicion,
        aviso.id,
      );

      try {
        await this.historialLocalesService.agregarHistorial({
          marca: aviso.producto.nombre,
          referencia: aviso.producto.referencia,
          zapatoId: item.productoId,
          talla: talla.toString(),
          fecha: new Date().toISOString(),
          tipo: 'salida',
          lugar: 'exhibicion',
          localOrigen: user.local ?? '',
          locales: aviso.locales ?? [],
          enviadoPor: user.name,
        });
      } catch (err) {
        console.error(
          'Error registrando historial de reenvío de exhibición:',
          err,
        );
      }

      this.mostrarMensaje(
        'success',
        `Se envió "${aviso.producto.nombre} - ${aviso.producto.referencia}" en talla ${talla}.`,
      );

      this.cerrarDetalleAviso();
      if (this.misAvisosLocal().length === 0) {
        this.modalAvisosLocalVisible.set(false);
      }
    } catch (error: any) {
      this.mostrarMensaje(
        'error',
        error?.message || 'No se pudo reenviar la exhibición.',
      );
    } finally {
      this.procesandoReenvio.set(false);
    }
  }

  avisoConfirmandoEliminarId = signal<string | null>(null);

  pedirConfirmacionEliminar(aviso: AvisoExhibicionLocal): void {
    this.avisoConfirmandoEliminarId.set(aviso.id ?? null);
  }

  cancelarConfirmacionEliminar(): void {
    this.avisoConfirmandoEliminarId.set(null);
  }

  async confirmarEliminarAviso(aviso: AvisoExhibicionLocal): Promise<void> {
    await this.eliminarAvisoManual(aviso);
    this.avisoConfirmandoEliminarId.set(null);
  }
}
