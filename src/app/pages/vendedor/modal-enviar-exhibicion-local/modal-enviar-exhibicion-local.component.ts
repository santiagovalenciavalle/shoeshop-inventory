import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { InventarioLocal } from '../../interfaces';
import { LocalesInventarioService } from '../../../services/locales-inventario/locales-inventario.service';
import {
  Local,
  LocalesService,
} from '../../../services/locales/locales.service';
import { AuthService } from '../../../services/auth/auth.service';
import { HistorialLocalesService } from '../../../services/administracion/HistorialLocalesService/historial-locales.service';

import { IaSpinnerComponent } from '../../../shared/components/ia-loader/ia-spinner.component';
@Component({
  selector: 'app-modal-enviar-exhibicion-local',
  standalone: true,
  imports: [
    IaSpinnerComponent,CommonModule, FormsModule, ToastModule],
  templateUrl: './modal-enviar-exhibicion-local.component.html',
  providers: [MessageService],
})
export class ModalEnviarExhibicionLocalComponent implements OnInit, OnDestroy {
  @Output() cerrar = new EventEmitter<void>();
  @Output() enviarProductoConTalla = new EventEmitter<{
    producto: InventarioLocal;
    talla: number;
    locales: string[];
    id: number;
    localId: string;
  }>();

  cargando = true;
  enviandoProducto: { [productoId: number]: boolean } = {};

  productos: InventarioLocal[] = [];
  productosFiltrados: InventarioLocal[] = [];

  searchTerm = '';
  searchChanged = new Subject<string>();

  codigoBusqueda = '';
  productoPorCodigo: InventarioLocal | null = null;

  tallasSeleccionadas: { [productoId: number]: number } = {};
  localesSeleccionadosPorProducto: { [productoId: number]: string[] } = {};

  locales: { label: string; value: string }[] = [];
  limite = 30;

  user: any;

  private inventarioSub: Subscription = new Subscription();
  private localesSub: Subscription = new Subscription();
  private searchSub: Subscription = new Subscription();

  constructor(
    private localesInventarioService: LocalesInventarioService,
    private localesService: LocalesService,
    private authService: AuthService,
    private historialLocalesService: HistorialLocalesService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.user = this.authService.getCurrentUser();

    this.inventarioSub = this.localesInventarioService
      .getInventarioCompleto()
      .subscribe((inventario) => {
        const miLocal = String(this.user?.local ?? '')
          .trim()
          .toLowerCase();

        this.productos = (inventario || []).filter(
          (item) =>
            String(item.localNombre ?? '')
              .trim()
              .toLowerCase() === miLocal && (item.stock ?? 0) > 0,
        );
        this.actualizarProductosFiltrados();
        this.cargando = false;
        this.cdr.detectChanges();
      });

    this.localesSub = this.localesService
      .obtenerLocales()
      .subscribe((locales: Local[]) => {
        this.locales = locales
          .filter((l) => l.estado === 'Activo')
          .map((l) => ({ label: l.nombre, value: l.nombre }));
        this.cdr.detectChanges();
      });

    this.searchSub = this.searchChanged
      .pipe(debounceTime(200))
      .subscribe((term) => {
        this.searchTerm = term;
        this.limite = 30;
        this.actualizarProductosFiltrados();
      });
  }

  ngOnDestroy(): void {
    this.inventarioSub.unsubscribe();
    this.localesSub.unsubscribe();
    this.searchSub.unsubscribe();
  }

  private actualizarProductosFiltrados(): void {
    const term = this.searchTerm.toLowerCase().trim();

    this.productosFiltrados = this.productos
      .filter((p) => `${p.marca} ${p.referencia}`.toLowerCase().includes(term))
      .sort((a, b) => b.productoId - a.productoId);
  }

  /** Búsqueda dedicada: coincidencia exacta por código de producto, un solo resultado. */
  onCodigoChange(valor: string): void {
    this.codigoBusqueda = valor;
    const term = valor.trim();

    this.productoPorCodigo = term
      ? (this.productos.find((p) => p.productoId.toString() === term) ?? null)
      : null;
  }

  verMas(): void {
    this.limite += 30;
  }

  obtenerTallasDisponibles(producto: InventarioLocal): number[] {
    return Object.entries(producto.tallasDisponibles || {})
      .filter(([, cantidad]) => Number(cantidad) > 0)
      .map(([talla]) => Number(talla))
      .sort((a, b) => a - b);
  }

  limitarSeleccion(producto: InventarioLocal): void {
    const seleccion = this.localesSeleccionadosPorProducto[producto.productoId];
    if (seleccion && seleccion.length > 2) {
      seleccion.pop();
    }
  }

  toggleLocal(producto: InventarioLocal, valor: string): void {
    if (!this.localesSeleccionadosPorProducto[producto.productoId]) {
      this.localesSeleccionadosPorProducto[producto.productoId] = [];
    }

    const seleccion = this.localesSeleccionadosPorProducto[producto.productoId];
    const index = seleccion.indexOf(valor);

    if (index > -1) {
      seleccion.splice(index, 1);
    } else {
      seleccion.push(valor);
      this.limitarSeleccion(producto);
    }
  }

  async pedirProducto(producto: InventarioLocal, talla: number): Promise<void> {
    const localesSeleccionados =
      this.localesSeleccionadosPorProducto[producto.productoId];
    if (!talla || !localesSeleccionados || localesSeleccionados.length === 0)
      return;
    if (this.enviandoProducto[producto.productoId]) return;

    this.enviandoProducto[producto.productoId] = true;

    try {
      const localesString = localesSeleccionados
        .map((l: any) => {
          if (typeof l === 'string') return `local ${l}`;
          if (l?.value) return `local ${l.value}`;
          return '';
        })
        .filter(Boolean);

      this.enviarProductoConTalla.emit({
        producto,
        talla,
        locales: localesString,
        id: producto.productoId,
        localId: producto.localId,
      });

      this.cerrar.emit();
      this.tallasSeleccionadas = {};
      this.localesSeleccionadosPorProducto[producto.productoId] = [];
    } finally {
      this.enviandoProducto[producto.productoId] = false;
      this.cdr.detectChanges();
    }
  }
  cerrarModal(): void {
    this.searchTerm = '';
    this.codigoBusqueda = '';
    this.productoPorCodigo = null;
    this.cerrar.emit();
  }
}
