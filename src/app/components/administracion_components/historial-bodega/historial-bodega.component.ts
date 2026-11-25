import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { HistorialBodegaService } from '../../../services/administracion/registro de bodega/historial-bodega.service';
import { historial } from '../../../pages/interfaces';

import { IaLoaderComponent } from '../../../shared/components/ia-loader/ia-loader.component';
type ModoBusqueda = 'fecha' | 'mes' | 'texto' | 'codigo';

@Component({
  selector: 'app-historial-bodega',
  imports: [
    IaLoaderComponent,
    FormsModule,
    InputTextModule,
    DatePickerModule,
    SelectModule,
    ButtonModule,
    CommonModule,
    RouterModule,
  ],
  templateUrl: './historial-bodega.component.html',
  styleUrl: './historial-bodega.component.css',
})
export class HistorialBodegaComponent implements OnInit, OnDestroy {
  filtroBusqueda = '';
  filtroCodigo = '';
  filtroFecha: Date | null = new Date();
  filtroMes: Date | null = null;
  mostrarBotonScroll = false;

  inventarioFiltrado: historial[] = [];
  cargando = false;
  modoActual: ModoBusqueda = 'fecha';

  private busquedaTexto$ = new Subject<string>();
  private busquedaCodigo$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private historialService: HistorialBodegaService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.scrollToTop();
    this.cargarPorFecha(new Date());
    window.addEventListener('scroll', this.onScroll, true);

    this.busquedaTexto$
      .pipe(debounceTime(700), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((texto) => {
        if (texto.length >= 2) {
          this.ejecutarBusquedaTexto(texto);
        }
      });

    this.busquedaCodigo$
      .pipe(debounceTime(700), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((codigo) => {
        if (codigo.length >= 1) {
          this.ejecutarBusquedaCodigo(codigo);
        }
      });
  }

  onScroll = (): void => {
    this.mostrarBotonScroll = window.scrollY > 300;
  };

  scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    window.removeEventListener('scroll', this.onScroll, true);
  }

  onBusquedaChange(valor: string): void {
    this.filtroCodigo = '';
    this.filtroFecha = null;
    this.filtroMes = null;
    this.modoActual = 'texto';

    const limpio = valor.trim();

    if (limpio === '') {
      this.cargarPorFecha(new Date());
      return;
    }

    this.busquedaTexto$.next(limpio);
  }

  onCodigoChange(valor: string): void {
    this.filtroBusqueda = '';
    this.filtroFecha = null;
    this.filtroMes = null;
    this.modoActual = 'codigo';

    const limpio = valor.trim();

    if (limpio === '') {
      this.cargarPorFecha(new Date());
      return;
    }

    this.busquedaCodigo$.next(limpio);
  }

  onFechaChange(fecha: Date | null): void {
    if (!fecha) return;
    this.filtroBusqueda = '';
    this.filtroCodigo = '';
    this.filtroMes = null;
    this.modoActual = 'fecha';
    this.cargarPorFecha(fecha);
  }

  onMesChange(fecha: Date | null): void {
    if (!fecha) return;
    this.filtroBusqueda = '';
    this.filtroCodigo = '';
    this.filtroFecha = null;
    this.modoActual = 'mes';
    this.cargarPorMes(fecha);
  }

  private async cargarPorFecha(fecha: Date): Promise<void> {
    this.iniciarCarga();
    try {
      this.inventarioFiltrado =
        await this.historialService.obtenerPorFecha(fecha);
    } catch (e) {
      console.error('Error cargando por fecha:', e);
    } finally {
      this.finalizarCarga();
    }
  }

  private async cargarPorMes(fecha: Date): Promise<void> {
    this.iniciarCarga();
    try {
      this.inventarioFiltrado =
        await this.historialService.obtenerPorMes(fecha);
    } catch (e) {
      console.error('Error cargando por mes:', e);
    } finally {
      this.finalizarCarga();
    }
  }

  private async ejecutarBusquedaTexto(texto: string): Promise<void> {
    this.iniciarCarga();
    try {
      const [porMarca, porReferencia] = await Promise.all([
        this.historialService.obtenerPorMarca(texto),
        this.historialService.obtenerPorReferencia(texto),
      ]);

      const mapa = new Map<string, historial>();
      [...porMarca, ...porReferencia].forEach((item) =>
        mapa.set(item.id, item),
      );

      this.inventarioFiltrado = Array.from(mapa.values()).sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
      );
    } catch (e) {
      console.error('Error en búsqueda de texto:', e);
    } finally {
      this.finalizarCarga();
    }
  }

  private async ejecutarBusquedaCodigo(codigo: string): Promise<void> {
    this.iniciarCarga();
    try {
      this.inventarioFiltrado =
        await this.historialService.obtenerPorCodigo(codigo);
    } catch (e) {
      console.error('Error en búsqueda por código:', e);
    } finally {
      this.finalizarCarga();
    }
  }

  private iniciarCarga(): void {
    this.cargando = true;
    this.inventarioFiltrado = [];
    this.cdr.detectChanges();
  }

  private finalizarCarga(): void {
    this.cargando = false;
    this.cdr.detectChanges();
  }

  limpiarFiltros(): void {
    this.filtroBusqueda = '';
    this.filtroCodigo = '';
    this.filtroMes = null;
    this.filtroFecha = new Date();
    this.modoActual = 'fecha';
    this.cargarPorFecha(new Date());
  }

  get descripcionModo(): string {
    switch (this.modoActual) {
      case 'fecha':
        return this.filtroFecha
          ? `Registros del ${this.filtroFecha.toLocaleDateString('es-CO', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}`
          : 'Registros de hoy';
      case 'mes':
        return this.filtroMes
          ? `Registros de ${this.filtroMes.toLocaleDateString('es-CO', {
              month: 'long',
              year: 'numeric',
            })}`
          : '';
      case 'texto':
        return `Resultados para "${this.filtroBusqueda}"`;
      case 'codigo':
        return `Resultados para código "${this.filtroCodigo}"`;
    }
  }

  get statsExhibicion(): number {
    return this.inventarioFiltrado.filter((i) => i.lugar === 'exhibicion')
      .length;
  }

  get statsPedidoSalidas(): number {
    return this.inventarioFiltrado.filter(
      (i) => i.lugar === 'pedido' && i.tipo === 'salida',
    ).length;
  }

  get statsDevoluciones(): number {
    return this.inventarioFiltrado.filter((i) => i.tipo === 'devolucion')
      .length;
  }

  get statsTotal(): number {
    return (
      this.statsPedidoSalidas - this.statsDevoluciones + this.statsExhibicion
    );
  }
}
