import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
} from '@angular/fire/firestore';
import { Timestamp } from 'firebase/firestore';

export interface ingresoTalla {
  id?: string;
  zapatoId: number;
  marca: string;
  referencia: string;
  cantIngresada: string;
  fecha: any;
  nombre: string;
}

@Component({
  selector: 'app-registro-diario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registro-diario.component.html',
})
export class RegistroDiarioComponent implements OnInit, OnDestroy {
  private readonly COLLECTION_NAME = 'ingresosProductos';
  private firestore = inject(Firestore);

  fechaSeleccionada = signal<Date>(new Date());
  ingresos = signal<ingresoTalla[]>([]);
  cargando = signal<boolean>(false);
  error = signal<string | null>(null);
  animandoStats = signal<boolean>(false);

  totalCantidad = computed(() =>
    this.ingresos().reduce(
      (sum, ing) => sum + (parseInt(ing.cantIngresada, 10) || 0),
      0,
    ),
  );

  totalReferencias = computed(
    () => new Set(this.ingresos().map((i) => i.referencia)).size,
  );

  totalMarcas = computed(
    () => new Set(this.ingresos().map((i) => i.marca)).size,
  );

  ingresosPorMarca = computed(() => {
    const map = new Map<string, number>();
    this.ingresos().forEach((ing) => {
      const cant = parseInt(ing.cantIngresada, 10) || 0;
      map.set(ing.marca, (map.get(ing.marca) ?? 0) + cant);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  });

  ngOnInit(): void {
    this.cargarDatos();
  }

  ngOnDestroy(): void {}

  async cargarDatos(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    this.ingresos.set([]);

    try {
      const fecha = this.fechaSeleccionada();
      const inicio = new Date(fecha);
      inicio.setHours(0, 0, 0, 0);
      const fin = new Date(fecha);
      fin.setHours(23, 59, 59, 999);

      const colRef = collection(this.firestore, this.COLLECTION_NAME);
      const q = query(
        colRef,
        where('fecha', '>=', Timestamp.fromDate(inicio)),
        where('fecha', '<=', Timestamp.fromDate(fin)),
      );

      const snapshot = await getDocs(q);
      const datos: ingresoTalla[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as ingresoTalla),
      }));

      await new Promise((r) => setTimeout(r, 300));
      this.ingresos.set(datos);
      this.animandoStats.set(true);
      setTimeout(() => this.animandoStats.set(false), 600);
    } catch (err) {
      console.error('Error al cargar ingresos por día:', err);
      this.error.set(
        'No se pudieron cargar los datos. Verifica tu conexión e intenta de nuevo.',
      );
    } finally {
      this.cargando.set(false);
    }
  }

  irDiaAnterior(): void {
    const nueva = new Date(this.fechaSeleccionada());
    nueva.setDate(nueva.getDate() - 1);
    this.fechaSeleccionada.set(nueva);
    this.cargarDatos();
  }

  irDiaSiguiente(): void {
    if (this.esFuturo) return;
    const nueva = new Date(this.fechaSeleccionada());
    nueva.setDate(nueva.getDate() + 1);
    this.fechaSeleccionada.set(nueva);
    this.cargarDatos();
  }

  irHoy(): void {
    if (this.esHoy) return;
    this.fechaSeleccionada.set(new Date());
    this.cargarDatos();
  }

  cambiarFecha(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      const [year, month, day] = input.value.split('-').map(Number);
      const fecha = new Date(year, month - 1, day);
      this.fechaSeleccionada.set(fecha);
      this.cargarDatos();
    }
  }

  get fechaInputValue(): string {
    const d = this.fechaSeleccionada();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  get esHoy(): boolean {
    return (
      new Date().toDateString() === this.fechaSeleccionada().toDateString()
    );
  }

  get esFuturo(): boolean {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const sel = new Date(this.fechaSeleccionada());
    sel.setHours(0, 0, 0, 0);
    return sel > hoy;
  }

  get etiquetaDia(): string {
    if (this.esHoy) return 'Hoy';
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    if (this.fechaSeleccionada().toDateString() === ayer.toDateString())
      return 'Ayer';
    return '';
  }

  formatearFechaLarga(fecha: Date): string {
    return fecha.toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  getHoraIngreso(ingreso: ingresoTalla): string {
    if (ingreso.fecha?.toDate) {
      return ingreso.fecha
        .toDate()
        .toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    }
    if (ingreso.fecha instanceof Date) {
      return ingreso.fecha.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return '--:--';
  }

  getInitials(nombre: string): string {
    return nombre
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() ?? '')
      .join('');
  }

  getColorClass(index: number): string {
    const colors = [
      'from-amber-500 to-orange-500',
      'from-sky-500 to-blue-600',
      'from-emerald-500 to-teal-600',
      'from-violet-500 to-purple-600',
      'from-rose-500 to-pink-600',
      'from-cyan-500 to-sky-500',
    ];
    return colors[index % colors.length];
  }

  trackById(_: number, item: ingresoTalla): string | number {
    return item.id ?? item.zapatoId;
  }
}
