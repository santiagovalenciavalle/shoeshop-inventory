/** @format */

import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ViewChild,
  ElementRef,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { exhibiciones, Products } from '../../../pages/interfaces';
import { FormsModule } from '@angular/forms';
import { ModalAgregarProductoComponent } from '../modal-agregar-producto/modal-agregar-producto.component';
import { DialogModule } from 'primeng/dialog';
import { CatalogoService } from '../../../services/catalogo/catalogo.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { ModalEnviarExhibicionComponent } from '../modal-enviar-exhibicion/modal-enviar-exhibicion.component';
import { ExhibicionesService } from '../../../services/vendedorServices/exhibiciones/exhibiciones.service';
import { Subscription } from 'rxjs';
import { ModalDetallesProductoComponent } from '../modal-detalles-producto/modal-detalles-producto.component';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { RegistroIngresosService } from '../../../services/administracion/registro de ingresos/registro-ingresos.service';
import { ImageModule } from 'primeng/image';
import { AddNumeracionComponent } from '../add-numeracion/add-numeracion.component';
import { SelectModule } from 'primeng/select';
import { ModalVentasComponent } from '../modal-ventas/modal-ventas.component';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { PushNotificationService } from '../../../services/notifications push/push-notification.service';
import { BluetoothPrinterService } from '../../../services/bluetooth-printer/bluetooth-printer.service';
import {
  LabelTemplate,
  LabelVariables,
  PrinterTemplate,
  PrinterTemplateService,
} from '../../../services/printer-template/printer-template.service';
import { VisionBusquedaModalComponent } from '../vision-busqueda/vision-busqueda-modal.component';
import { AuthService } from '../../../services/auth/auth.service';
import { ModalPasarLocalesComponent } from '../modal-pasar-locales/modal-pasar-locales.component';

import { IaLoaderComponent } from '../../../shared/components/ia-loader/ia-loader.component';
import { IaSpinnerComponent } from '../../../shared/components/ia-loader/ia-spinner.component';
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
  selector: 'app-bodega-inventario',
  standalone: true,
  imports: [
    IaSpinnerComponent,
    IaLoaderComponent,
    CommonModule,
    RouterModule,
    ButtonModule,
    TableModule,
    FormsModule,
    DialogModule,
    ToastModule,
    SelectModule,
    ProgressSpinnerModule,
    AddNumeracionComponent,
    ModalDetallesProductoComponent,
    ImageModule,
    InputTextModule,
    SkeletonModule,
    MessageModule,
    ModalAgregarProductoComponent,
    ModalEnviarExhibicionComponent,
    ModalVentasComponent,
    VisionBusquedaModalComponent,
    ModalPasarLocalesComponent,
  ],
  templateUrl: './bodega-inventario.component.html',
  styleUrls: ['./bodega-inventario.component.css'],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BodegaInventarioComponent implements OnInit, OnDestroy {
  searchTerm: string = '';
  displayModal: boolean = false;
  displayConfirmDialog: boolean = false;
  visibleModalVentas: boolean = false;
  productoAEliminarId: number | null = null;
  productoAEditar: Products | null = null;
  modalNumeracion: boolean = false;
  productos: Products[] = [];
  esAdmin: boolean = false;
  link: string = '';
  selectedTalla: number | null = null;
  soloAgotados: boolean = false;
  tallasDisponibles = [
    28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45,
  ];
  visibleCount: number = 40;
  incremento: number = 20;
  codigoBusqueda: string = '';
  modalVisionAbierto = false;
  modalExhibicion: boolean = false;
  productoSeleccionado: Products | null = null;
  modoNumeracion: 'editar' | 'ver' = 'editar';
  modalVisible: boolean = false;
  loading: boolean = true;
  cargandoMas = false;
  hayMasPorCargar = true;
  mensajeMostrado: boolean = false;
  itemSeleccionado: any;
  mostrarMenuAcciones: boolean = false;
  mostrarScrollTop: boolean = false;
  stockTotalCalculado: number = 0;
  modalVerExhibiciones: boolean = false;
  exhibicionesProducto: any[] = [];
  modalCambioFilaVisible: boolean = false;
  filaNueva: string = '';
  productoCambioFila: Products | null = null;
  cambiandoFila: boolean = false;
  modalExcelVisible = false;
  exportandoExcel = false;
  tipoExcel: 'cantidad' | 'tallas' | null = null;
  contadorExcel = 0;
  excelExitoso = false;
  modalPasarLocales: boolean = false;

  modalImprimirRef: boolean = false;
  productoImprimiendo: Products | null = null;
  imprimiendoReferencia: boolean = false;
  impresionProgreso: { actual: number; total: number } | null = null;
  impresionCompletada: boolean = false;

  private productosSubscription: Subscription = new Subscription();

  mostrarEscaner = false;
  escaneando = false;
  qrError = '';
  private stream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private jsQR: any = null;
  imagenAmpliada: { url: string; alt: string } | null = null;
  user: any;
  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasEl!: ElementRef<HTMLCanvasElement>;

  constructor(
    private catalogoService: CatalogoService,
    private messageService: MessageService,
    private route: ActivatedRoute,
    private exhibicionesService: ExhibicionesService,
    private registroIngresosService: RegistroIngresosService,
    private pushNotificationService: PushNotificationService,
    public printerService: BluetoothPrinterService,
    public templateService: PrinterTemplateService,
    public authService: AuthService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {}

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.cargarJsQR();
    }
    this.catalogoService.registrar();
    this.user = this.authService.getCurrentUser();
    this.scrollToTop();

    this.loading = true;
    this.cdr.markForCheck();

    try {
      await this.catalogoService.cargarTodosProductosOrdenadosDesc();
    } catch (error) {
      console.error('Error al cargar todos los productos:', error);
    }

    this.productosSubscription = this.catalogoService
      .getProductos()
      .subscribe((productos) => {
        this.productos = [...productos].sort((a, b) => b.id - a.id);

        setTimeout(() => {
          this.loading = false;
          this.cdr.detectChanges();
        }, 2000);
      });

    window.addEventListener('scroll', this.checkScroll, true);

    let currentRoute = this.route;
    while (currentRoute.firstChild) {
      currentRoute = currentRoute.firstChild;
    }

    currentRoute.data.subscribe((data) => {
      this.esAdmin = data['role'] === 'admin';
      this.link = this.esAdmin ? '/admin' : '/bodega';
      this.cdr.markForCheck();
    });

    this.cdr.markForCheck();
  }

  get accionesProducto() {
    const base = [
      {
        label: 'Agregar numeración',
        icon: 'pi pi-plus',
        command: () => this.abrirNumeracion(this.itemSeleccionado, 'editar'),
      },
      {
        label: 'Imprimir referencia',
        icon: 'pi pi-print',
        command: () => this.abrirModalImprimirReferencia(this.itemSeleccionado),
      },
    ];

    if (this.esAdmin) {
      return [
        {
          label: 'Ver detalles',
          icon: 'pi pi-eye',
          command: () => this.verDetallesProducto(this.itemSeleccionado),
        },
        {
          label: 'Ver ventas',
          icon: 'pi pi-shopping-cart',
          command: () => this.verVentasProducto(this.itemSeleccionado),
        },
        {
          label: 'Descargar Excel',
          icon: 'pi pi-file-excel',
          command: () => this.descargarExcel(this.itemSeleccionado),
        },

        ...base,
        {
          label: 'Editar',
          icon: 'pi pi-pencil',
          command: () => this.editarProducto(this.itemSeleccionado),
        },
        {
          label: 'Pasar a locales',
          icon: 'pi pi-arrow-right-arrow-left',
          command: () => this.abrirModalPasarLocales(this.itemSeleccionado),
        },
        {
          label: 'Eliminar',
          icon: 'pi pi-trash',
          command: () => this.confirmarEliminacion(this.itemSeleccionado.id),
        },
      ];
    }

    return [
      {
        label: 'Ver numeración',
        icon: 'pi pi-search',
        command: () => this.abrirNumeracion(this.itemSeleccionado, 'ver'),
      },
      {
        label: 'Cambiar de fila',
        icon: 'pi pi-refresh',
        command: () => this.abrirModalCambioFila(this.itemSeleccionado),
      },
      {
        label: 'Descargar Excel',
        icon: 'pi pi-file-excel',
        command: () => this.descargarExcel(this.itemSeleccionado),
      },
      {
        label: 'Ver Exhibiciones',
        icon: 'pi pi-table',
        command: () => this.verExhibiciones(this.itemSeleccionado),
      },
      ...base,
    ];
  }
  abrirModalPasarLocales(producto: Products) {
    this.productoSeleccionado = producto;
    this.modalPasarLocales = true;
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
      this.cdr.markForCheck();
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
    this.codigoBusqueda = valor.trim();
    this.buscarPorCodigo();
    this.cdr.markForCheck();
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
    this.cdr.markForCheck();
  }

  abrirModalCambioFila(producto: Products) {
    this.productoCambioFila = producto;
    this.filaNueva = '';
    this.cambiandoFila = false;
    this.modalCambioFilaVisible = true;
  }

  cancelarCambioFila() {
    this.modalCambioFilaVisible = false;
    this.filaNueva = '';
    this.productoCambioFila = null;
    this.cambiandoFila = false;
  }

  async confirmarCambioFila() {
    if (!this.productoCambioFila || !this.filaNueva.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Fila inválida',
        detail: 'Debe ingresar una fila válida.',
      });
      return;
    }

    this.cambiandoFila = true;

    try {
      await this.catalogoService.actualizarFilaProducto(
        this.productoCambioFila.id,
        this.filaNueva.trim(),
      );

      this.messageService.add({
        severity: 'success',
        summary: 'Fila actualizada',
        detail: 'La fila del producto fue actualizada correctamente.',
      });

      this.modalCambioFilaVisible = false;
      this.filaNueva = '';
      this.productoCambioFila = null;
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo actualizar la fila.',
      });
    } finally {
      this.cambiandoFila = false;
    }
  }

  verExhibiciones(item: Products) {
    if (!item) return;

    this.itemSeleccionado = item;
    this.modalVerExhibiciones = true;

    this.exhibicionesProducto = [];

    this.exhibicionesService.getExhibicionesPorZapato$(item.id).subscribe({
      next: (data: exhibiciones[]) => {
        this.exhibicionesProducto = data;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error al cargar exhibiciones:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar las exhibiciones.',
        });
      },
    });
  }

  descargarExcel(item: any) {
    if (!item) return;

    import('xlsx')
      .then((XLSX) => {
        const filas: any[] = [];

        for (const [talla, cantidad] of Object.entries(
          item.tallasDisponibles,
        )) {
          const cantidadNum = Number(cantidad);
          for (let i = 0; i < cantidadNum; i++) {
            filas.push({
              id: item.id,
              marca: item.marca,
              referencia: item.referencia,
              talla: talla,
            });
          }
        }

        if (filas.length === 0) {
          alert('No hay stock disponible para este producto.');
          return;
        }

        const worksheet = XLSX.utils.json_to_sheet(filas);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Producto');

        XLSX.writeFile(workbook, `Producto-${item.id}.xlsx`);
      })
      .catch((err) => {
        console.error('Error al importar XLSX:', err);
      });
  }

  ngOnDestroy() {
    this.productosSubscription.unsubscribe();
    this.catalogoService.desregistrar();
    window.removeEventListener('scroll', this.checkScroll, true);
  }

  checkScroll = (): void => {
    const scrollTop =
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;
    this.mostrarScrollTop = scrollTop > 300;

    const btn = document.querySelector('.scroll-to-top') as HTMLElement;
    if (btn) {
      btn.classList.toggle('show', this.mostrarScrollTop);
    }
  };

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  get totalReferencias(): number {
    return this.productos.length;
  }

  get stockTotalInventario(): number {
    return this.productos.reduce(
      (acc, p: any) => acc + (Number(p.stock) || 0),
      0,
    );
  }

  get totalAgotados(): number {
    return this.productos.filter((p: any) => Number(p.stock) === 0).length;
  }

  get valorInventario(): number {
    return this.productos.reduce(
      (acc, p: any) =>
        acc + (Number(p.precioAdquisicion) || 0) * (Number(p.stock) || 0),
      0,
    );
  }

  get hayFiltrosActivos(): boolean {
    return (
      this.searchTerm.trim() !== '' ||
      this.codigoBusqueda.trim() !== '' ||
      this.selectedTalla != null ||
      this.soloAgotados
    );
  }

  get productosFiltrados(): Products[] {
    const term = this.searchTerm.trim().toLowerCase();

    if (this.codigoBusqueda.trim() !== '') {
      const codigo = this.codigoBusqueda.trim();
      const producto = this.productos.find((p) => p.id?.toString() === codigo);
      return producto ? [producto] : [];
    }

    return this.productos.filter((p) => {
      const marca = p.marca.toLowerCase();
      const referencia = p.referencia.toLowerCase();
      const combinado = `${marca} ${referencia}`;
      const combinadoInverso = `${referencia} ${marca}`;

      const coincideBusqueda =
        !term ||
        marca.includes(term) ||
        referencia.includes(term) ||
        combinado.includes(term) ||
        combinadoInverso.includes(term);

      const coincideTalla =
        this.selectedTalla == null ||
        (p.tallasDisponibles &&
          p.tallasDisponibles[this.selectedTalla] &&
          p.tallasDisponibles[this.selectedTalla] > 0);

      const coincideAgotado = !this.soloAgotados || Number(p.stock) === 0;
      return coincideBusqueda && coincideTalla && coincideAgotado;
    });
  }

  async buscarPorTalla() {
    if (!this.hayMasPorCargar) {
      this.cdr.markForCheck();
      return;
    }

    while (this.hayMasPorCargar) {
      this.cargandoMas = true;
      const cargados = await this.catalogoService.cargarSiguientePagina();

      if (!cargados) {
        this.hayMasPorCargar = false;
      }

      this.cargandoMas = false;

      this.cdr.markForCheck();
    }
  }

  trackById(index: number, item: any): any {
    return item.id;
  }

  async buscarProductos() {
    if (this.searchTerm.trim() === '') {
      return;
    }

    if (this.productosFiltrados.length === 0 && this.hayMasPorCargar) {
      await this.intentarCargarMasParaBusqueda();
    }

    if (this.productosFiltrados.length === 0 && !this.mensajeMostrado) {
      this.messageService.add({
        severity: 'info',
        summary: 'Buscando...',
        detail: 'Estamos buscando productos, espera un momento.',
        life: 4000,
      });
      this.mensajeMostrado = true;
    }

    if (this.productosFiltrados.length > 0) {
      this.mensajeMostrado = false;
    }
  }

  private async intentarCargarMasParaBusqueda() {
    if (this.cargandoMas) return;

    let filtrados = this.productosFiltrados;

    while (filtrados.length < 10 && this.hayMasPorCargar) {
      this.cargandoMas = true;
      const cargados = await this.catalogoService.cargarSiguientePagina();

      if (!cargados) {
        this.hayMasPorCargar = false;
        break;
      }
      this.cargandoMas = false;
      filtrados = this.productosFiltrados;
    }

    this.cargandoMas = false;
  }

  buscarPorCodigo() {
    const codigo = this.codigoBusqueda.trim();

    if (!codigo) {
      this.visibleCount = 40;
      return;
    }

    const producto = this.productos.find((p) => p.id?.toString() === codigo);

    if (!producto) {
      this.messageService.add({
        severity: 'warn',
        summary: 'No encontrado',
        detail: `No se encontró ningún producto con el código ${codigo}.`,
        life: 3000,
      });
    }

    this.cdr.detectChanges();
  }

  async cargarMas() {
    if (this.cargandoMas || !this.hayMasPorCargar) return;

    this.cargandoMas = true;

    const cargados = await this.catalogoService.cargarSiguientePagina();

    if (!cargados) {
      this.hayMasPorCargar = false;
    }

    this.cargandoMas = false;
  }

  abrirModal() {
    this.productoAEditar = null;
    this.displayModal = true;
  }

  editarProducto(producto: Products) {
    this.productoAEditar = { ...producto };
    this.displayModal = true;
  }

  cerrarModal() {
    this.displayModal = false;
    this.productoAEditar = null;
  }

  async agregarProducto(nuevoProducto: Products) {
    try {
      await this.catalogoService.agregarProducto(nuevoProducto);

      this.messageService.add({
        severity: 'success',
        summary: 'Producto agregado',
        detail: `El producto "${nuevoProducto.marca} - ${nuevoProducto.referencia}" fue agregado con éxito.`,
      });

      if (
        nuevoProducto.precioMin == null ||
        nuevoProducto.precioAdquisicion == null
      ) {
        try {
          await this.pushNotificationService.enviarNotificacionAAdmins({
            title: '🆕 Nueva referencia sin precios',
            body: `Se creó "${nuevoProducto.marca} - ${nuevoProducto.referencia}" en bodega. Debe asignarle precio mínimo y de adquisición para poder pedirla y enviar exhibiciones.`,
            data: {
              tipo: 'nueva-referencia-sin-precios',
            },
          });
        } catch (err) {
          console.error(
            'Error enviando notificación nueva referencia a admins:',
            err,
          );
        }
      }

      this.cerrarModal();
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error al agregar',
        detail: 'No se pudo agregar el producto.',
      });
    }
  }

  abrirImagen(item: Products): void {
    this.imagenAmpliada = {
      url: item.imagen || '/logo.svg',
      alt: item.marca,
    };
    this.cdr.markForCheck();
  }

  cerrarImagen(): void {
    this.imagenAmpliada = null;
    this.cdr.markForCheck();
  }

  verMas() {
    this.visibleCount += 20;
  }

  abrirMenu(event: Event, producto: any): void {
    event.stopPropagation();
    this.itemSeleccionado = producto;
    this.mostrarMenuAcciones = true;
    this.cdr.markForCheck();
  }

  cerrarMenuAcciones(): void {
    this.mostrarMenuAcciones = false;
    this.cdr.markForCheck();
  }

  ejecutarAccion(accion: { command: () => void }): void {
    this.cerrarMenuAcciones();

    setTimeout(() => {
      accion.command();
      this.cdr.markForCheck();
    }, 60);
  }

  abrirModalImprimirReferencia(producto: Products) {
    if (!producto) return;
    this.productoImprimiendo = producto;
    this.impresionProgreso = null;
    this.impresionCompletada = false;
    this.imprimiendoReferencia = false;
    this.modalImprimirRef = true;
    this.cdr.markForCheck();
  }

  cerrarModalImprimirReferencia() {
    if (this.imprimiendoReferencia) return;
    this.modalImprimirRef = false;
    this.productoImprimiendo = null;
    this.impresionProgreso = null;
    this.impresionCompletada = false;
    this.cdr.markForCheck();
  }

  get stickersAImprimir(): { talla: string; cantidad: number }[] {
    if (!this.productoImprimiendo?.tallasDisponibles) return [];
    return Object.entries(this.productoImprimiendo.tallasDisponibles)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([talla, qty]) => ({ talla, cantidad: Number(qty) }))
      .sort((a, b) => Number(a.talla) - Number(b.talla));
  }

  get totalStickersAImprimir(): number {
    return this.stickersAImprimir.reduce((sum, t) => sum + t.cantidad, 0);
  }

  async confirmarImprimirReferencia() {
    const producto = this.productoImprimiendo;
    if (!producto) return;

    if (!this.printerService.isConnected()) {
      this.messageService.add({
        severity: 'warn',
        summary: '🖨️ Impresora no conectada',
        detail:
          'Conecta la impresora desde el botón flotante antes de imprimir.',
        life: 5000,
      });
      return;
    }

    const allVars: LabelVariables[] = [];
    for (const { talla, cantidad } of this.stickersAImprimir) {
      for (let i = 0; i < cantidad; i++) {
        allVars.push({
          marca: producto.marca,
          referencia: producto.referencia,
          codigo: producto.id.toString(),
          talla,
        });
      }
    }

    if (allVars.length === 0) {
      this.messageService.add({
        severity: 'info',
        summary: 'Sin stock',
        detail: 'Este producto no tiene unidades en stock para imprimir.',
      });
      return;
    }

    const baseTemplate =
      this.templateService.activeTemplate() ?? FALLBACK_TEMPLATE;

    const template: LabelTemplate = {
      ...baseTemplate,
      elements: baseTemplate.elements.map((el) => {
        const content: string =
          'content' in el ? String((el as any).content ?? '') : '';

        if (content.toLowerCase().includes('local')) {
          return { ...el, visible: false };
        }
        return el;
      }),
    };

    this.imprimiendoReferencia = true;
    this.impresionProgreso = { actual: 0, total: allVars.length };
    this.impresionCompletada = false;
    this.cdr.markForCheck();

    try {
      const cols = Math.max(1, template.cols);

      for (let i = 0; i < allVars.length; i += cols) {
        const rowItems = allVars.slice(i, i + cols);
        const tspl = this.printerService.generateTsplMultiCol(
          template,
          rowItems,
        );
        const encoded = new TextEncoder().encode(tspl);
        await this.printerService.sendData(encoded);

        this.impresionProgreso = {
          actual: Math.min(i + cols, allVars.length),
          total: allVars.length,
        };
        this.cdr.markForCheck();

        if (i + cols < allVars.length) await this.delay(800);
      }

      this.impresionCompletada = true;
      this.messageService.add({
        severity: 'success',
        summary: '✅ Impresión completada',
        detail: `Se imprimieron ${allVars.length} stickers de ${producto.marca} - ${producto.referencia}.`,
        life: 5000,
      });
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error de impresión',
        detail: err?.message ?? 'No se pudo completar la impresión.',
        life: 6000,
      });
    } finally {
      this.imprimiendoReferencia = false;
      this.cdr.markForCheck();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  async guardarProducto(producto: Products) {
    this.cerrarModal();
    if (producto.id === 0) {
      await this.agregarProducto(producto);
    } else {
      await this.catalogoService.actualizarProducto(producto.id, producto);

      this.messageService.add({
        severity: 'success',
        summary: 'Producto actualizado',
        detail: `El producto "${producto.marca} - ${producto.referencia}" fue actualizado.`,
      });
    }
  }

  confirmarEliminacion(id: number) {
    this.productoAEliminarId = id;
    this.displayConfirmDialog = true;
  }

  async eliminarProducto() {
    if (this.productoAEliminarId !== null) {
      this.displayConfirmDialog = false;

      try {
        await this.catalogoService.borrarProducto(this.productoAEliminarId);
        await this.registroIngresosService.eliminarDocumentosPorZapatoId(
          this.productoAEliminarId,
        );

        this.messageService.add({
          severity: 'warn',
          summary: 'Producto eliminado',
          detail: 'El producto y su registro de ingreso fueron eliminados.',
        });
      } catch (error) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Ocurrió un error al eliminar el producto o su ingreso.',
        });
      }

      this.productoAEliminarId = null;
    }
  }

  cancelarEliminacion() {
    this.displayConfirmDialog = false;
    this.productoAEliminarId = null;
  }

  abrirNumeracion(producto: Products, modo: 'editar' | 'ver' = 'editar') {
    this.productoSeleccionado = producto;
    this.modoNumeracion = modo;
    this.modalNumeracion = true;
    this.cdr.markForCheck();
  }

  abrirModalExhibicion() {
    this.modalExhibicion = true;
  }

  abrirVisionBusqueda(): void {
    this.modalVisionAbierto = true;
  }

  onProductoSeleccionadoPorVision(producto: Products): void {
    this.productoSeleccionado = producto;
    this.modalVisible = true;
    this.modalVisionAbierto = false;
  }

  get stockTotal(): number {
    return this.productos.reduce(
      (total, producto) => total + (producto.stock || 0),
      0,
    );
  }

  async enviarExhibicion(event: any) {
    const { producto, talla, locales, id } = event;
    const recibir =
      await this.exhibicionesService.obtenerConfiguracionRecepcion();

    const nuevaExhibicion = {
      marca: producto.marca,
      referencia: producto.referencia,
      talla: talla.toString(),
      locales: locales,
      imagen: producto.imagen,
      zapatoId: id.toString(),
      pendienteRecibir: recibir === true,
      enviadoPor: this.user.name,
      fechahoraEnviado: new Date(),
      precioAdquisicion: producto.precioAdquisicion ?? 0,
    };

    try {
      await this.catalogoService.actualizarStockPorTalla(id, talla);
      await this.exhibicionesService.agregarExhibicion(nuevaExhibicion);

      this.messageService.add({
        severity: 'success',
        summary: 'Exhibición registrada',
        detail: `Se envió "${producto.marca} - ${producto.referencia}" en talla ${talla}.`,
      });

      if (this.printerService.isConnected()) {
        const baseTemplate = this.templateService.activeTemplate() ?? {
          nombre: 'Default',
          width: 50,
          height: 30,
          gap: 3,
          cols: 2,
          copies: 1,
          elements: [],
        };

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

      this.modalExhibicion = false;
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error al enviar exhibición',
        detail: error.message || 'No se pudo registrar la exhibición.',
      });
    }
  }

  verDetallesProducto(producto: Products) {
    this.productoSeleccionado = producto;
    this.modalVisible = true;
  }

  verVentasProducto(producto: any) {
    this.productoSeleccionado = producto;
    this.visibleModalVentas = true;
  }

  cerrarModalDetallesProduct() {
    this.modalVisible = false;
  }

  toggleAgotados() {
    this.soloAgotados = !this.soloAgotados;
    if (this.soloAgotados) {
      this.selectedTalla = null;
    }
    this.cdr.markForCheck();
  }

  limpiarFiltros() {
    this.searchTerm = '';
    this.codigoBusqueda = '';
    this.selectedTalla = null;
    this.soloAgotados = false;
    this.mensajeMostrado = false;
  }

  async exportarExcel(tipo: 'cantidad' | 'tallas') {
    this.exportandoExcel = true;
    this.tipoExcel = tipo;
    this.cdr.markForCheck();

    const productos = [...this.catalogoService.getProductosSnapshot()].sort(
      (a, b) => b.id - a.id,
    );

    try {
      if (tipo === 'cantidad') {
        await this.generarExcelCantidad(productos);
      } else {
        await this.generarExcelTallas(productos);
      }
    } catch (error) {
      console.error('Error generando Excel:', error);
    } finally {
      setTimeout(() => {
        this.exportandoExcel = false;
        this.modalExcelVisible = false;
        this.tipoExcel = null;
        this.cdr.markForCheck();
      }, 0);
    }
  }

  private async generarExcelCantidad(productos: Products[]): Promise<void> {
    const XLSX = await import('xlsx');

    const filas = productos
      .filter((p) => (p.stock ?? 0) > 0)
      .map((p) => ({
        id: p.id,
        marca: p.marca,
        referencia: p.referencia,
        fila: p.fila || 'X',
        stock: p.stock ?? 0,
      }));

    if (!filas.length) {
      alert('No hay productos con stock.');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock');

    XLSX.writeFile(wb, 'Inventario-Cantidad.xlsx');
  }

  private async generarExcelTallas(productos: Products[]): Promise<void> {
    const XLSX = await import('xlsx');
    const filas: any[] = [];

    for (const p of productos) {
      if (!p.tallasDisponibles) continue;

      for (const [talla, cantidad] of Object.entries(p.tallasDisponibles)) {
        const qty = Number(cantidad);
        if (qty <= 0) continue;

        for (let i = 0; i < qty; i++) {
          filas.push({
            id: p.id,
            marca: p.marca,
            referencia: p.referencia,
            fila: p.fila || 'X',
            talla: talla,
          });
        }
      }
    }

    if (!filas.length) {
      alert('No hay tallas disponibles.');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tallas');

    XLSX.writeFile(wb, 'Inventario-Tallas.xlsx');
  }
}
