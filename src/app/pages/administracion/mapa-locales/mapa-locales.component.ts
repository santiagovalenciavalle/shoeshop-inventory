import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  inject,
  Input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as echarts from 'echarts';
import { Local } from '../../../services/locales/locales.service';
import {
  MapaLocalesDataService,
  VentasPorLocal,
} from '../../../services/administracion/mapa-locales/mapa-locales-data.service';

@Component({
  selector: 'app-mapa-locales',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
      }
      .shimmer-line {
        height: 1px;
        background: linear-gradient(
          90deg,
          transparent 0%,
          #b45309 20%,
          #d97706 50%,
          #b45309 80%,
          transparent 100%
        );
        opacity: 0.5;
      }
      .dark .shimmer-line {
        background: linear-gradient(
          90deg,
          transparent 0%,
          #92400e 20%,
          #b45309 50%,
          #92400e 80%,
          transparent 100%
        );
      }

      @keyframes fadeUp {
        from {
          opacity: 0;
          transform: translateY(14px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .fade-up {
        animation: fadeUp 0.45s ease both;
      }
      .delay-1 {
        animation-delay: 0.07s;
      }
      .delay-2 {
        animation-delay: 0.14s;
      }
      .delay-3 {
        animation-delay: 0.21s;
      }
      .delay-4 {
        animation-delay: 0.28s;
      }

      @keyframes livePulse {
        0%,
        100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.4;
          transform: scale(0.7);
        }
      }
      .live-dot {
        animation: livePulse 2s ease-in-out infinite;
      }

      @keyframes spinRing {
        to {
          transform: rotate(360deg);
        }
      }
      .spin-ring {
        animation: spinRing 0.85s linear infinite;
        border-radius: 50%;
      }

      .metric-card {
        transition:
          transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
          box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .metric-card:hover {
        transform: translateY(-2px);
      }

      .bar-fill {
        height: 100%;
        border-radius: 2px;
        transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .data-row {
        transition: background 0.18s ease;
        cursor: pointer;
      }

      .btn-apple {
        cursor: pointer;
        transition:
          opacity 0.18s ease,
          transform 0.14s ease;
      }
      .btn-apple:hover {
        opacity: 0.86;
        transform: scale(1.02);
      }
      .btn-apple:active {
        opacity: 0.72;
        transform: scale(0.97);
      }
      .period-btn-active {
        background: linear-gradient(
          135deg,
          #b45309 0%,
          #d97706 50%,
          #b45309 100%
        );
        color: #ffffff;
        box-shadow:
          0 0 18px rgba(180, 83, 9, 0.35),
          0 2px 6px rgba(0, 0, 0, 0.3);
      }

      .chart-host {
        width: 100%;
        height: 280px;
      }
      @media (min-width: 640px) {
        .chart-host {
          height: 340px;
        }
      }
    `,
  ],
  template: `
    <div
      class="w-full bg-stone-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100
              min-h-screen py-6 px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8"
    >
      <header class="fade-up">
        <div class="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span
                class="live-dot w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-500"
              ></span>
              <span
                class="font-mono2 text-[9px] tracking-[.28em] uppercase
                         text-amber-700 dark:text-amber-600"
              >
                Inteligencia de ShoeShop
              </span>
            </div>
            <h1
              class="font-syne text-3xl sm:text-4xl font-extrabold tracking-tight
                     text-neutral-950 dark:text-white leading-none"
            >
              Rendimiento
            </h1>
            <h1
              class="font-syne text-3xl sm:text-4xl font-extrabold tracking-tight
                     text-amber-700 dark:text-amber-500 leading-none"
            >
              de Locales
            </h1>
            <p
              class="font-mono2 text-[10px] mt-2.5
                    text-neutral-400 dark:text-neutral-600"
            >
              {{ locales.length }} puntos activos &nbsp;·&nbsp;
              {{ periodoLabel }}
            </p>
          </div>

          <div class="flex flex-col items-end gap-2.5">
            <div
              class="flex items-center gap-1 p-1 rounded-2xl
                      bg-stone-200/70 dark:bg-neutral-900
                      border border-stone-300/60 dark:border-neutral-800"
            >
              @for (p of periodos; track p.valor) {
                <button
                  (click)="setPeriodo(p.valor)"
                  [disabled]="cargando"
                  class="font-syne px-4 py-2 rounded-xl text-xs font-bold tracking-widest
                       transition-all duration-300 disabled:opacity-30"
                  [class.period-btn-active]="periodo === p.valor"
                  [class]="
                    periodo !== p.valor
                      ? 'text-neutral-500 dark:text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
                      : ''
                  "
                >
                  {{ p.label }}
                </button>
              }
            </div>

            <button
              (click)="recargar()"
              [disabled]="cargando"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px]
                   font-mono2 uppercase tracking-widest transition-all duration-200
                   disabled:opacity-30
                   border border-stone-300 dark:border-neutral-800
                   text-neutral-500 dark:text-neutral-500
                   hover:border-amber-600 dark:hover:border-amber-700
                   hover:text-amber-700 dark:hover:text-amber-500"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                [class]="cargando ? 'spin-ring' : ''"
                [style]="
                  cargando
                    ? 'border:2px solid transparent; border-top-color:currentColor'
                    : ''
                "
              >
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path
                  d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
                />
              </svg>
              Sync
            </button>
          </div>
        </div>

        <div class="shimmer-line"></div>
      </header>

      @if (cargando && !metricas.length) {
        <div class="flex flex-col items-center justify-center py-44 gap-5">
          <div
            class="spin-ring w-10 h-10
                    border-2 border-stone-300 dark:border-neutral-800
                    border-t-amber-600 dark:border-t-amber-500"
          ></div>
          <p
            class="font-mono2 text-[10px] tracking-[.22em] uppercase
                  text-neutral-400 dark:text-neutral-600"
          >
            Sincronizando métricas...
          </p>
        </div>
      }

      @if (!cargando || metricas.length > 0) {
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 fade-up delay-1">
          <div
            class="metric-card rounded-2xl p-4
                    bg-white dark:bg-neutral-900
                    border border-stone-200 dark:border-neutral-800
                    hover:shadow-md hover:shadow-stone-200/60 dark:hover:shadow-none
                    dark:hover:border-amber-900/50"
          >
            <p
              class="font-mono2 text-[8px] tracking-[.22em] uppercase mb-2
                    text-neutral-400 dark:text-neutral-600"
            >
              Ventas
            </p>
            <p
              class="font-mono2 text-3xl font-light
                    text-neutral-900 dark:text-white"
            >
              {{ totalVentas }}
            </p>
            <p
              class="font-mono2 text-[9px] mt-1
                    text-neutral-400 dark:text-neutral-700"
            >
              unidades totales
            </p>
          </div>

          <div
            class="metric-card rounded-2xl p-4
                    bg-white dark:bg-neutral-900
                    border border-stone-200 dark:border-neutral-800
                    hover:shadow-md hover:shadow-stone-200/60 dark:hover:shadow-none
                    dark:hover:border-amber-900/50"
          >
            <p
              class="font-mono2 text-[8px] tracking-[.22em] uppercase mb-2
                    text-neutral-400 dark:text-neutral-600"
            >
              Caja Total
            </p>
            <p
              class="font-mono2 text-lg font-light
                    text-amber-700 dark:text-amber-400"
            >
              {{ totalIngresos | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
            </p>
            <p
              class="font-mono2 text-[9px] mt-1
                    text-neutral-400 dark:text-neutral-700"
            >
              {{ periodoLabel }}
            </p>
          </div>

          <div
            class="metric-card rounded-2xl p-4
                    bg-white dark:bg-neutral-900
                    border border-stone-200 dark:border-neutral-800
                    hover:shadow-md hover:shadow-stone-200/60 dark:hover:shadow-none
                    dark:hover:border-amber-900/50"
          >
            <p
              class="font-mono2 text-[8px] tracking-[.22em] uppercase mb-2
                    text-neutral-400 dark:text-neutral-600"
            >
              Ticket Prom.
            </p>
            <p
              class="font-mono2 text-lg font-light
                    text-neutral-900 dark:text-white"
            >
              {{ ticketPromedio | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
            </p>
            <p
              class="font-mono2 text-[9px] mt-1
                    text-neutral-400 dark:text-neutral-700"
            >
              por operación
            </p>
          </div>

          <div
            class="metric-card rounded-2xl p-4
                    bg-amber-700 dark:bg-amber-950
                    border border-amber-600 dark:border-amber-900"
          >
            <p
              class="font-mono2 text-[8px] tracking-[.22em] uppercase mb-2
                    text-amber-200/70 dark:text-amber-700"
            >
              Líder
            </p>
            <p
              class="font-syne text-sm font-bold leading-tight
                    text-white dark:text-amber-300"
            >
              {{ metricas[0]?.localNombre ?? '—' }}
            </p>
            <p
              class="font-mono2 text-[9px] mt-1
                    text-amber-200/80 dark:text-amber-600"
            >
              {{ metricas[0]?.ventas ?? 0 }} ventas
            </p>
          </div>
        </div>

        <div
          class="fade-up delay-2 rounded-3xl overflow-hidden
                  bg-white dark:bg-neutral-900
                  border border-stone-200 dark:border-neutral-800
                  shadow-sm shadow-stone-200/40 dark:shadow-none"
        >
          <div class="flex items-center justify-between px-5 sm:px-6 pt-5 pb-4">
            <div>
              <h2
                class="font-syne text-base font-bold
                       text-neutral-900 dark:text-white"
              >
                Volumen Comercial
              </h2>
              <p
                class="font-mono2 text-[10px] mt-0.5
                      text-neutral-400 dark:text-neutral-600"
              >
                Transacciones por punto de venta
              </p>
            </div>
            <div
              class="w-8 h-8 rounded-xl flex items-center justify-center
                      bg-amber-50 dark:bg-amber-950/50
                      border border-amber-200 dark:border-amber-900/60"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                class="w-4 h-4 text-amber-700 dark:text-amber-500"
                stroke="currentColor"
                stroke-width="1.8"
              >
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M8 12v4M12 8v8M16 10v6" />
              </svg>
            </div>
          </div>

          <div class="shimmer-line mx-5 sm:mx-6"></div>

          <div class="px-2 sm:px-4 py-4">
            <div #rankingChart class="chart-host"></div>
          </div>
        </div>

        @if (localSeleccionado) {
          <div
            class="fade-up rounded-3xl overflow-hidden
                    bg-amber-50 dark:bg-amber-950/20
                    border border-amber-300 dark:border-amber-900/60"
          >
            <div
              class="h-px bg-gradient-to-r
                      from-transparent via-amber-600 dark:via-amber-700 to-transparent"
            ></div>

            <div
              class="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-3"
            >
              <div>
                <p
                  class="font-mono2 text-[9px] tracking-[.25em] uppercase mb-1
                        text-amber-700 dark:text-amber-600"
                >
                  Auditoría · Tiempo real
                </p>
                <h3
                  class="font-syne text-xl font-extrabold
                         text-neutral-950 dark:text-white"
                >
                  {{ localSeleccionado.localNombre }}
                </h3>
              </div>
              <button
                (click)="localSeleccionado = null"
                class="w-7 h-7 rounded-full flex items-center justify-center
                     font-mono2 text-xs transition-all mt-1
                     bg-stone-200/80 dark:bg-neutral-800
                     text-neutral-500 dark:text-neutral-500
                     hover:bg-amber-200 dark:hover:bg-amber-900/60
                     hover:text-amber-800 dark:hover:text-amber-400"
              >
                ✕
              </button>
            </div>

            <div
              class="grid grid-cols-3
                      divide-x divide-amber-200 dark:divide-amber-900/50
                      border-t border-amber-200 dark:border-amber-900/40"
            >
              <div class="p-4 sm:p-5 text-center">
                <p
                  class="font-mono2 text-[8px] uppercase tracking-widest mb-2
                        text-neutral-400 dark:text-neutral-600"
                >
                  Ventas
                </p>
                <p
                  class="font-mono2 text-3xl font-light
                        text-neutral-900 dark:text-white"
                >
                  {{ localSeleccionado.ventas }}
                </p>
                <p
                  class="font-mono2 text-[9px] mt-1
                        text-neutral-400 dark:text-neutral-700"
                >
                  uds
                </p>
              </div>
              <div class="p-4 sm:p-5 text-center">
                <p
                  class="font-mono2 text-[8px] uppercase tracking-widest mb-2
                        text-neutral-400 dark:text-neutral-600"
                >
                  Caja Bruta
                </p>
                <p
                  class="font-mono2 text-sm font-light
                        text-amber-700 dark:text-amber-400"
                >
                  {{
                    localSeleccionado.ingresos
                      | currency: 'COP' : 'symbol-narrow' : '1.0-0'
                  }}
                </p>
              </div>
              <div class="p-4 sm:p-5 text-center">
                <p
                  class="font-mono2 text-[8px] uppercase tracking-widest mb-2
                        text-neutral-400 dark:text-neutral-600"
                >
                  Ticket
                </p>
                <p
                  class="font-mono2 text-sm font-light
                        text-neutral-900 dark:text-white"
                >
                  {{
                    localSeleccionado.ticketPromedio
                      | currency: 'COP' : 'symbol-narrow' : '1.0-0'
                  }}
                </p>
              </div>
            </div>
          </div>
        }

        <div
          class="fade-up delay-3 rounded-3xl overflow-hidden
                  bg-white dark:bg-neutral-900
                  border border-stone-200 dark:border-neutral-800
                  shadow-sm shadow-stone-100/60 dark:shadow-none"
        >
          <div class="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3">
            <div>
              <h2
                class="font-syne text-base font-bold
                       text-neutral-900 dark:text-white"
              >
                Tabla de Posiciones
              </h2>
              <p
                class="font-mono2 text-[10px] mt-0.5
                      text-neutral-400 dark:text-neutral-600"
              >
                Ordenado por volumen de despacho
              </p>
            </div>
            <span
              class="font-mono2 text-[10px] px-2.5 py-1 rounded-lg
                       bg-amber-50 dark:bg-amber-950/40
                       text-amber-700 dark:text-amber-600
                       border border-amber-200 dark:border-amber-900/50"
            >
              {{ metricas.length }} locales
            </span>
          </div>

          <div class="shimmer-line mx-5 sm:mx-6"></div>

          <div
            class="grid items-center gap-3 px-5 sm:px-6 py-3"
            style="grid-template-columns: 40px 1fr 56px 90px 104px"
          >
            <div></div>
            <p
              class="font-mono2 text-[8px] uppercase tracking-widest
                    text-neutral-400 dark:text-neutral-700"
            >
              Local
            </p>
            <p
              class="font-mono2 text-[8px] uppercase tracking-widest text-right
                    text-neutral-400 dark:text-neutral-700"
            >
              Vtas
            </p>
            <p
              class="font-mono2 text-[8px] uppercase tracking-widest text-right
                    hidden sm:block text-neutral-400 dark:text-neutral-700"
            >
              Ingresos
            </p>
            <p
              class="font-mono2 text-[8px] uppercase tracking-widest text-right
                    text-neutral-400 dark:text-neutral-700"
            >
              Rend.
            </p>
          </div>

          @for (m of metricas; track m.localId; let i = $index) {
            <div
              (click)="seleccionar(m)"
              [ngClass]="
                localSeleccionado?.localId === m.localId
                  ? 'data-row grid items-center gap-3 px-5 sm:px-6 py-4 border-t border-stone-100 dark:border-neutral-800/60 hover:bg-amber-50/60 dark:hover:bg-amber-950/10 bg-amber-50 border-l-2 border-l-amber-600'
                  : 'data-row grid items-center gap-3 px-5 sm:px-6 py-4 border-t border-stone-100 dark:border-neutral-800/60 hover:bg-amber-50/60 dark:hover:bg-amber-950/10'
              "
              style="grid-template-columns: 40px 1fr 56px 90px 104px"
            >
              <div class="flex justify-center">
                @if (i === 0) {
                  <span class="text-lg leading-none">🥇</span>
                } @else if (i === 1) {
                  <span class="text-lg leading-none">🥈</span>
                } @else if (i === 2) {
                  <span class="text-lg leading-none">🥉</span>
                } @else {
                  <div
                    class="w-7 h-7 rounded-lg flex items-center justify-center
                            font-mono2 text-[11px]
                            bg-stone-100 dark:bg-neutral-800
                            text-neutral-400 dark:text-neutral-600
                            border border-stone-200 dark:border-neutral-700"
                  >
                    {{ i + 1 }}
                  </div>
                }
              </div>

              <p
                [ngClass]="
                  localSeleccionado?.localId === m.localId
                    ? 'font-syne text-sm font-semibold truncate transition-colors duration-200 text-amber-700'
                    : 'font-syne text-sm font-semibold truncate transition-colors duration-200 text-neutral-800 dark:text-neutral-200'
                "
              >
                {{ m.localNombre }}
              </p>

              <p
                class="font-mono2 text-sm text-right
                      text-neutral-900 dark:text-white"
              >
                {{ m.ventas
                }}<span
                  class="text-[9px] text-neutral-400 dark:text-neutral-700"
                >
                  u</span
                >
              </p>

              <p
                class="font-mono2 text-[11px] text-right hidden sm:block
                      text-neutral-500 dark:text-neutral-500"
              >
                {{ m.ingresos | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
              </p>

              <div class="flex flex-col items-end gap-1.5">
                <div
                  class="w-full h-[3px] rounded-full overflow-hidden
                          bg-stone-200 dark:bg-neutral-800"
                >
                  <div
                    class="bar-fill"
                    [style.width]="m.porcentaje + '%'"
                    [style.background]="barColor(m.porcentaje)"
                  ></div>
                </div>
                <span
                  class="font-mono2 text-[10px]"
                  [style.color]="colorLineal(m.porcentaje)"
                >
                  {{ m.porcentaje }}%
                </span>
              </div>
            </div>
          }
        </div>

        <div
          class="fade-up delay-4 rounded-3xl overflow-hidden
                  bg-white dark:bg-neutral-900
                  border border-stone-200 dark:border-neutral-800"
        >
          <div
            class="h-px bg-gradient-to-r
                    from-transparent via-amber-600 dark:via-amber-800 to-transparent"
          ></div>

          <div
            class="flex items-center justify-between gap-4 px-5 sm:px-6 pt-5 pb-4"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0
                        bg-amber-50 dark:bg-amber-950/50
                        border border-amber-200 dark:border-amber-900/60"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  class="w-4 h-4 text-amber-700 dark:text-amber-500"
                  stroke="currentColor"
                  stroke-width="1.6"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <p
                  class="font-syne text-sm font-bold
                        text-neutral-900 dark:text-white"
                >
                  Análisis IA
                </p>
                @if (reporteGeneradoEn) {
                  <p
                    class="font-mono2 text-[9px] mt-0.5
                          text-neutral-400 dark:text-neutral-600"
                  >
                    {{ reporteGeneradoEn }}
                  </p>
                }
              </div>
            </div>

            <button
              (click)="regenerarReporte()"
              [disabled]="generandoReporte"
              class="font-mono2 text-[10px] uppercase tracking-widest px-3 py-1.5
                   rounded-xl transition-all duration-200 disabled:opacity-30
                   border border-stone-300 dark:border-neutral-700
                   text-neutral-500 dark:text-neutral-500
                   hover:border-amber-600 dark:hover:border-amber-700
                   hover:text-amber-700 dark:hover:text-amber-500"
            >
              {{ generandoReporte ? '···' : '↺ Recalc' }}
            </button>
          </div>

          <div class="shimmer-line mx-5 sm:mx-6 opacity-40"></div>

          <div class="px-5 sm:px-6 py-5">
            @if (generandoReporte) {
              <div class="flex items-center gap-3">
                <div
                  class="spin-ring w-4 h-4 flex-shrink-0
                          border-2 border-stone-300 dark:border-neutral-700
                          border-t-amber-600 dark:border-t-amber-500"
                ></div>
                <p
                  class="font-mono2 text-xs text-amber-700 dark:text-amber-600"
                >
                  Estructurando auditoría ejecutiva...
                </p>
              </div>
            } @else if (reporteIA) {
              <p
                class="font-syne text-sm leading-7 font-light whitespace-pre-line
                      text-neutral-600 dark:text-neutral-400"
              >
                {{ reporteIA }}
              </p>
            }
          </div>
        </div>
      }
    </div>

    <button
      (click)="scrollToTop()"
      title="Subir al inicio"
      class="btn-apple fixed bottom-6 right-6 w-10 h-10 rounded-full bg-[#d4a017] text-white shadow-lg flex items-center justify-center z-50"
    >
      <svg
        class="icon w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  `,
})
export class MapaLocalesComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('rankingChart') rankingRef!: ElementRef;
  @Input() periodo = 14;

  private dataService = inject(MapaLocalesDataService);
  private cdr = inject(ChangeDetectorRef);

  readonly periodos = [
    { valor: 7, label: '7D' },
    { valor: 14, label: '14D' },
    { valor: 30, label: '30D' },
  ];

  locales: Local[] = [];
  metricas: VentasPorLocal[] = [];
  localSeleccionado: VentasPorLocal | null = null;
  reporteIA = '';
  reporteGeneradoEn = '';
  generandoReporte = false;
  cargando = false;

  private rankingChart: echarts.ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private viewReady = false;
  private pendienteRender = false;

  get totalVentas(): number {
    return this.metricas.reduce((s, m) => s + m.ventas, 0);
  }
  get totalIngresos(): number {
    return this.metricas.reduce((s, m) => s + m.ingresos, 0);
  }
  get ticketPromedio(): number {
    return this.totalVentas > 0
      ? Math.round(this.totalIngresos / this.totalVentas)
      : 0;
  }

  get periodoLabel(): string {
    const p = this.periodos.find((x) => x.valor === this.periodo);
    return `Últimos ${p?.valor ?? this.periodo} días`;
  }

  ngOnInit(): void {
    this.cargar();
    this.scrollToTop();
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  ngAfterViewInit(): void {
    this.viewReady = true;
    this.inicializarChart();
  }
  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.rankingChart?.dispose();
  }

  private inicializarChart(): void {
    if (!this.rankingRef?.nativeElement || this.rankingChart) return;

    this.rankingChart = echarts.init(this.rankingRef.nativeElement, null, {
      renderer: 'canvas',
    });

    this.resizeObserver = new ResizeObserver(() => {
      this.rankingChart?.resize({ width: 'auto', height: 'auto' });
    });
    this.resizeObserver.observe(this.rankingRef.nativeElement);

    if (this.pendienteRender) {
      this.renderRankingChart();
      this.pendienteRender = false;
    }
  }

  async cargar(): Promise<void> {
    this.cargando = true;
    this.cdr.markForCheck();
    try {
      this.locales = await this.dataService.obtenerLocalesActivos();
      const raw = await this.dataService.calcularMetricasPorLocal(
        this.locales,
        this.periodo,
      );
      this.metricas = raw.sort((a, b) => b.ventas - a.ventas);
      this.cargando = false;
      this.cdr.markForCheck();

      setTimeout(() => {
        if (this.viewReady && this.metricas.length > 0) {
          this.inicializarChart();
          this.renderRankingChart();
        } else {
          this.pendienteRender = true;
        }
      }, 50);

      this.cargarReporteIA();
    } catch (err) {
      console.error('Error cargando métricas:', err);
      this.cargando = false;
      this.cdr.markForCheck();
    }
  }

  setPeriodo(d: number): void {
    this.periodo = d;
    this.cargar();
  }
  recargar(): void {
    this.cargar();
  }

  seleccionar(m: VentasPorLocal): void {
    this.localSeleccionado =
      this.localSeleccionado?.localId === m.localId ? null : m;
    this.cdr.markForCheck();
  }

  async regenerarReporte(): Promise<void> {
    this.dataService.forzarRegeneracionReporte();
    await this.cargarReporteIA(true);
  }

  private async cargarReporteIA(forzar = false): Promise<void> {
    if (!forzar) {
      const cache = this.dataService.obtenerReporteCacheado();
      if (cache) {
        this.reporteIA = cache.texto;
        this.formatearFechaReporte(cache.generadoEn);
        this.cdr.markForCheck();
        return;
      }
    }
    this.generandoReporte = true;
    this.cdr.markForCheck();
    try {
      this.reporteIA = await this.dataService.generarReporteIA(
        this.metricas,
        this.periodo,
      );
      const cache = this.dataService.obtenerReporteCacheado();
      if (cache) this.formatearFechaReporte(cache.generadoEn);
    } finally {
      this.generandoReporte = false;
      this.cdr.markForCheck();
    }
  }

  private formatearFechaReporte(fechaStr: string): void {
    const d = new Date(fechaStr);
    this.reporteGeneradoEn = `Análisis: ${d.toLocaleString('es-CO', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  private renderRankingChart(): void {
    if (!this.rankingChart || !this.metricas.length) return;

    const isDark = document.documentElement.classList.contains('dark');
    const isMobile = window.innerWidth < 640;

    const gold = isDark ? '#b45309' : '#92400e';
    const goldBright = isDark ? '#d97706' : '#b45309';
    const axisLabel = isDark ? '#525252' : '#a3a3a3';
    const splitLine = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
    const labelColor = isDark ? '#d4d4d4' : '#404040';
    const tooltipBg = isDark ? '#171717' : '#ffffff';
    const tooltipBorder = isDark ? 'rgba(180,83,9,.4)' : 'rgba(146,64,14,.25)';

    const datos = [...this.metricas].reverse();

    this.rankingChart.setOption(
      {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'none' },
          confine: true,
          backgroundColor: tooltipBg,
          borderColor: tooltipBorder,
          borderWidth: 1,
          padding: [10, 14],
          textStyle: {
            fontFamily: 'DM Mono, monospace',
            fontSize: 11,
            color: isDark ? '#e5e5e5' : '#171717',
          },
          formatter: (params: any) => {
            const item = datos[params[0].dataIndex];
            const fmt = new Intl.NumberFormat('es-CO', {
              style: 'currency',
              currency: 'COP',
              maximumFractionDigits: 0,
            }).format(item.ingresos);
            return `<span style="font-size:9px;text-transform:uppercase;
                    letter-spacing:.15em;color:${goldBright}">${item.localNombre}</span><br/>
                  <span style="font-size:14px;font-weight:300;
                    color:${isDark ? '#fff' : '#0a0a0a'}">${item.ventas}</span>
                  <span style="font-size:10px;color:${axisLabel}"> uds</span><br/>
                  <span style="font-size:11px;color:${goldBright}">${fmt}</span>`;
          },
        },
        grid: { top: 8, bottom: 12, left: 6, right: 52, containLabel: true },
        xAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: splitLine, type: 'dashed' } },
          axisLabel: {
            color: axisLabel,
            fontSize: 9,
            fontFamily: 'DM Mono, monospace',
          },
          axisLine: { show: false },
          axisTick: { show: false },
        },
        yAxis: {
          type: 'category',
          data: datos.map((m) => m.localNombre),
          axisLabel: {
            color: axisLabel,
            fontSize: 11,
            fontWeight: '600',
            fontFamily: 'Syne, sans-serif',
            width: isMobile ? 72 : 130,
            overflow: 'truncate',
          },
          axisLine: { show: false },
          axisTick: { show: false },
        },
        series: [
          {
            type: 'bar',
            data: datos.map((m) => m.ventas),
            barWidth: isMobile ? '55%' : '38%',
            itemStyle: {
              borderRadius: [0, 6, 6, 0],
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                {
                  offset: 0,
                  color: isDark ? 'rgba(92,64,14,.7)' : 'rgba(120,53,15,.5)',
                },
                {
                  offset: 0.6,
                  color: isDark ? 'rgba(180,83,9,.9)' : 'rgba(146,64,14,.85)',
                },
                {
                  offset: 1,
                  color: isDark ? 'rgba(217,119,6,1)' : 'rgba(180,83,9,1)',
                },
              ]),
            },
            label: {
              show: true,
              position: 'right',
              color: labelColor,
              fontWeight: '500',
              fontSize: 11,
              fontFamily: 'DM Mono, monospace',
              formatter: ' {c}',
            },
            emphasis: {
              itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: gold },
                  { offset: 1, color: goldBright },
                ]),
                shadowBlur: 14,
                shadowColor: isDark
                  ? 'rgba(180,83,9,.45)'
                  : 'rgba(146,64,14,.3)',
              },
            },
          },
        ],
      },
      true,
    );
  }

  colorLineal(pct: number): string {
    if (pct >= 80) return '#16a34a';
    if (pct >= 60) return '#65a30d';
    if (pct >= 40) return '#d97706';
    if (pct >= 20) return '#ea580c';
    return '#dc2626';
  }

  barColor(pct: number): string {
    const isDark = document.documentElement.classList.contains('dark');
    if (pct >= 60) return isDark ? '#16a34a' : '#15803d';
    if (pct >= 40) return isDark ? '#d97706' : '#b45309';
    return isDark ? '#dc2626' : '#b91c1c';
  }
}
