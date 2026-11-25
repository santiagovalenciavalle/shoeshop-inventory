import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { SelectModule } from 'primeng/select';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { Products } from '../../../pages/interfaces';
import { CatalogoService } from '../../../services/catalogo/catalogo.service';
import { MultiSelectModule } from 'primeng/multiselect';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { debounceTime, Subject, Subscription } from 'rxjs';
import { BadgeModule } from 'primeng/badge';
import { SkeletonModule } from 'primeng/skeleton';
import { HistorialBodegaService } from '../../../services/administracion/registro de bodega/historial-bodega.service';
import { AuthService } from '../../../services/auth/auth.service';
import { AccordionModule } from 'primeng/accordion';
import {
  Local,
  LocalesService,
} from '../../../services/locales/locales.service';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { IaSpinnerComponent } from '../../../shared/components/ia-loader/ia-spinner.component';
@Component({
  selector: 'app-modal-enviar-exhibicion',
  imports: [
    IaSpinnerComponent,
    FormsModule,
    InputTextModule,
    ButtonModule,
    RippleModule,
    SelectModule,
    CommonModule,
    CardModule,
    MultiSelectModule,
    ToastModule,
    AccordionModule,
    BadgeModule,
    SkeletonModule,
    ProgressSpinnerModule,
  ],
  templateUrl: './modal-enviar-exhibicion.component.html',
  styleUrl: './modal-enviar-exhibicion.component.css',
  providers: [MessageService],
})
export class ModalEnviarExhibicionComponent {
  @Output() cerrar = new EventEmitter<void>();
  @Output() enviarProductoConTalla = new EventEmitter<{
    producto: Products;
    talla: number;
    locales: string[];
    id: number;
  }>();
  searchChanged = new Subject<string>();
  enviandoProducto: { [idProducto: number]: boolean } = {};

  cargando: boolean = true;
  buscando: boolean = false;
  hasMore: boolean = true;

  productos: Products[] = [];
  productosFiltrados: Products[] = [];

  searchTerm = '';
  tallasSeleccionadas: { [idProducto: number]: number } = {};
  localesSeleccionados: string[] = [];
  localesSeleccionadosPorProducto: { [idProducto: number]: string[] } = {};
  historialEnvios: { [idProducto: number]: Set<string> } = {};

  productosSubscription: Subscription = new Subscription();
  user: any;
  locales: { label: string; value: string }[] = [];
  limite = 30;
  constructor(
    private catalogoService: CatalogoService,
    private messageService: MessageService,
    private authService: AuthService,
    private historialService: HistorialBodegaService,
    private localesService: LocalesService,

    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    this.localesService.registrar();
    this.catalogoService.registrar();
    this.user = this.authService.getCurrentUser();

    this.productosSubscription = this.catalogoService.productos$.subscribe(
      (productos) => {
        this.productos = productos;
        this.actualizarProductosFiltrados();
        this.cargando = false;
        this.hasMore = this.catalogoService['hasMore'];
      },
    );

    this.localesService.obtenerLocales().subscribe((locales: Local[]) => {
      this.locales = locales
        .filter((l) => l.estado === 'Activo')
        .map((l) => ({ label: l.nombre, value: l.nombre }));
      this.cdr.detectChanges();
    });

    this.searchChanged.pipe(debounceTime(300)).subscribe((term) => {
      this.searchTerm = term;
      this.limite = 30;

      if (!term.trim()) {
        this.actualizarProductosFiltrados();
        this.cdr.detectChanges();
        return;
      }

      this.buscar();
      this.cdr.detectChanges();
    });
  }

  toggleLocal(producto: Products, local: string): void {
    const actuales = this.localesSeleccionadosPorProducto[producto.id] ?? [];
    const index = actuales.indexOf(local);
    this.localesSeleccionadosPorProducto[producto.id] =
      index >= 0 ? actuales.filter((l) => l !== local) : [...actuales, local];
    this.limitarSeleccion(producto);
  }

  ngOnDestroy(): void {
    this.localesService.desregistrar();
    this.catalogoService.desregistrar();
    this.productosSubscription.unsubscribe();
  }

  private actualizarProductosFiltrados(): void {
    const term = this.searchTerm.toLowerCase().trim();

    this.productosFiltrados = this.productos
      .filter((p) => {
        const isNumeric = /^\d+$/.test(term);

        if (isNumeric) {
          return p.id.toString() === term;
        }

        return `${p.marca} ${p.referencia}`.toLowerCase().includes(term);
      })
      .filter((p) => !!p.precioMin && !!p.precioAdquisicion);

    this.cdr.detectChanges();
  }

  async buscar(): Promise<void> {
    this.buscando = true;
    this.cargando = true;

    this.actualizarProductosFiltrados();

    let intentos = 0;
    const maxPaginas = 500;

    while (
      this.catalogoService['hasMore'] &&
      this.productosFiltrados.length < 10 &&
      intentos < maxPaginas
    ) {
      const hayMas = await this.catalogoService.cargarSiguientePagina();
      this.hasMore = hayMas;

      this.productos = this.catalogoService['productosSubject'].getValue();
      this.actualizarProductosFiltrados();
      intentos++;
    }

    this.cargando = false;
    this.buscando = false;
  }

  verMas() {
    this.limite += 30;
  }

  obtenerTallasDisponibles(producto: Products): number[] {
    return Object.entries(producto.tallasDisponibles)
      .filter(([_, cantidad]) => cantidad > 0)
      .map(([talla]) => Number(talla));
  }

  async pedirProducto(producto: Products, talla: number) {
    const localesSeleccionados =
      this.localesSeleccionadosPorProducto[producto.id];
    if (!talla || !localesSeleccionados || localesSeleccionados.length === 0)
      return;

    if (this.enviandoProducto[producto.id]) return;
    this.enviandoProducto[producto.id] = true;

    try {
      const localesString = localesSeleccionados
        .map((l: any) => {
          if (typeof l === 'string') return `local ${l}`;
          if (l?.value) return `local ${l.value}`;
          return '';
        })
        .filter(Boolean);

      const clave = `${talla}-${this.generarClaveLocales(localesString)}`;

      if (!this.historialEnvios[producto.id]) {
        this.historialEnvios[producto.id] = new Set();
      }

      this.historialEnvios[producto.id].add(clave);
      const fecha = new Date().toISOString();

      await this.historialService.agregarHistorial({
        marca: producto.marca,
        referencia: producto.referencia,
        zapatoId: producto.id,
        talla: talla.toString(),
        fecha,
        tipo: 'salida',
        lugar: 'exhibicion',
        bodega: this.user.name,
        locales: localesString,
      });

      this.enviarProductoConTalla.emit({
        producto,
        talla,
        locales: localesString,
        id: producto.id,
      });

      this.messageService.add({
        severity: 'success',
        summary: 'Exhibición enviada',
        detail: `Producto enviado a locales: ${localesString.join(', ')}`,
      });

      this.cerrar.emit();
      this.tallasSeleccionadas = {};
      this.localesSeleccionadosPorProducto[producto.id] = [];
    } catch (error) {
      console.error('Error al enviar exhibición:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Hubo un problema al enviar la exhibición.',
      });
    } finally {
      this.enviandoProducto[producto.id] = false;
      this.cdr.detectChanges();
    }
  }

  private generarClaveLocales(locales: string[]): string {
    return [...locales].sort().join('|').toLowerCase();
  }

  limitarSeleccion(producto: Products): void {
    if (this.localesSeleccionadosPorProducto[producto.id].length > 2) {
      this.localesSeleccionadosPorProducto[producto.id].pop();
    }
  }

  cerrarModal(): void {
    this.searchTerm = '';
    this.cerrar.emit();
    this.tallasSeleccionadas = {};
    this.localesSeleccionados = [];
  }
}
