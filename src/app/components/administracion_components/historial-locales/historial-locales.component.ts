import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { of } from 'rxjs';
import { debounceTime, switchMap, tap } from 'rxjs/operators';
import { HistorialLocalesService } from '../../../services/administracion/HistorialLocalesService/historial-locales.service';
import { HistorialLocal } from '../../../pages/interfaces';

interface FiltroHistorial {
  modo: 'fecha' | 'zapato';
  fecha: string;
  zapatoId: string;
}

interface ResumenPorLocal {
  local: string;
  cantidad: number;
}

@Component({
  selector: 'app-historial-locales',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './historial-locales.component.html',
})
export class HistorialLocalesComponent {
  private historialLocalesService = inject(HistorialLocalesService);
  private route = inject(ActivatedRoute);

  esAdmin = signal(false);

  constructor() {
    let currentRoute = this.route;
    while (currentRoute.firstChild) {
      currentRoute = currentRoute.firstChild;
    }
    currentRoute.data.subscribe((data) => {
      this.esAdmin.set(data['role'] === 'admin');
    });

    effect(() => {
      this.filtroActivo();
      this.limite.set(this.incremento);
    });
  }

  private hoyISO(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  fechaSeleccionada = signal<string>(this.hoyISO());
  zapatoIdInput = signal<string>('');

  private zapatoIdDebounced = toSignal(
    toObservable(this.zapatoIdInput).pipe(debounceTime(500)),
    { initialValue: '' },
  );

  modo = computed<'fecha' | 'zapato'>(() =>
    this.zapatoIdDebounced().trim() !== '' ? 'zapato' : 'fecha',
  );

  filtroActivo = computed<FiltroHistorial>(() => ({
    modo: this.modo(),
    fecha: this.fechaSeleccionada(),
    zapatoId: this.zapatoIdDebounced().trim(),
  }));

  cargando = signal(true);

  private historial$ = toObservable(this.filtroActivo).pipe(
    tap(() => this.cargando.set(true)),
    switchMap((filtro) => {
      if (filtro.modo === 'zapato') {
        const id = Number(filtro.zapatoId);
        if (!filtro.zapatoId || !Number.isFinite(id)) {
          return of([] as HistorialLocal[]);
        }
        return this.historialLocalesService.obtenerHistorialPorZapatoId(id);
      }
      const inicio = new Date(`${filtro.fecha}T00:00:00`).toISOString();
      const fin = new Date(`${filtro.fecha}T23:59:59.999`).toISOString();

      return this.historialLocalesService.obtenerHistorialPorRangoFecha(
        inicio,
        fin,
      );
    }),
    tap(() => this.cargando.set(false)),
  );

  historial = toSignal(this.historial$, {
    initialValue: [] as HistorialLocal[],
  });

  private readonly incremento = 20;
  limite = signal(this.incremento);

  historialVisible = computed(() => this.historial().slice(0, this.limite()));

  quedanMasPorMostrar = computed(() => this.historial().length > this.limite());

  verMas(): void {
    this.limite.update((v) => v + this.incremento);
  }

  totalSalidas = computed(() => {
    const totalSalidasCrudo = this.historial().filter(
      (h) => h.tipo === 'salida',
    ).length;
    return totalSalidasCrudo - this.totalDevueltos();
  });

  totalDevueltos = computed(
    () =>
      this.historial().filter(
        (h) => h.tipo === 'entrada' && h.lugar === 'pedido',
      ).length,
  );

  totalExhibiciones = computed(
    () => this.historial().filter((h) => h.lugar === 'exhibicion').length,
  );

  resumenPorLocal = computed<ResumenPorLocal[]>(() => {
    const mapa = new Map<string, number>();

    for (const h of this.historial()) {
      if (h.tipo === 'salida') {
        const local = h.localOrigen || 'Sin local';
        mapa.set(local, (mapa.get(local) ?? 0) + 1);
      }
    }

    for (const h of this.historial()) {
      if (h.tipo === 'entrada') {
        const local = h.locales[0] || 'Sin local';
        mapa.set(local, (mapa.get(local) ?? 0) - 1);
      }
    }

    return Array.from(mapa.entries())
      .map(([local, cantidad]) => ({ local, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);
  });

  totalPedidos = computed(
    () =>
      this.historial().filter(
        (h) => h.tipo === 'salida' && h.lugar === 'pedido',
      ).length,
  );

  onZapatoIdInput(valor: string): void {
    this.zapatoIdInput.set(valor.replace(/[^0-9]/g, ''));
  }

  onFechaChange(valor: string): void {
    this.fechaSeleccionada.set(valor);
  }

  limpiarBusquedaProducto(): void {
    this.zapatoIdInput.set('');
  }

  private formatearFecha(fecha: Date): string {
    const yyyy = fecha.getFullYear();
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const dd = String(fecha.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  irADiaAnterior(): void {
    const [y, m, d] = this.fechaSeleccionada().split('-').map(Number);
    const fecha = new Date(y, m - 1, d);
    fecha.setDate(fecha.getDate() - 1);
    this.fechaSeleccionada.set(this.formatearFecha(fecha));
  }

  irADiaSiguiente(): void {
    const [y, m, d] = this.fechaSeleccionada().split('-').map(Number);
    const fecha = new Date(y, m - 1, d);
    fecha.setDate(fecha.getDate() + 1);
    this.fechaSeleccionada.set(this.formatearFecha(fecha));
  }

  irAHoy(): void {
    this.fechaSeleccionada.set(this.hoyISO());
  }

  esHoy = computed(() => this.fechaSeleccionada() === this.hoyISO());

  trackByHistorial(index: number, item: HistorialLocal): string {
    return item.id ?? `${item.zapatoId}_${item.fecha}_${index}`;
  }
}
