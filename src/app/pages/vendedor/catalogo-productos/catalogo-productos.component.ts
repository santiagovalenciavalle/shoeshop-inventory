import {
  Component,
  ElementRef,
  Inject,
  PLATFORM_ID,
  ViewChild,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ProductoDetalleComponent } from '../../../shared/components/producto-detalle/producto-detalle.component';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { CatalogoService } from '../../../services/catalogo/catalogo.service';
import { exhibiciones, Products } from '../../interfaces';
import { CuadriculasComponent } from '../../../shared/components/catalogo/cuadriculas/cuadriculas.component';
import { MenuItem } from 'primeng/api';
import { AuthService } from '../../../services/auth/auth.service';
import { Subscription } from 'rxjs';
import { SkeletonModule } from 'primeng/skeleton';
import { SelectModule } from 'primeng/select';
import { RouterModule } from '@angular/router';
import { UsuarioService } from '../../../services/administracion/usuarios/usuario.service';
import { ExhibicionesService } from '../../../services/vendedorServices/exhibiciones/exhibiciones.service';

import { IaLoaderComponent } from '../../../shared/components/ia-loader/ia-loader.component';
@Component({
  selector: 'app-catalogo-productos',
  standalone: true,
  imports: [
    IaLoaderComponent,
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    ToggleButtonModule,
    ProductoDetalleComponent,
    CuadriculasComponent,
    SkeletonModule,
    SelectModule,
    RouterModule,
  ],
  templateUrl: './catalogo-productos.component.html',
  styleUrls: ['./catalogo-productos.component.css'],
})
export class CatalogoProductosComponent implements OnInit, OnDestroy {
  @ViewChild('scrollContainer') scrollContainer!: ElementRef;
  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasEl!: ElementRef<HTMLCanvasElement>;

  searchTerm = '';
  selectedTalla: number | null = null;
  loadingPantalla = true;
  mostrarCuadricula = true;
  productos: Products[] = [];
  loading = true;
  cargandoMas = false;
  urlMenu = '/catalogo';
  private productosSub!: Subscription;
  hayMasPorCargar = true;
  cantidadVisible = 30;

  mostrarEscaner = false;
  escaneando = false;
  qrError = '';
  private stream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private jsQR: any = null;

  items: MenuItem[] = [
    {
      label: 'Volver',
      icon: 'pi pi-arrow-left',
      routerLink: this.urlMenu,
    },
  ];

  tallas = [
    { label: 'Talla 35', value: 35 },
    { label: 'Talla 36', value: 36 },
    { label: 'Talla 37', value: 37 },
    { label: 'Talla 38', value: 38 },
    { label: 'Talla 39', value: 39 },
    { label: 'Talla 40', value: 40 },
    { label: 'Talla 41', value: 41 },
    { label: 'Talla 42', value: 42 },
    { label: 'Talla 43', value: 43 },
    { label: 'Talla 44', value: 44 },
    { label: 'Talla 45', value: 45 },
  ];
  codigoBusqueda: string = '';
  productoPorCodigo: Products | null = null;

  showIntro = false;
  productoSeleccionado: Products | null = null;
  mostrarDialogo = false;
  bodeguerosNombres: string[] = [];
  private exhibiciones: exhibiciones[] = [];

  constructor(
    private catalogoService: CatalogoService,
    public authService: AuthService,
    private usuarioService: UsuarioService,
    private exhibicionesService: ExhibicionesService,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {}

  get logueado(): boolean {
    return !!this.authService.getCurrentUser();
  }

  get esVendedor(): boolean {
    const user = this.authService.getCurrentUser();
    return user?.role === 'vendedor' || user?.role === 'admin';
  }

  /**
   * Un visitante sin sesión ve el catálogo público, que no trae precios internos.
   * Con sesión solo se muestran los productos que ya tienen precio mínimo y costo configurados.
   */
  private esVisible(p: Products): boolean {
    return this.logueado ? !!p.precioMin && !!p.precioAdquisicion : true;
  }

  async ngOnInit() {
    this.catalogoService.registrar();
    this.scrollToTop();

    // Usuarios, bodegueros y exhibiciones exigen sesión: el público no los consulta
    // (antes eso producía "Missing or insufficient permissions" en el catálogo público).
    if (this.logueado) {
      this.usuarioService.initUsuarios();
      this.usuarioService.getBodeguerosActivos().subscribe((nombres) => {
        this.bodeguerosNombres = nombres;
      });
    }

    this.loading = true;

    await this.catalogoService.cargarTodosProductosOrdenadosDesc();

    this.productosSub = this.catalogoService.productos$.subscribe(
      (productos) => {
        this.productos = productos;
        this.calcularMarcas();
        setTimeout(() => {
          this.loading = false;
          this.loadingPantalla = false;
        }, 1500);
        this.cantidadVisible = 30;
      },
    );

    if (this.logueado) {
      await this.exhibicionesService.cargarTodasExhibiciones();
      this.exhibicionesService.getExhibiciones$().subscribe((exh) => {
        this.exhibiciones = exh;
      });
    }

    if (isPlatformBrowser(this.platformId)) {
      this.cargarJsQR();
    }
  }

  private async cargarJsQR() {
    try {
      // jsQR se carga dinámicamente para no afectar SSR
      const mod = await import('jsqr' as any);
      this.jsQR = mod.default || mod;
    } catch (e) {
      console.warn('jsQR no disponible:', e);
    }
  }

  // ── QR Scanner ─────────────────────────────────────────────

  async abrirEscaner() {
    this.qrError = '';
    this.mostrarEscaner = true;
    this.escaneando = true;

    // Esperar a que el DOM renderice el video
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
      this.qrError =
        'No se pudo acceder a la cámara. Verifica los permisos del navegador.';
      this.escaneando = false;
    }
  }

  private leerFrames() {
    if (!this.jsQR) {
      // Reintentar si jsQR aún no cargó
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

  private onQRDetectado(valor: string) {
    const codigo = valor.trim();
    this.cerrarEscaner();

    // Pequeña vibración háptica si está disponible
    if (navigator.vibrate) navigator.vibrate(80);

    // Aplicar el código al buscador
    this.codigoBusqueda = codigo;
    this.buscarPorCodigo();
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

  // ── Marcas ────────────────────────────────────────────────
  marcasSeleccionadas: string[] = [];
  marcasInfo: { key: string; nombre: string; count: number }[] = [];
  filtrosAbiertos = false;

  private keyMarca(m: string | undefined | null): string {
    return (m || '').trim().toUpperCase();
  }

  private calcularMarcas() {
    const mapa = new Map<string, { key: string; nombre: string; count: number }>();
    for (const p of this.productos) {
      if (!this.esVisible(p)) continue;
      if (!this.esVendedor && (p.stock ?? 0) <= 0) continue;
      const key = this.keyMarca(p.marca);
      if (!key) continue;
      const actual = mapa.get(key);
      if (actual) actual.count++;
      else mapa.set(key, { key, nombre: (p.marca || '').trim(), count: 1 });
    }
    this.marcasInfo = [...mapa.values()].sort(
      (a, b) => b.count - a.count || a.nombre.localeCompare(b.nombre),
    );
  }

  get productosBaseTotal(): number {
    return this.marcasInfo.reduce((acc, m) => acc + m.count, 0);
  }

  nombreMarca(key: string): string {
    return this.marcasInfo.find((m) => m.key === key)?.nombre || key;
  }

  get marcasDestacadas() {
    return this.marcasInfo.slice(0, 12);
  }

  marcaActiva(key: string): boolean {
    return this.marcasSeleccionadas.includes(key);
  }

  toggleMarca(key: string) {
    this.marcasSeleccionadas = this.marcaActiva(key)
      ? this.marcasSeleccionadas.filter((k) => k !== key)
      : [...this.marcasSeleccionadas, key];
    this.searchTermChanged();
  }

  get tituloColeccion(): string {
    if (this.marcasSeleccionadas.length === 1) {
      return (
        this.marcasInfo.find((m) => m.key === this.marcasSeleccionadas[0])
          ?.nombre || 'Catálogo'
      );
    }
    return 'Catálogo';
  }

  get filtrosActivos(): number {
    return (
      this.marcasSeleccionadas.length + (this.selectedTalla != null ? 1 : 0)
    );
  }

  // ── Orden y tallas rápidas ─────────────────────────────────
  orden: 'recientes' | 'precioAsc' | 'precioDesc' = 'recientes';
  tallasRapidas = [35, 36, 37, 38, 39, 40, 41, 42, 43, 44];
  todasLasTallas = [
    28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45,
  ];

  get hayFiltros(): boolean {
    return (
      !!this.searchTerm.trim() ||
      this.selectedTalla != null ||
      this.marcasSeleccionadas.length > 0 ||
      !!String(this.codigoBusqueda || '').trim()
    );
  }

  get listaCompleta(): Products[] {
    if (this.productoPorCodigo) {
      if (!this.esVendedor && (this.productoPorCodigo.stock ?? 0) <= 0) {
        return [];
      }
      return [this.productoPorCodigo];
    }

    let filtrados = this.productosFiltrados;

    if (!this.esVendedor) {
      filtrados = filtrados.filter((p) => (p.stock ?? 0) > 0);
    }

    if (this.orden !== 'recientes') {
      const dir = this.orden === 'precioAsc' ? 1 : -1;
      filtrados = [...filtrados].sort(
        (a, b) => dir * ((a.precioMin ?? 0) - (b.precioMin ?? 0)),
      );
    }
    return filtrados;
  }

  get productosParaMostrar(): Products[] {
    return this.listaCompleta.slice(0, this.cantidadVisible);
  }

  get totalResultados(): number {
    return this.listaCompleta.length;
  }

  seleccionarTalla(talla: number | null) {
    this.selectedTalla = this.selectedTalla === talla ? null : talla;
    this.searchTermChanged();
  }

  cambiarOrden() {
    this.cantidadVisible = 30;
  }

  verMas() {
    this.cantidadVisible += 10;
  }

  selectMode() {
    this.urlMenu = this.esVendedor ? '/vendedor' : '/catalogo';

    if (!this.esVendedor) {
      this.items = [];
    }
  }

  /** Bloquea caracteres no numéricos (e, +, -, .) en el campo de código. */
  soloDigitos(event: KeyboardEvent) {
    if (['e', 'E', '+', '-', '.', ','].includes(event.key)) {
      event.preventDefault();
    }
  }

  buscarPorCodigo() {
    const codigo = String(this.codigoBusqueda || '').trim();

    if (codigo === '') {
      this.productoPorCodigo = null;
      this.cantidadVisible = 30;
      return;
    }

    const id = Number(codigo);

    if (!isNaN(id)) {
      this.productoPorCodigo =
        this.productos.find((p) => Number(p.id) === id) || null;
    } else {
      this.productoPorCodigo = null;
    }
  }

  get productosFiltrados(): Products[] {
    const term = this.searchTerm.toLowerCase().trim();

    const productosBase = this.productos
      .filter((p) => this.esVisible(p))
      .filter((p) => {
        const marca = (p.marca || '').toLowerCase();
        const referencia = (p.referencia || '').toLowerCase();
        const id = (p.id?.toString() || '').toLowerCase();
        const combinado = `${marca} ${referencia}`;
        const combinadoInverso = `${referencia} ${marca}`;

        const coincideBusqueda =
          !term ||
          marca.includes(term) ||
          referencia.includes(term) ||
          id.includes(term) ||
          combinado.includes(term) ||
          combinadoInverso.includes(term);

        const coincideTalla =
          this.selectedTalla == null ||
          (p.tallasDisponibles?.[this.selectedTalla] &&
            p.tallasDisponibles[this.selectedTalla] > 0);

        const coincideMarca =
          this.marcasSeleccionadas.length === 0 ||
          this.marcasSeleccionadas.includes(this.keyMarca(p.marca));

        return coincideBusqueda && coincideTalla && coincideMarca;
      });

    if (this.selectedTalla == null) return productosBase;
    const idsEnProducts = new Set(productosBase.map((p) => String(p.id)));
    const tallaBuscada = String(this.selectedTalla);

    const productosDeExhibicion: Products[] = this.exhibiciones
      .filter((exh) => {
        if (exh.talla !== tallaBuscada) return false;
        if (idsEnProducts.has(String(exh.zapatoId))) return false;
        if (
          this.marcasSeleccionadas.length > 0 &&
          !this.marcasSeleccionadas.includes(this.keyMarca(exh.marca))
        )
          return false;

        if (term) {
          const marca = (exh.marca || '').toLowerCase();
          const referencia = (exh.referencia || '').toLowerCase();
          const id = (exh.zapatoId || '').toLowerCase();
          const combinado = `${marca} ${referencia}`;
          const combinadoInverso = `${referencia} ${marca}`;

          return (
            marca.includes(term) ||
            referencia.includes(term) ||
            id.includes(term) ||
            combinado.includes(term) ||
            combinadoInverso.includes(term)
          );
        }

        return true;
      })
      .reduce((acc, exh) => {
        if (!acc.find((e) => e.zapatoId === exh.zapatoId)) acc.push(exh);
        return acc;
      }, [] as exhibiciones[])
      .map((exh) => {
        const productoOriginal = this.productos.find(
          (p) => String(p.id) === String(exh.zapatoId),
        );

        if (productoOriginal) {
          return {
            ...productoOriginal,
            soloExhibicion: true,
          } as Products & { soloExhibicion: boolean };
        }
        return {
          id: Number(exh.zapatoId),
          marca: exh.marca,
          referencia: exh.referencia,
          imagen: exh.imagen || '',
          tallasDisponibles: { [Number(this.selectedTalla)]: 1 },
          stock: 1,
          precioMin: null,
          precioAdquisicion: null,
          soloExhibicion: true,
        } as Products & { soloExhibicion: boolean };
      });

    return [...productosBase, ...productosDeExhibicion].sort(
      (a, b) => Number(a.id) - Number(b.id),
    );
  }

  searchTermChanged() {
    this.codigoBusqueda = '';
    this.productoPorCodigo = null;

    if (this.searchTerm.trim() === '') {
      this.cantidadVisible = 30;
    }
  }

  trackById(index: number, item: Products) {
    return item.id;
  }

  verDetalles(producto: Products) {
    this.productoSeleccionado = producto;
    this.mostrarDialogo = true;
  }

  cerrarDialogo() {
    this.mostrarDialogo = false;
    this.productoSeleccionado = null;
  }

  cambiarVista(cuadricula: boolean) {
    this.mostrarCuadricula = cuadricula;
  }

  async cargarMas(): Promise<void> {
    if (this.cargandoMas) return;
    this.cargandoMas = true;

    const cargados = await this.catalogoService.cargarSiguientePagina();
    if (!cargados) {
      this.hayMasPorCargar = false;
    }

    this.cargandoMas = false;
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  limpiarFiltros() {
    this.searchTerm = '';
    this.selectedTalla = null;
    this.marcasSeleccionadas = [];
    this.codigoBusqueda = '';
    this.productoPorCodigo = null;
    this.cantidadVisible = 30;
  }

  ngOnDestroy(): void {
    this.catalogoService.desregistrar();
    this.productosSub?.unsubscribe();
    this.cerrarEscaner();
  }
}
