import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AlertaReposicion,
  ReposicionService,
} from '../../../services/administracion/reposicion/reposicion.service';

type FiltroUrgencia = 'todas' | 'critica' | 'alta' | 'media';

@Component({
  selector: 'app-reposicion',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes scaleIn {
        from {
          opacity: 0;
          transform: scale(0.94);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      @keyframes shimmerBg {
        0% {
          background-position: -200% 0;
        }
        100% {
          background-position: 200% 0;
        }
      }
      @keyframes spinRing {
        to {
          transform: rotate(360deg);
        }
      }
      @keyframes goldText {
        0% {
          background-position: 0% 50%;
        }
        100% {
          background-position: 200% 50%;
        }
      }

      .row-enter {
        animation: fadeInUp 0.4s cubic-bezier(0.22, 0.68, 0, 1.2) both;
      }
      .zoom-enter {
        animation: scaleIn 0.28s cubic-bezier(0.22, 0.68, 0, 1.2) both;
      }
      .skeleton-pulse {
        background: linear-gradient(
          90deg,
          rgba(120, 120, 120, 0.08) 25%,
          rgba(120, 120, 120, 0.18) 37%,
          rgba(120, 120, 120, 0.08) 63%
        );
        background-size: 400% 100%;
        animation: shimmerBg 1.6s ease-in-out infinite;
      }
      .gold-text {
        background: linear-gradient(
          90deg,
          #b8973a,
          #e8c84a,
          #f5e080,
          #e8c84a,
          #b8973a
        );
        background-size: 200% auto;
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        animation: goldText 3s linear infinite alternate;
      }
      .tap {
        transition:
          transform 0.15s cubic-bezier(0.22, 0.68, 0, 1.2),
          opacity 0.15s ease;
      }
      .tap:active {
        transform: scale(0.97);
        opacity: 0.85;
      }
      .spin-ring {
        width: 34px;
        height: 34px;
        border: 2px solid rgba(212, 175, 55, 0.15);
        border-top-color: #d4af37;
        border-radius: 9999px;
        animation: spinRing 0.8s linear infinite;
      }
      .chevron {
        transition: transform 0.3s cubic-bezier(0.22, 0.68, 0, 1.2);
      }
      .chevron-open {
        transform: rotate(180deg);
      }
      .no-scrollbar::-webkit-scrollbar {
        display: none;
      }
      .no-scrollbar {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
    `,
  ],
  template: `
    <div
      class="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50"
    >
      <header
        class="relative top-0 z-30 backdrop-blur-xl bg-neutral-50/85 dark:bg-neutral-950/85 border-b border-neutral-200/70 dark:border-neutral-800/70"
      >
        <div
          class="mx-auto max-w-3xl px-4 sm:px-6 pt-5 pb-3 flex items-start justify-between gap-3"
        >
          <div class="min-w-0">
            <p
              class="text-[10px] font-semibold uppercase tracking-[0.24em] text-yellow-600 dark:text-yellow-600/80 mb-1"
            >
              Panel Ejecutivo &bull; Inventario
            </p>
            <h1
              class="text-2xl sm:text-3xl font-bold tracking-tight leading-none truncate"
            >
              Reposición <span class="gold-text">Inteligente</span>
            </h1>
            @if (ultimaActualizacion(); as fecha) {
              <p
                class="mt-1.5 text-[11px] font-medium text-neutral-400 dark:text-neutral-600"
              >
                Actualizado a las {{ fecha | date: 'HH:mm' }}
              </p>
            }
          </div>

          <button
            (click)="cargar()"
            [disabled]="cargando()"
            aria-label="Actualizar alertas de reposición"
            class="tap flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              [class.animate-spin]="cargando()"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path
                d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
              />
            </svg>
          </button>
        </div>

        <div
          class="mx-auto max-w-3xl px-4 sm:px-6 pb-4 grid grid-cols-2 gap-2.5"
        >
          <div
            class="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3"
          >
            <p
              class="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-600"
            >
              Unidades en riesgo
            </p>
            <p class="mt-1 text-xl font-black tabular-nums">
              {{ unidadesEnRiesgo() }}
            </p>
          </div>
          <div
            class="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3"
          >
            <p
              class="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-600"
            >
              Valor estimado
            </p>
            <p
              class="mt-1 text-xl font-black tabular-nums text-yellow-600 dark:text-yellow-500"
            >
              {{
                valorEnRiesgo() | currency: 'COP' : 'symbol-narrow' : '1.0-0'
              }}
            </p>
          </div>
        </div>

        <div
          class="mx-auto max-w-3xl px-4 sm:px-6 pb-3 overflow-x-auto no-scrollbar"
        >
          <div
            class="inline-flex items-center gap-1 p-1 rounded-full bg-neutral-200/70 dark:bg-neutral-900"
          >
            <button
              (click)="setFiltro('todas')"
              class="tap px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
              [class]="filtroClases('todas')"
            >
              Todas
              <span class="opacity-60">{{ alertas().length }}</span>
            </button>
            <button
              (click)="setFiltro('critica')"
              class="tap px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
              [class]="filtroClases('critica')"
            >
              Críticas
              <span class="opacity-60">{{ criticas() }}</span>
            </button>
            <button
              (click)="setFiltro('alta')"
              class="tap px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
              [class]="filtroClases('alta')"
            >
              Altas
              <span class="opacity-60">{{ altas() }}</span>
            </button>
            <button
              (click)="setFiltro('media')"
              class="tap px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
              [class]="filtroClases('media')"
            >
              Medias
              <span class="opacity-60">{{ medias() }}</span>
            </button>
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-3xl px-4 sm:px-6 py-5 pb-28">
        @if (cargando()) {
          <div class="space-y-3">
            @for (i of [1, 2, 3, 4]; track i) {
              <div
                class="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 flex items-center gap-3.5"
              >
                <div
                  class="w-14 h-14 rounded-2xl skeleton-pulse flex-shrink-0"
                ></div>
                <div class="flex-1 space-y-2">
                  <div class="h-3 w-2/3 rounded-full skeleton-pulse"></div>
                  <div class="h-2.5 w-1/3 rounded-full skeleton-pulse"></div>
                </div>
                <div class="w-8 h-6 rounded-lg skeleton-pulse"></div>
              </div>
            }
          </div>
        } @else if (alertasFiltradas().length === 0 && yaCalculado()) {
          <div
            class="row-enter flex flex-col items-center text-center gap-4 py-24"
          >
            <div
              class="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#10b981"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p class="text-base font-bold">Sin alertas activas</p>
              <p
                class="mt-1 text-sm leading-relaxed text-neutral-500 dark:text-neutral-500 max-w-xs"
              >
                Todas las referencias tienen stock suficiente para las próximas
                2 semanas
              </p>
            </div>
          </div>
        } @else {
          <section
            class="rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-neutral-100 dark:divide-neutral-800 overflow-hidden shadow-sm shadow-neutral-200/50 dark:shadow-none"
          >
            @for (a of alertasFiltradas(); track a.zapatoId) {
              <article class="row-enter">
                <button
                  type="button"
                  (click)="toggleExpandido(a.zapatoId)"
                  [attr.aria-expanded]="estaExpandido(a.zapatoId)"
                  class="tap w-full text-left flex items-center gap-3.5 px-4 py-3.5"
                >
                  <div
                    class="relative flex-shrink-0"
                    (click)="abrirZoom(a.imagen, $event)"
                  >
                    @if (a.imagen) {
                      <img
                        [src]="a.imagen"
                        [alt]="a.marca + ' ' + a.referencia"
                        class="tap w-14 h-14 rounded-2xl object-cover ring-1 ring-black/5 dark:ring-white/10"
                      />
                    } @else {
                      <div
                        class="w-14 h-14 rounded-2xl bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-neutral-800 dark:to-neutral-700 flex items-center justify-center text-neutral-500 dark:text-neutral-400 font-bold"
                      >
                        {{ iniciales(a.marca) }}
                      </div>
                    }
                    <span
                      class="absolute -bottom-1 -right-1 w-3 h-3 rounded-full ring-2 ring-white dark:ring-neutral-900"
                      [class]="urgenciaColorDot(a.urgencia)"
                    ></span>
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-baseline gap-1.5">
                      <span class="text-sm font-bold truncate">{{
                        a.marca
                      }}</span>
                      <span
                        class="text-sm text-neutral-500 dark:text-neutral-400 truncate"
                        >{{ a.referencia }}</span
                      >
                    </div>
                    <div
                      class="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-400 dark:text-neutral-600"
                    >
                      <span>Talla {{ a.talla }}</span>
                      <span>&middot;</span>
                      <span>{{ a.stockActual }} uds.</span>
                    </div>
                  </div>

                  <div
                    class="flex flex-col items-end gap-1 flex-shrink-0 text-right"
                  >
                    <span
                      class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                      [class]="urgenciaColorBadge(a.urgencia)"
                    >
                      {{ urgenciaEtiqueta(a.urgencia) }}
                    </span>
                    <span
                      class="text-lg font-black tabular-nums leading-none"
                      [class]="urgenciaColorTexto(a.urgencia)"
                    >
                      {{ a.diasParaAgotarse
                      }}<span
                        class="text-[10px] font-semibold text-neutral-400 dark:text-neutral-600 ml-0.5"
                        >d</span
                      >
                    </span>
                  </div>

                  <svg
                    class="chevron w-4 h-4 text-neutral-300 dark:text-neutral-600 flex-shrink-0"
                    [class.chevron-open]="estaExpandido(a.zapatoId)"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                @if (estaExpandido(a.zapatoId)) {
                  <div
                    class="row-enter px-4 pb-4 pt-1 border-t border-neutral-100 dark:border-neutral-800/70"
                  >
                    <div class="grid grid-cols-3 gap-3 mt-3">
                      <div>
                        <p
                          class="text-[9px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-600"
                        >
                          Stock
                        </p>
                        <p class="text-sm font-bold mt-0.5">
                          {{ a.stockActual }} uds.
                        </p>
                      </div>
                      <div>
                        <p
                          class="text-[9px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-600"
                        >
                          Velocidad
                        </p>
                        <p class="text-sm font-bold mt-0.5">
                          ~{{ a.ventasPorSemana }}/sem
                        </p>
                      </div>
                      <div>
                        <p
                          class="text-[9px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-600"
                        >
                          Precio mín.
                        </p>
                        <p
                          class="text-sm font-bold mt-0.5"
                          [class]="urgenciaColorTexto(a.urgencia)"
                        >
                          {{
                            a.precioMin
                              | currency: 'COP' : 'symbol-narrow' : '1.0-0'
                          }}
                        </p>
                      </div>
                    </div>

                    <div class="mt-4">
                      <p
                        class="text-[9px] font-semibold uppercase tracking-widest mb-1.5 text-neutral-400 dark:text-neutral-700"
                      >
                        Ventas &middot; últimas 4 semanas
                      </p>
                      <div class="flex items-end gap-1 h-7">
                        @for (
                          v of a.historialSemanas.slice().reverse();
                          track $index
                        ) {
                          <div class="flex-1 flex flex-col justify-end h-full">
                            <div
                              class="rounded-full"
                              [class]="urgenciaColorBarra(a.urgencia)"
                              [style.height]="
                                sparklineAltura(v, a.historialSemanas) + 'px'
                              "
                              [title]="
                                'Sem ' + ($index + 1) + ': ' + v + ' ventas'
                              "
                            ></div>
                          </div>
                        }
                      </div>
                    </div>

                    <p
                      class="mt-3 text-[10px] font-mono text-neutral-300 dark:text-neutral-700"
                    >
                      Ref #{{ a.zapatoId }}
                    </p>
                  </div>
                }
              </article>
            }
          </section>
        }
      </main>
    </div>

    <button
      (click)="scrollArriba()"
      title="Subir al inicio"
      class="tap fixed bottom-6 right-5 w-11 h-11 rounded-full bg-neutral-900/90 dark:bg-white/90 backdrop-blur text-white dark:text-neutral-900 shadow-lg shadow-black/10 flex items-center justify-center z-40"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>

    @if (zoomImagen(); as url) {
      <div
        class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
        (click)="cerrarZoom()"
      >
        <button
          (click)="cerrarZoom()"
          aria-label="Cerrar"
          class="tap absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <img
          [src]="url"
          (click)="$event.stopPropagation()"
          class="zoom-enter max-w-full max-h-full rounded-2xl object-contain shadow-2xl"
        />
      </div>
    }
  `,
})
export class ReposicionComponent implements OnInit {
  private service = inject(ReposicionService);

  alertas = signal<AlertaReposicion[]>([]);
  cargando = signal(false);
  yaCalculado = signal(false);
  filtro = signal<FiltroUrgencia>('todas');
  expandidos = signal<Set<number>>(new Set());
  zoomImagen = signal<string | null>(null);
  ultimaActualizacion = signal<Date | null>(null);

  criticas = computed(
    () => this.alertas().filter((a) => a.urgencia === 'critica').length,
  );
  altas = computed(
    () => this.alertas().filter((a) => a.urgencia === 'alta').length,
  );
  medias = computed(
    () => this.alertas().filter((a) => a.urgencia === 'media').length,
  );

  unidadesEnRiesgo = computed(() =>
    this.alertas().reduce((suma, a) => suma + a.stockActual, 0),
  );
  valorEnRiesgo = computed(() =>
    this.alertas().reduce((suma, a) => suma + a.stockActual * a.precioMin, 0),
  );

  alertasFiltradas = computed(() => {
    const filtroActual = this.filtro();
    const lista = this.alertas();
    return filtroActual === 'todas'
      ? lista
      : lista.filter((a) => a.urgencia === filtroActual);
  });

  ngOnInit(): void {
    this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const datos = await this.service.calcularAlertas();
      this.alertas.set(datos);
      this.yaCalculado.set(true);
      this.ultimaActualizacion.set(new Date());
    } finally {
      this.cargando.set(false);
    }
  }

  setFiltro(valor: FiltroUrgencia): void {
    this.filtro.set(valor);
  }

  toggleExpandido(id: number): void {
    const actual = new Set(this.expandidos());
    actual.has(id) ? actual.delete(id) : actual.add(id);
    this.expandidos.set(actual);
  }

  estaExpandido(id: number): boolean {
    return this.expandidos().has(id);
  }

  abrirZoom(url: string | undefined, evento: Event): void {
    evento.stopPropagation();
    if (url) this.zoomImagen.set(url);
  }

  cerrarZoom(): void {
    this.zoomImagen.set(null);
  }

  iniciales(marca: string): string {
    return marca?.trim().charAt(0).toUpperCase() || '?';
  }

  sparklineAltura(valor: number, todos: number[]): number {
    const max = Math.max(...todos, 1);
    return Math.max(Math.round((valor / max) * 24), 3);
  }

  filtroClases(valor: FiltroUrgencia): string {
    const activo = this.filtro() === valor;
    if (!activo) return 'text-neutral-600 dark:text-neutral-300';
    switch (valor) {
      case 'critica':
        return 'bg-red-600 text-white shadow-sm';
      case 'alta':
        return 'bg-yellow-500 text-white shadow-sm';
      case 'media':
        return 'bg-sky-500 text-white shadow-sm';
      default:
        return 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm';
    }
  }

  urgenciaColorDot(u: string): string {
    return u === 'critica'
      ? 'bg-red-500'
      : u === 'alta'
        ? 'bg-yellow-400'
        : 'bg-sky-400';
  }

  urgenciaColorTexto(u: string): string {
    return u === 'critica'
      ? 'text-red-600 dark:text-red-400'
      : u === 'alta'
        ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-sky-600 dark:text-sky-400';
  }

  urgenciaColorBadge(u: string): string {
    return u === 'critica'
      ? 'bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400'
      : u === 'alta'
        ? 'bg-yellow-100 dark:bg-yellow-950/60 text-yellow-700 dark:text-yellow-400'
        : 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400';
  }

  urgenciaColorBarra(u: string): string {
    return u === 'critica'
      ? 'bg-red-400 dark:bg-red-500/70'
      : u === 'alta'
        ? 'bg-yellow-400 dark:bg-yellow-500/70'
        : 'bg-sky-400 dark:bg-sky-500/60';
  }

  urgenciaEtiqueta(u: string): string {
    return u === 'critica' ? 'Crítica' : u === 'alta' ? 'Alta' : 'Media';
  }

  scrollArriba(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
