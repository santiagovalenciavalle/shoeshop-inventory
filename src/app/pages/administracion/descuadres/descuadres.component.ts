import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Injector,
  OnInit,
  inject,
  runInInjectionContext,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { IaFuncionesService } from '../../../services/administracion/ia/ia-funciones.service';

interface Ubicaciones {
  bodega: number;
  pedidosConVendedor: number;
  pedidosDevueltosSinConfirmar: number;
  prestamosActivos: number;
  ventas: number;
  exhibiciones: number;
  enLocales: number;
}

interface Descuadre {
  codigo: number | string;
  producto: string;
  ingresos: number;
  ubicaciones: Ubicaciones;
  pedidosPendientes: number;
  suma: number;
  diferencia: number;
  severidad: 'alta' | 'media' | 'baja';
  notas: string[];
}

interface Resultado {
  generado: string;
  revisados: number;
  sinIngresosRegistrados: number;
  totalDescuadres: number;
  resumen: { alta: number; media: number; baja: number; sobran: number; faltan: number };
  descuadres: Descuadre[];
}

const ETIQUETAS: { clave: keyof Ubicaciones; texto: string }[] = [
  { clave: 'bodega', texto: 'En bodega' },
  { clave: 'pedidosConVendedor', texto: 'Pedidos con vendedor' },
  { clave: 'pedidosDevueltosSinConfirmar', texto: 'Devueltos sin confirmar' },
  { clave: 'prestamosActivos', texto: 'Préstamos' },
  { clave: 'ventas', texto: 'Vendidos' },
  { clave: 'exhibiciones', texto: 'En exhibición' },
  { clave: 'enLocales', texto: 'En locales' },
];

@Component({
  selector: 'app-descuadres',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-neutral-50 dark:bg-black">
      <div class="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-6">
        <header class="flex flex-col gap-1.5">
          <h1 class="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Descuadres de inventario
          </h1>
          <p class="text-sm text-neutral-500 dark:text-neutral-400 max-w-3xl">
            Compara los pares ingresados de cada referencia contra todos los lugares donde puede estar:
            bodega, pedidos, préstamos, ventas, exhibiciones y locales. Si no suman lo mismo, te muestra
            dónde mirar. Se revisa solo cada noche.
          </p>
        </header>

        <section class="rounded-2xl p-4 sm:p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
          <div class="flex flex-col lg:flex-row lg:items-end gap-4">
            <div class="flex flex-col gap-1.5 max-w-xs flex-1">
              <label for="ds-codigo" class="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Revisar un código
              </label>
              <input
                id="ds-codigo"
                type="text"
                inputmode="numeric"
                placeholder="Ej: 1234"
                [(ngModel)]="codigo"
                (keydown.enter)="verCodigo()"
                class="ds-input"
              />
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" (click)="verCodigo()" [disabled]="cargando || !codigo.trim()" class="ds-btn-sec">
                Ver este código
              </button>
              <button type="button" (click)="analizarTodo()" [disabled]="cargando" class="ds-btn">
                {{ cargando ? 'Analizando…' : 'Analizar todo el inventario' }}
              </button>
            </div>
          </div>
          <p *ngIf="error" class="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">{{ error }}</p>
        </section>

        <ng-container *ngIf="resultado as r">
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            {{ modoCodigo ? 'Resultado para el código ' + codigoVisto : 'Última revisión: ' + (r.generado | date: 'd MMM y, h:mm a') }}
          </p>

          <section *ngIf="!modoCodigo" class="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div class="ds-kpi"><p class="ds-kpi-l">Con diferencia</p><p class="ds-kpi-v">{{ r.totalDescuadres }}</p></div>
            <div class="ds-kpi"><p class="ds-kpi-l">Graves (3 o más pares)</p><p class="ds-kpi-v text-red-600 dark:text-red-400">{{ r.resumen.alta }}</p></div>
            <div class="ds-kpi"><p class="ds-kpi-l">Sobran pares</p><p class="ds-kpi-v">{{ r.resumen.sobran }}</p></div>
            <div class="ds-kpi"><p class="ds-kpi-l">Faltan pares</p><p class="ds-kpi-v">{{ r.resumen.faltan }}</p></div>
            <div class="ds-kpi"><p class="ds-kpi-l">Revisadas</p><p class="ds-kpi-v">{{ r.revisados }}</p><p class="text-[11px] text-neutral-400 mt-1">{{ r.sinIngresosRegistrados }} sin ingresos registrados</p></div>
          </section>

          <div *ngIf="!modoCodigo" class="flex flex-wrap gap-2" role="group" aria-label="Filtrar">
            <button type="button" class="ds-chip" [class.on]="filtro === 'todos'" (click)="filtro = 'todos'">Todos</button>
            <button type="button" class="ds-chip" [class.on]="filtro === 'sobran'" (click)="filtro = 'sobran'">Sobran</button>
            <button type="button" class="ds-chip" [class.on]="filtro === 'faltan'" (click)="filtro = 'faltan'">Faltan</button>
          </div>

          <section *ngIf="lista.length === 0" class="rounded-2xl p-10 text-center bg-white dark:bg-neutral-950 border border-dashed border-neutral-300 dark:border-neutral-800">
            <p class="text-sm font-semibold text-neutral-900 dark:text-white">No hay descuadres con este filtro</p>
            <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Todo suma lo que debería.</p>
          </section>

          <section class="space-y-3">
            <article
              *ngFor="let d of lista; trackBy: trackD"
              class="rounded-2xl p-4 sm:p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800"
            >
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <h2 class="text-base font-semibold text-neutral-900 dark:text-white truncate">{{ d.producto }}</h2>
                  <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Código {{ d.codigo }} · {{ d.ingresos }} pares ingresados</p>
                </div>
                <span class="text-xs font-semibold px-3 py-1.5 rounded-lg" [ngClass]="clase(d)">{{ texto(d) }}</span>
              </div>

              <ul class="mt-4 flex flex-wrap gap-2">
                <li
                  *ngFor="let e of etiquetas"
                  class="text-xs px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300"
                  [class.opacity-40]="d.ubicaciones[e.clave] === 0"
                >
                  {{ e.texto }}: <strong class="text-neutral-900 dark:text-white">{{ d.ubicaciones[e.clave] }}</strong>
                </li>
                <li class="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300">
                  Suma: <strong>{{ d.suma }}</strong>
                </li>
                <li *ngIf="d.pedidosPendientes" class="text-xs px-2.5 py-1.5 rounded-lg text-neutral-500 dark:text-neutral-400">
                  + {{ d.pedidosPendientes }} pedido(s) pendiente(s), aún no descuentan stock
                </li>
              </ul>

              <ul *ngIf="d.notas.length" class="mt-3 space-y-1.5">
                <li *ngFor="let n of d.notas" class="text-sm text-neutral-700 dark:text-neutral-300 flex gap-2">
                  <span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span><span>{{ n }}</span>
                </li>
              </ul>
            </article>
          </section>
        </ng-container>

        <p *ngIf="!resultado && !cargando && !error" class="text-sm text-neutral-500 dark:text-neutral-400">
          Aún no hay una revisión guardada. Pulsa "Analizar todo el inventario".
        </p>
      </div>
    </div>
  `,
  styles: [
    `
      .ds-input { width: 100%; border-radius: 12px; padding: 10px 14px; font-size: 16px; background: #fff; border: 1px solid #e5e5e5; color: #171717; outline: none; }
      .ds-input:focus { border-color: #737373; box-shadow: 0 0 0 2px rgba(115,115,115,.35); }
      :host-context(.dark) .ds-input { background: rgba(255,255,255,.04); border-color: #262626; color: #fff; }
      .ds-btn { padding: 11px 18px; border-radius: 12px; font-size: 14px; font-weight: 600; background: #171717; color: #fff; }
      .ds-btn:hover { background: #404040; }
      .ds-btn:disabled { opacity: .5; }
      :host-context(.dark) .ds-btn { background: #fff; color: #000; }
      :host-context(.dark) .ds-btn:hover { background: #e5e5e5; }
      .ds-btn-sec { padding: 11px 18px; border-radius: 12px; font-size: 14px; font-weight: 600; border: 1px solid #d4d4d4; color: #171717; background: transparent; }
      .ds-btn-sec:disabled { opacity: .5; }
      :host-context(.dark) .ds-btn-sec { border-color: #404040; color: #fff; }
      .ds-kpi { border-radius: 16px; padding: 16px; background: #fff; border: 1px solid #e5e5e5; }
      :host-context(.dark) .ds-kpi { background: #0a0a0a; border-color: #262626; }
      .ds-kpi-l { font-size: 12px; color: #737373; font-weight: 500; }
      .ds-kpi-v { margin-top: 4px; font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; color: #171717; }
      :host-context(.dark) .ds-kpi-v { color: #fff; }
      .ds-chip { padding: 8px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; border: 1px solid #e5e5e5; background: #fff; color: #404040; }
      .ds-chip.on { background: #171717; color: #fff; border-color: #171717; }
      :host-context(.dark) .ds-chip { background: #0a0a0a; border-color: #262626; color: #d4d4d4; }
      :host-context(.dark) .ds-chip.on { background: #fff; color: #000; border-color: #fff; }
    `,
  ],
})
export class DescuadresComponent implements OnInit {
  private funciones = inject(IaFuncionesService);
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private cdr = inject(ChangeDetectorRef);

  readonly etiquetas = ETIQUETAS;
  codigo = '';
  codigoVisto = '';
  modoCodigo = false;
  cargando = false;
  error = '';
  filtro: 'todos' | 'sobran' | 'faltan' = 'todos';
  resultado: Resultado | null = null;

  trackD = (_: number, d: Descuadre) => d.codigo;

  get lista(): Descuadre[] {
    const base = this.resultado?.descuadres ?? [];
    if (this.modoCodigo) return base;
    const reales = base.filter((d) => d.diferencia !== 0);
    if (this.filtro === 'sobran') return reales.filter((d) => d.diferencia > 0);
    if (this.filtro === 'faltan') return reales.filter((d) => d.diferencia < 0);
    return reales;
  }

  async ngOnInit(): Promise<void> {
    try {
      const snap = await runInInjectionContext(this.injector, () =>
        getDoc(doc(this.firestore, 'descuadresInventario', 'ultimo')),
      );
      if (snap.exists()) {
        const d: any = snap.data();
        this.resultado = { ...d, generado: d.generado } as Resultado;
      }
    } catch {
      /* si no se puede leer la última revisión, el usuario puede analizar manualmente */
    }
    this.cdr.markForCheck();
  }

  async analizarTodo(): Promise<void> {
    await this.ejecutar({}, false);
  }

  async verCodigo(): Promise<void> {
    const n = Number(this.codigo.trim());
    if (!Number.isFinite(n) || n <= 0) {
      this.error = 'Escribe un código numérico válido.';
      this.cdr.markForCheck();
      return;
    }
    this.codigoVisto = String(n);
    await this.ejecutar({ codigo: n }, true);
  }

  private async ejecutar(datos: Record<string, any>, porCodigo: boolean): Promise<void> {
    this.cargando = true;
    this.error = '';
    this.cdr.markForCheck();
    try {
      const r = await this.funciones.llamar<Resultado>('analizarDescuadres', datos);
      this.modoCodigo = porCodigo;
      this.resultado = r;
      if (porCodigo && !r.descuadres.length) this.error = 'No se encontró ese código en el inventario.';
    } catch (e: any) {
      this.error = e?.message ?? 'No se pudo analizar el inventario.';
    } finally {
      this.cargando = false;
      this.cdr.markForCheck();
    }
  }

  texto(d: Descuadre): string {
    if (d.diferencia === 0) return 'Cuadra ✓';
    const n = Math.abs(d.diferencia);
    return `${d.diferencia > 0 ? 'Sobran' : 'Faltan'} ${n} par${n === 1 ? '' : 'es'}`;
  }

  clase(d: Descuadre): string {
    if (d.diferencia === 0) return 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400';
    return d.severidad === 'alta'
      ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
      : d.severidad === 'media'
        ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
        : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300';
  }
}
