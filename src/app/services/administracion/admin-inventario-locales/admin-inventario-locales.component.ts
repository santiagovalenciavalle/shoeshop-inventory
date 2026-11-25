import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import * as XLSX from 'xlsx';

import { LocalesInventarioService } from '../../../services/locales-inventario/locales-inventario.service';
import {
  Local,
  LocalesService,
} from '../../../services/locales/locales.service';
import { InventarioLocal } from '../../../pages/interfaces';

import { IaSpinnerComponent } from '../../../shared/components/ia-loader/ia-spinner.component';
interface FilaTallaEdicion {
  talla: number | null;
  cantidad: number | null;
}

interface TallaEntrada {
  talla: number;
  cantidad: number;
}

type FormatoExcel = 'tallas' | 'cantidad';

@Component({
  selector: 'app-admin-inventario-locales',
  standalone: true,
  imports: [
    IaSpinnerComponent,CommonModule, FormsModule, ToastModule],
  templateUrl: './admin-inventario-locales.component.html',
  providers: [MessageService],

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminInventarioLocalesComponent implements OnInit, OnDestroy {
  @ViewChild('videoEl') videoEl?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasEl?: ElementRef<HTMLCanvasElement>;

  cargando = true;

  inventario: InventarioLocal[] = [];
  inventarioFiltrado: InventarioLocal[] = [];
  locales: Local[] = [];

  tallasPorId: { [id: string]: TallaEntrada[] } = {};

  searchTerm = '';
  searchChanged = new Subject<string>();
  searchCode = '';
  tallaFiltro: number | null = null;
  localFiltro = '';
  limite = 30;

  editando: { [id: string]: boolean } = {};
  tallasEdicion: { [id: string]: FilaTallaEdicion[] } = {};
  guardando: { [id: string]: boolean } = {};

  confirmandoEliminarId: string | null = null;
  eliminando: { [id: string]: boolean } = {};

  mostrarEscaner = false;
  escaneando = false;
  qrError = '';
  private stream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private jsQR: any;

  mostrarModalExcel = false;
  formatoExcel: FormatoExcel = 'cantidad';
  localExcel = '';
  generandoExcel = false;

  private inventarioSub: Subscription = new Subscription();
  private localesSub: Subscription = new Subscription();
  private searchSub: Subscription = new Subscription();
  imagenAmpliada: { url: string; alt: string } | null = null;
  constructor(
    private localesInventarioService: LocalesInventarioService,
    private localesService: LocalesService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {}

  ngOnInit(): void {
    this.inventarioSub = this.localesInventarioService
      .getInventarioCompleto()
      .subscribe((inventario) => {
        this.inventario = inventario || [];
        this.recalcularTallasPorId();
        this.actualizarFiltrado();
        this.cargando = false;
        this.cdr.detectChanges();
      });

    this.localesSub = this.localesService
      .obtenerLocales()
      .subscribe((locales) => {
        this.locales = locales.filter((l) => l.estado === 'Activo');
        this.cdr.detectChanges();
      });

    this.searchSub = this.searchChanged
      .pipe(debounceTime(200))
      .subscribe((term) => {
        this.searchTerm = term;
        this.limite = 30;
        this.actualizarFiltrado();
        this.cdr.detectChanges();
      });
    this.scrollToTop();
  }
  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  ngOnDestroy(): void {
    this.inventarioSub.unsubscribe();
    this.localesSub.unsubscribe();
    this.searchSub.unsubscribe();
    this.cerrarEscaner();
  }

  get todasLasTallas(): number[] {
    const set = new Set<number>();
    for (const item of this.inventario) {
      Object.keys(item.tallasDisponibles || {}).forEach((t) =>
        set.add(Number(t)),
      );
    }
    return Array.from(set).sort((a, b) => a - b);
  }

  get hayFiltrosActivos(): boolean {
    return (
      !!this.searchTerm.trim() ||
      !!this.searchCode.trim() ||
      !!this.tallaFiltro ||
      !!this.localFiltro
    );
  }

  onSearchCodeChange(): void {
    this.limite = 30;
    this.actualizarFiltrado();
  }

  onTallaFiltroChange(): void {
    this.limite = 30;
    this.actualizarFiltrado();
  }

  onLocalFiltroChange(): void {
    this.limite = 30;
    this.actualizarFiltrado();
  }

  limpiarFiltros(): void {
    this.searchTerm = '';
    this.searchCode = '';
    this.tallaFiltro = null;
    this.localFiltro = '';
    this.limite = 30;
    this.actualizarFiltrado();
  }

  private actualizarFiltrado(): void {
    const term = this.searchTerm.toLowerCase().trim();
    const code = this.searchCode.trim();

    this.inventarioFiltrado = this.inventario
      .filter((p) => `${p.marca} ${p.referencia}`.toLowerCase().includes(term))
      .filter((p) => !code || p.productoId.toString() === code)
      .filter(
        (p) =>
          !this.tallaFiltro ||
          (p.tallasDisponibles?.[this.tallaFiltro] ?? 0) > 0,
      )
      .filter((p) => !this.localFiltro || p.localNombre === this.localFiltro)
      .sort((a, b) => b.productoId - a.productoId);
  }

  verMas(): void {
    this.limite += 30;
    this.cdr.detectChanges();
  }

  private entradasTallas(item: InventarioLocal): TallaEntrada[] {
    return Object.entries(item.tallasDisponibles || {})
      .map(([talla, cantidad]) => ({
        talla: Number(talla),
        cantidad: Number(cantidad),
      }))
      .filter((e) => e.cantidad > 0)
      .sort((a, b) => a.talla - b.talla);
  }

  private recalcularTallasPorId(): void {
    const nuevo: { [id: string]: TallaEntrada[] } = {};
    for (const item of this.inventario) {
      if (item.id) {
        nuevo[item.id] = this.entradasTallas(item);
      }
    }
    this.tallasPorId = nuevo;
  }

  iniciarEdicion(item: InventarioLocal): void {
    if (!item.id) return;
    this.tallasEdicion[item.id] = this.entradasTallas(item).map((e) => ({
      talla: e.talla,
      cantidad: e.cantidad,
    }));
    this.editando[item.id] = true;
  }

  cancelarEdicion(item: InventarioLocal): void {
    if (!item.id) return;
    this.editando[item.id] = false;
    delete this.tallasEdicion[item.id];
  }

  agregarFilaTalla(item: InventarioLocal): void {
    if (!item.id) return;
    this.tallasEdicion[item.id] = this.tallasEdicion[item.id] || [];
    this.tallasEdicion[item.id].push({ talla: null, cantidad: null });
  }

  quitarFilaTalla(item: InventarioLocal, index: number): void {
    if (!item.id) return;
    this.tallasEdicion[item.id]?.splice(index, 1);
  }

  async guardarEdicion(item: InventarioLocal): Promise<void> {
    if (!item.id) return;
    const id = item.id;
    const filas = this.tallasEdicion[id] || [];

    const filasValidas = filas.filter(
      (f) =>
        f.talla !== null && f.talla !== undefined && Number(f.cantidad) > 0,
    );

    const tallasVistas = new Set<number>();
    for (const f of filasValidas) {
      const talla = f.talla as number;
      if (tallasVistas.has(talla)) {
        this.messageService.add({
          severity: 'error',
          summary: 'Talla repetida',
          detail: `La talla ${talla} está repetida, revisa las filas.`,
        });
        return;
      }
      tallasVistas.add(talla);
    }

    const nuevasTallas: { [talla: number]: number } = {};
    for (const f of filasValidas) {
      nuevasTallas[f.talla as number] = Number(f.cantidad);
    }
    const nuevoStock = Object.values(nuevasTallas).reduce((a, b) => a + b, 0);

    this.guardando[id] = true;
    try {
      await this.localesInventarioService.actualizarInventarioLocal(id, {
        tallasDisponibles: nuevasTallas,
        stock: nuevoStock,
        fechaActualizacion: new Date(),
      });

      const idx = this.inventario.findIndex((p) => p.id === id);
      if (idx > -1) {
        this.inventario[idx] = {
          ...this.inventario[idx],
          tallasDisponibles: nuevasTallas,
          stock: nuevoStock,
        };
        this.actualizarFiltrado();
      }

      this.tallasPorId[id] = Object.entries(nuevasTallas)
        .map(([talla, cantidad]) => ({
          talla: Number(talla),
          cantidad: Number(cantidad),
        }))
        .sort((a, b) => a.talla - b.talla);

      this.editando[id] = false;
      delete this.tallasEdicion[id];

      this.messageService.add({
        severity: 'success',
        summary: 'Actualizado',
        detail: 'Las tallas se guardaron correctamente.',
      });
    } catch (error) {
      console.error('Error al actualizar inventario local:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo guardar el cambio.',
      });
    } finally {
      this.guardando[id] = false;
      this.cdr.detectChanges();
    }
  }

  pedirConfirmacionEliminar(item: InventarioLocal): void {
    if (!item.id) return;
    this.confirmandoEliminarId = item.id;
  }

  cancelarEliminar(): void {
    this.confirmandoEliminarId = null;
    this.cdr.detectChanges();
  }

  async confirmarEliminar(item: InventarioLocal): Promise<void> {
    if (!item.id) return;
    const id = item.id;

    this.eliminando[id] = true;
    try {
      await this.localesInventarioService.eliminarInventarioLocal(id);

      this.inventario = this.inventario.filter((p) => p.id !== id);
      delete this.tallasPorId[id];
      this.actualizarFiltrado();

      this.messageService.add({
        severity: 'success',
        summary: 'Eliminado',
        detail: `${item.marca} ${item.referencia} se eliminó de ${item.localNombre}.`,
      });
    } catch (error) {
      console.error('Error al eliminar inventario local:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo eliminar el registro.',
      });
    } finally {
      this.eliminando[id] = false;
      this.confirmandoEliminarId = null;
      this.cdr.detectChanges();
    }
  }

  async abrirEscaner(): Promise<void> {
    this.qrError = '';
    this.mostrarEscaner = true;
    this.escaneando = true;
    if (!this.jsQR) {
      const mod: any = await import('jsqr');
      this.jsQR = mod.default ?? mod;
    }
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
      this.qrError = 'No se pudo acceder a la cámara. Verifica los permisos.';
      this.escaneando = false;
      this.cdr.detectChanges();
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

  private onQRDetectado(valor: string): void {
    this.cerrarEscaner();
    if (navigator.vibrate) navigator.vibrate(80);
    this.searchCode = valor.trim();
    this.onSearchCodeChange();
    this.cdr.detectChanges();
  }

  cerrarEscaner(): void {
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
    this.cdr.detectChanges();
  }

  abrirImagen(item: InventarioLocal): void {
    this.imagenAmpliada = {
      url: item.imagen || '/logo.svg',
      alt: item.marca,
    };
    this.cdr.detectChanges();
  }

  cerrarImagen(): void {
    this.imagenAmpliada = null;
    this.cdr.detectChanges();
  }

  abrirModalExcel(): void {
    this.formatoExcel = 'cantidad';
    this.localExcel = '';
    this.mostrarModalExcel = true;
    this.cdr.detectChanges();
  }

  cerrarModalExcel(): void {
    if (this.generandoExcel) return;
    this.mostrarModalExcel = false;
    this.cdr.detectChanges();
  }

  async descargarExcel(): Promise<void> {
    this.generandoExcel = true;
    try {
      const base = this.localExcel
        ? this.inventario.filter((p) => p.localNombre === this.localExcel)
        : this.inventario;

      const items = [...base].sort((a, b) => b.productoId - a.productoId);

      if (!items.length) {
        this.messageService.add({
          severity: 'error',
          summary: 'Sin datos',
          detail: 'No hay inventario para ese local.',
        });
        return;
      }

      let filas: Record<string, string | number>[];

      if (this.formatoExcel === 'tallas') {
        filas = items.flatMap((p) =>
          this.entradasTallas(p).map((t) => ({
            Código: p.productoId,
            Marca: p.marca,
            Referencia: p.referencia,
            Talla: t.talla,
            Cantidad: t.cantidad,
            Local: p.localNombre,
          })),
        );
      } else {
        filas = items
          .filter((p) => p.stock > 0)
          .map((p) => ({
            Código: p.productoId,
            Marca: p.marca,
            Referencia: p.referencia,
            Stock: p.stock,
            Local: p.localNombre,
          }));
      }

      const hoja = XLSX.utils.json_to_sheet(filas);
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, 'Inventario');

      const fecha = new Date().toISOString().slice(0, 10);
      const localTag = this.localExcel
        ? this.localExcel.replace(/\s+/g, '_')
        : 'todos_los_locales';
      const formatoTag = this.formatoExcel === 'tallas' ? 'tallas' : 'cantidad';

      XLSX.writeFile(
        libro,
        `inventario_${formatoTag}_${localTag}_${fecha}.xlsx`,
      );

      this.mostrarModalExcel = false;
    } catch (error) {
      console.error('Error al generar excel:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo generar el archivo.',
      });
    } finally {
      this.generandoExcel = false;
      this.cdr.detectChanges();
    }
  }

  trackByItemId(_index: number, item: InventarioLocal): string {
    return item.id ?? String(item.productoId);
  }

  trackByTalla(_index: number, t: TallaEntrada): number {
    return t.talla;
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByLocalNombre(_index: number, local: Local): string {
    return local.nombre;
  }

  trackByValue(_index: number, value: number): number {
    return value;
  }
}
