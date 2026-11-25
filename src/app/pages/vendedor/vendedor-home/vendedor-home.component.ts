import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  Inject,
  PLATFORM_ID,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
  NgZone,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import ApexCharts from 'apexcharts';

import { AuthService } from '../../../services/auth/auth.service';
import { SalesService } from '../../../services/vendedorServices/ventas/sales.service';
import { PrestamosService } from '../../../services/vendedorServices/prestamos/prestamos.service';
import {
  MetasService,
  ProgresoMensualVendedor,
  ProgresoVendedor,
} from '../../../services/metas/metas.service';
import { Venta } from '../../../pages/interfaces';
import {
  AiConsejoService,
  ConsejoIA,
} from '../../../services/administracion/ia/ai-consejo.service';

interface QuickAction {
  label: string;
  icon: string;
  path: string;
  bgClass: string;
  iconClass: string;
}

@Component({
  selector: 'app-vendedor-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule],
  styles: [
    `
      @keyframes homeFade {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes livePulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.35;
        }
      }
      .home-in {
        animation: homeFade 0.45s cubic-bezier(0.22, 0.68, 0, 1) both;
      }
      .live-dot {
        animation: livePulse 2.4s ease-in-out infinite;
      }
      .seg {
        display: inline-flex;
        padding: 3px;
        border-radius: 10px;
        background: #f5f5f5;
      }
      .dark .seg {
        background: #171717;
      }
      .seg button {
        padding: 5px 14px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        color: #737373;
        transition: all 0.15s ease;
      }
      .seg button.on {
        background: #ffffff;
        color: #000000;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
      }
      .dark .seg button.on {
        background: #262626;
        color: #ffffff;
        box-shadow: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .home-in,
        .live-dot {
          animation: none;
        }
      }
    `,
  ],
  template: `
    <div
      class="w-full min-h-screen bg-neutral-50 dark:bg-black transition-colors duration-300"
    >
      <div
        class="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-9 space-y-6"
      >
        <!-- Encabezado -->
        <header
          class="home-in flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5"
        >
          <div class="min-w-0">
            <p
              class="text-sm text-neutral-500 dark:text-neutral-400 capitalize"
            >
              {{ hoyLabel }}
            </p>
            <h1
              class="mt-1 text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white truncate"
            >
              Hola, {{ usuario?.name || 'Vendedor' }}
            </h1>
            <div class="flex flex-wrap items-center gap-2 mt-3">
              @if (usuario?.local) {
                <span
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M3 21h18M5 21V7l7-4 7 4v14" />
                  </svg>
                  Local {{ usuario.local }}
                </span>
              }
              <span
                class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300"
              >
                {{ usuario?.role === 'admin' ? 'Administrador' : 'Vendedor' }}
              </span>
            </div>
          </div>

          <button
            type="button"
            (click)="navigateToAction('/vendedor/catalogo')"
            class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-black text-sm font-semibold hover:bg-neutral-700 dark:hover:bg-neutral-200 active:scale-[0.98] transition-all self-start sm:self-auto"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Solicitar tennis
          </button>
        </header>

        <!-- Alerta -->
        @if (usuario?.prestamosActivos?.value === false) {
          <div
            class="home-in flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 px-4 py-3.5"
            role="alert"
          >
            <svg
              class="mt-0.5 shrink-0 text-rose-500"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <p class="text-sm font-semibold text-rose-700 dark:text-rose-300">
                Préstamos bloqueados
              </p>
              <p class="text-xs text-rose-600/90 dark:text-rose-300/80 mt-0.5">
                No tienes permisos para hacer préstamos. Consulta al
                administrador.
              </p>
            </div>
          </div>
        }

        <!-- Indicadores -->
        <section class="home-in grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <!-- Ventas del día -->
          <article
            class="rounded-2xl p-4 sm:p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800"
          >
            <div class="flex items-center justify-between">
              <p
                class="text-xs sm:text-sm font-medium text-neutral-500 dark:text-neutral-400"
              >
                Ventas del día
              </p>
              @if (!isLoading && progreso?.meta?.metaVentas) {
                <span
                  class="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300"
                  >{{ metaPctVentas }}%</span
                >
              }
            </div>
            @if (!isLoading) {
              <p
                class="mt-3 text-xl sm:text-3xl font-bold text-neutral-900 dark:text-white tabular-nums tracking-tight"
              >
                {{ formatCurrency(TotalSales) }}
              </p>
            } @else {
              <div
                class="mt-3 h-8 w-32 rounded-lg bg-neutral-200 dark:bg-neutral-800 animate-pulse"
              ></div>
            }
            <div
              class="mt-4 h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-900 overflow-hidden"
            >
              <div
                class="h-full rounded-full bg-amber-500 transition-all duration-700"
                [style.width.%]="isLoading ? 0 : metaPctVentas"
              ></div>
            </div>
            <p class="mt-2 text-[11px] text-neutral-400 dark:text-neutral-500">
              {{
                progreso?.meta?.metaVentas
                  ? 'Avance frente a tu meta'
                  : 'Sin meta asignada'
              }}
            </p>
          </article>

          <!-- Pares vendidos -->
          <article
            class="rounded-2xl p-4 sm:p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800"
          >
            <div class="flex items-center justify-between">
              <p
                class="text-xs sm:text-sm font-medium text-neutral-500 dark:text-neutral-400"
              >
                Pares vendidos hoy
              </p>
            </div>
            @if (!isLoading) {
              <p
                class="mt-3 text-xl sm:text-3xl font-bold text-neutral-900 dark:text-white tabular-nums tracking-tight"
              >
                {{ zapatosVendidos }}
              </p>
            } @else {
              <div
                class="mt-3 h-8 w-16 rounded-lg bg-neutral-200 dark:bg-neutral-800 animate-pulse"
              ></div>
            }
            <div
              class="mt-4 h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-900 overflow-hidden"
            >
              <div
                class="h-full rounded-full bg-neutral-800 dark:bg-neutral-300 transition-all duration-700"
                [style.width.%]="isLoading ? 0 : metaPctVentas"
              ></div>
            </div>
            <p class="mt-2 text-[11px] text-neutral-400 dark:text-neutral-500">
              @if (progreso?.meta?.metaVentas) {
                Meta: {{ progreso?.meta?.metaVentas }} pares
              } @else {
                Sin meta asignada
              }
            </p>
          </article>

          <!-- Progreso del mes -->
          <article
            class="rounded-2xl p-4 sm:p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800"
          >
            <div class="flex items-center justify-between">
              <p
                class="text-xs sm:text-sm font-medium text-neutral-500 dark:text-neutral-400"
              >
                Meta del mes
              </p>
              @if (progresoMensual?.cumplioMeta) {
                <span
                  class="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                  >Cumplida</span
                >
              }
            </div>
            @if (!isLoadingMensual) {
              <p
                class="mt-3 text-xl sm:text-3xl font-bold text-neutral-900 dark:text-white tabular-nums tracking-tight"
              >
                {{ progresoMensual?.ventasMes ?? 0 }}
                <span
                  class="text-sm sm:text-base font-medium text-neutral-400 dark:text-neutral-500"
                  >/ {{ progresoMensual?.metaMensual ?? 0 }}</span
                >
              </p>
            } @else {
              <div
                class="mt-3 h-8 w-24 rounded-lg bg-neutral-200 dark:bg-neutral-800 animate-pulse"
              ></div>
            }
            <div
              class="mt-4 h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-900 overflow-hidden"
            >
              <div
                class="h-full rounded-full transition-all duration-700"
                [class]="
                  progresoMensual?.cumplioMeta
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                "
                [style.width.%]="isLoadingMensual ? 0 : metaPctMensual"
              ></div>
            </div>
            <p class="mt-2 text-[11px] text-neutral-400 dark:text-neutral-500">
              {{ mesActualLabel }}
            </p>
          </article>

          <!-- Préstamos -->
          <article
            class="rounded-2xl p-4 sm:p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800"
          >
            <div class="flex items-center justify-between">
              <p
                class="text-xs sm:text-sm font-medium text-neutral-500 dark:text-neutral-400"
              >
                Préstamos pendientes
              </p>
              @if (!isLoadingPrestamos && prestamosPendientes > 0) {
                <span
                  class="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400"
                  >Por devolver</span
                >
              }
            </div>
            @if (!isLoadingPrestamos) {
              <p
                class="mt-3 text-xl sm:text-3xl font-bold text-neutral-900 dark:text-white tabular-nums tracking-tight"
              >
                {{ prestamosPendientes }}
              </p>
            } @else {
              <div
                class="mt-3 h-8 w-16 rounded-lg bg-neutral-200 dark:bg-neutral-800 animate-pulse"
              ></div>
            }
            <div
              class="mt-4 h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-900 overflow-hidden"
            >
              <div
                class="h-full rounded-full bg-rose-500 transition-all duration-700"
                [style.width.%]="
                  isLoadingPrestamos ? 0 : prestamosPendientes > 0 ? 100 : 0
                "
              ></div>
            </div>
            <p class="mt-2 text-[11px] text-neutral-400 dark:text-neutral-500">
              {{
                prestamosPendientes === 0
                  ? 'Sin préstamos activos'
                  : prestamosPendientes === 1
                    ? '1 préstamo activo'
                    : prestamosPendientes + ' préstamos activos'
              }}
            </p>
          </article>
        </section>

        <section
          class="home-in flex items-start gap-4 rounded-2xl p-4 sm:p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800"
        >
          <div
            class="shrink-0 w-10 h-10 rounded-xl bg-neutral-900 dark:bg-white flex items-center justify-center text-white dark:text-black"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4L12 2z"
              />
              <path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
            </svg>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h2
                class="text-sm font-semibold text-neutral-900 dark:text-white"
              >
                Consejo del día
              </h2>
              <span
                class="live-dot w-1.5 h-1.5 rounded-full bg-emerald-500"
                aria-hidden="true"
              ></span>
            </div>
            @if (isLoadingConsejo) {
              <div class="mt-3 space-y-2">
                <div
                  class="h-4 w-3/4 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse"
                ></div>
                <div
                  class="h-3.5 w-full rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse"
                ></div>
              </div>
            } @else if (consejo) {
              <p
                class="mt-1.5 text-sm sm:text-base font-medium text-neutral-800 dark:text-neutral-100"
              >
                {{ consejo.frase }}
              </p>
              <p
                class="mt-1 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400"
              >
                {{ consejo.consejo }}
              </p>
            } @else {
              <p
                class="mt-1.5 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400"
              >
                Hoy es un buen día para vender, {{ usuario?.name }}. Revisa tus
                metas y prioriza las referencias de mayor rotación.
              </p>
            }
          </div>
        </section>

        <!-- Metas y pagos -->
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5">
          <!-- Metas -->
          <section
            class="home-in lg:col-span-3 rounded-2xl p-5 sm:p-6 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800"
          >
            <div class="flex items-center justify-between gap-3 flex-wrap mb-5">
              <div>
                <h2
                  class="text-base font-semibold text-neutral-900 dark:text-white"
                >
                  Cumplimiento de metas
                </h2>
                <p
                  class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5"
                >
                  Pares vendidos frente a tu objetivo
                </p>
              </div>
              <div class="seg" role="group" aria-label="Periodo">
                <button
                  type="button"
                  (click)="vistaGraficas = 'mensual'"
                  [class.on]="vistaGraficas === 'mensual'"
                  [attr.aria-pressed]="vistaGraficas === 'mensual'"
                >
                  Mes
                </button>
                <button
                  type="button"
                  (click)="vistaGraficas = 'semanal'"
                  [class.on]="vistaGraficas === 'semanal'"
                  [attr.aria-pressed]="vistaGraficas === 'semanal'"
                >
                  Semanas
                </button>
              </div>
            </div>

            @if (isLoadingMensual) {
              <div
                class="flex items-center justify-center h-56 text-sm text-neutral-400 dark:text-neutral-600"
              >
                Cargando datos…
              </div>
            } @else if (!progresoMensual) {
              <div
                class="flex flex-col items-center justify-center h-56 text-center gap-1"
              >
                <p
                  class="text-sm font-medium text-neutral-600 dark:text-neutral-300"
                >
                  Sin metas para este mes
                </p>
                <p class="text-xs text-neutral-400 dark:text-neutral-500">
                  Cuando el administrador asigne tu meta, la verás aquí.
                </p>
              </div>
            } @else {
              @if (vistaGraficas === 'mensual') {
                <div class="grid sm:grid-cols-2 gap-4 items-center">
                  <div #monthlyRadialEl style="width: 100%"></div>
                  <dl class="grid grid-cols-2 sm:grid-cols-1 gap-3">
                    <div
                      class="rounded-xl p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
                    >
                      <dt
                        class="text-xs text-neutral-500 dark:text-neutral-400"
                      >
                        Vendidos este mes
                      </dt>
                      <dd
                        class="mt-1 text-xl font-bold tabular-nums text-neutral-900 dark:text-white"
                      >
                        {{ progresoMensual.ventasMes }}
                        <span class="text-sm font-medium text-neutral-400"
                          >pares</span
                        >
                      </dd>
                    </div>
                    <div
                      class="rounded-xl p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
                    >
                      <dt
                        class="text-xs text-neutral-500 dark:text-neutral-400"
                      >
                        Meta mensual
                      </dt>
                      <dd
                        class="mt-1 text-xl font-bold tabular-nums text-neutral-900 dark:text-white"
                      >
                        {{ progresoMensual.metaMensual }}
                        <span class="text-sm font-medium text-neutral-400"
                          >pares</span
                        >
                      </dd>
                    </div>
                  </dl>
                </div>
              }

              @if (vistaGraficas === 'semanal') {
                <div class="space-y-5">
                  <div #weeklyBarEl style="width: 100%"></div>

                  @if (
                    progresoMensual.semanas &&
                    progresoMensual.semanas.length > 0
                  ) {
                    <div
                      class="pt-4 border-t border-neutral-200 dark:border-neutral-800"
                    >
                      <h3
                        class="text-sm font-semibold text-neutral-900 dark:text-white mb-3"
                      >
                        Detalle por semana
                      </h3>
                      <ul class="space-y-2">
                        @for (
                          semana of progresoMensual.semanas;
                          track semana.numero
                        ) {
                          <li
                            class="flex items-center gap-4 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
                          >
                            <span
                              class="text-sm font-medium text-neutral-700 dark:text-neutral-200 w-20 shrink-0"
                              >Semana {{ semana.numero }}</span
                            >
                            <div
                              class="flex-1 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden"
                            >
                              <div
                                class="h-full rounded-full bg-amber-500 transition-all duration-500"
                                [style.width.%]="
                                  semana.meta
                                    ? min100(
                                        (semana.ventas / semana.meta) * 100
                                      )
                                    : 0
                                "
                              ></div>
                            </div>
                            <span
                              class="text-sm font-semibold tabular-nums text-neutral-900 dark:text-white w-16 text-right"
                              >{{ semana.ventas }}/{{ semana.meta }}</span
                            >
                          </li>
                        }
                      </ul>
                    </div>
                  }
                </div>
              }
            }
          </section>

          <!-- Métodos de pago -->
          <section
            class="home-in lg:col-span-2 rounded-2xl p-5 sm:p-6 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800"
          >
            <div class="flex items-start justify-between gap-3 mb-5">
              <div>
                <h2
                  class="text-base font-semibold text-neutral-900 dark:text-white"
                >
                  Métodos de pago
                </h2>
                <p
                  class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5"
                >
                  Distribución de las ventas de hoy
                </p>
              </div>
            </div>

            @if (isLoading) {
              <div class="space-y-3">
                @for (i of [1, 2, 3, 4]; track i) {
                  <div
                    class="h-10 rounded-lg bg-neutral-200 dark:bg-neutral-800 animate-pulse"
                  ></div>
                }
              </div>
            } @else if (TotalSales <= 0) {
              <div
                class="flex flex-col items-center justify-center py-12 gap-1 text-center"
              >
                <p
                  class="text-sm font-medium text-neutral-600 dark:text-neutral-300"
                >
                  Aún no hay ventas hoy
                </p>
                <p class="text-xs text-neutral-400 dark:text-neutral-500">
                  Verás el desglose con tu primera venta.
                </p>
              </div>
            } @else {
              <div
                class="flex h-2.5 w-full rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-900 mb-5"
                role="img"
                aria-label="Distribución por método de pago"
              >
                @for (m of metodosPago; track m.label) {
                  @if (m.value > 0) {
                    <div
                      [class]="m.bar"
                      [style.width.%]="(m.value / TotalSales) * 100"
                    ></div>
                  }
                }
              </div>

              <ul class="space-y-3.5">
                @for (m of metodosPago; track m.label) {
                  <li class="flex items-center justify-between gap-3">
                    <span class="flex items-center gap-2.5 min-w-0">
                      <span
                        class="w-2.5 h-2.5 rounded-full shrink-0"
                        [class]="m.bar"
                      ></span>
                      <span
                        class="text-sm text-neutral-700 dark:text-neutral-300 truncate"
                        >{{ m.label }}</span
                      >
                    </span>
                    <span class="flex items-center gap-3 shrink-0">
                      <span
                        class="text-sm font-semibold tabular-nums text-neutral-900 dark:text-white"
                        >{{ formatCurrency(m.value) }}</span
                      >
                      <span
                        class="text-xs tabular-nums text-neutral-400 dark:text-neutral-500 w-10 text-right"
                        >{{ getPaymentPercentage(m.value) }}%</span
                      >
                    </span>
                  </li>
                }
              </ul>

              <div
                class="mt-5 pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between"
              >
                <span
                  class="text-sm font-medium text-neutral-500 dark:text-neutral-400"
                  >Total del día</span
                >
                <span
                  class="text-lg font-bold tabular-nums text-neutral-900 dark:text-white"
                  >{{ formatCurrency(TotalSales) }}</span
                >
              </div>
            }
          </section>
        </div>

        <!-- Accesos -->
        <section class="home-in">
          <h2
            class="text-base font-semibold text-neutral-900 dark:text-white mb-3"
          >
            Accesos rápidos
          </h2>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            @for (action of quickActions; track action.path) {
              <button
                type="button"
                (click)="navigateToAction(action.path)"
                [attr.aria-label]="action.label"
                class="group flex items-center gap-3 rounded-xl p-3.5 text-left bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-900 dark:hover:border-neutral-500 hover:shadow-sm active:scale-[0.98] transition-all
                       focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              >
                <span
                  class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 group-hover:bg-neutral-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-colors"
                >
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      [attr.d]="action.icon"
                    ></path>
                  </svg>
                </span>
                <span
                  class="text-sm font-medium text-neutral-800 dark:text-neutral-100 leading-snug"
                  >{{ action.label }}</span
                >
              </button>
            }
          </div>
        </section>
      </div>
    </div>
  `,
})
export class VendedorHomeComponent implements OnInit, AfterViewInit, OnDestroy {
  usuario: any = null;
  TotalSales = 0;
  zapatosVendidos = 0;
  prestamosPendientes = 0;
  efectivoTotal = 0;
  transferenciaTotal = 0;
  totalAddi = 0;
  totalBold = 0;
  totalSistecredito = 0;
  isLoading = true;
  isLoadingPrestamos = true;
  progresoMensual: ProgresoMensualVendedor | null = null;
  isLoadingMensual = true;
  progreso: ProgresoVendedor | null = null;
  isLoadingMeta = true;
  consejo: ConsejoIA | null = null;
  isLoadingConsejo = true;
  mesActualLabel = '';
  hoyLabel = '';
  vistaGraficas: 'mensual' | 'semanal' = 'mensual';

  @ViewChild('monthlyRadialEl') monthlyRadialEl?: ElementRef;
  @ViewChild('weeklyBarEl') weeklyBarEl?: ElementRef;

  private monthlyRadialInst?: InstanceType<typeof ApexCharts>;
  private weeklyBarInst?: InstanceType<typeof ApexCharts>;

  private viewReady = false;
  private destroyed = false;

  private readonly P = {
    gold: '#d4af37',
    emerald: '#10b981',
    rose: '#f43f5e',
    silver: '#94a3b8',
    trackDark: '#27272a',
    trackLight: '#f1f5f9',
  } as const;

  quickActions: QuickAction[] = [
    {
      label: 'Solicitar Tennis',
      icon: 'M12 3v18M3 12h18',
      path: '/vendedor/catalogo',
      bgClass: 'bg-amber-500/10 border border-amber-500/20',
      iconClass: 'w-4 h-4 text-amber-600 dark:text-amber-400',
    },
    {
      label: 'En locales',
      icon: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h1M9 13h1M14 9h1M14 13h1M9 21v-4h6v4',
      path: '/vendedor/almacen',
      bgClass: 'bg-amber-500/10 border border-amber-500/20',
      iconClass: 'w-4 h-4 text-amber-600 dark:text-amber-400',
    },
    {
      label: 'Mis Pedidos',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
      path: '/vendedor/pedidos',
      bgClass: 'bg-violet-500/10 border border-violet-500/20',
      iconClass: 'w-4 h-4 text-violet-600 dark:text-violet-400',
    },
    {
      label: 'Préstamos',
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      path: '/vendedor/prestamos',
      bgClass: 'bg-emerald-500/10 border border-emerald-500/20',
      iconClass: 'w-4 h-4 text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Ver Ventas',
      icon: 'M13 7H7v10h6V7zM13 3H7c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm8-2v18H3V1h18z',
      path: '/vendedor/ventas',
      bgClass: 'bg-rose-500/10 border border-rose-500/20',
      iconClass: 'w-4 h-4 text-rose-600 dark:text-rose-400',
    },
    {
      label: 'Exhibiciones',
      icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
      path: '/vendedor/exhibiciones',
      bgClass: 'bg-orange-500/10 border border-orange-500/20',
      iconClass: 'w-4 h-4 text-orange-600 dark:text-orange-400',
    },
    {
      label: 'Venta Otro Local',
      icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12',
      path: '/vendedor/venta-local',
      bgClass: 'bg-fuchsia-500/10 border border-fuchsia-500/20',
      iconClass: 'w-4 h-4 text-fuchsia-600 dark:text-fuchsia-400',
    },
    {
      label: 'Bonos',
      icon: 'M14 4l-4-4m0 0L6 4m4-4v4m4 2l4-4m0 0l-4-4m4 4v4',
      path: '/vendedor/bonos',
      bgClass: 'bg-lime-500/10 border border-lime-500/20',
      iconClass: 'w-4 h-4 text-lime-600 dark:text-lime-400',
    },
    {
      label: 'Mis Metas',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      path: '/vendedor/metas',
      bgClass: 'bg-pink-500/10 border border-pink-500/20',
      iconClass: 'w-4 h-4 text-pink-600 dark:text-pink-400',
    },
    {
      label: 'Auditoría Exhibiciones',
      icon: 'M9 5h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 13l2 2 4-4',
      path: 'vendedor/auditoria',
      bgClass: 'bg-amber-500/10 border border-amber-500/20',
      iconClass: 'w-4 h-4 text-amber-600 dark:text-amber-400',
    },
  ];

  private sales: Venta[] = [];
  private ventasSub!: Subscription;
  private prestamosSub!: Subscription;

  isDarkMode = false;
  private mediaQueryList?: MediaQueryList;
  private themeListener?: (e: MediaQueryListEvent) => void;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private authService: AuthService,
    private salesService: SalesService,
    private prestamosService: PrestamosService,
    private metasService: MetasService,
    private aiConsejoService: AiConsejoService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.usuario = this.authService.getCurrentUser();
    this.hoyLabel = new Date().toLocaleDateString('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    this.mesActualLabel = new Date().toLocaleDateString('es-CO', {
      month: 'long',
      year: 'numeric',
    });

    if (isPlatformBrowser(this.platformId)) {
      this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
      this.isDarkMode = this.mediaQueryList.matches;
      this.themeListener = (e: MediaQueryListEvent) => {
        this.isDarkMode = e.matches;
        this.scheduleRender();
      };
      this.mediaQueryList.addEventListener('change', this.themeListener);
    }

    this.prestamosService.registrar();

    this.cargarVentasDelDia();
    this.listenToLoans();
    this.cargarMeta();
    this.listenToMensual();
    this.cargarConsejoIA();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.scheduleRender();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.renderRafId != null) cancelAnimationFrame(this.renderRafId);
    this.monthlyRadialInst?.destroy();
    this.weeklyBarInst?.destroy();
    this.prestamosService.desregistrar();
    this.ventasSub?.unsubscribe();
    this.prestamosSub?.unsubscribe();
    if (this.mediaQueryList && this.themeListener)
      this.mediaQueryList.removeEventListener('change', this.themeListener);
  }

  private renderRafId: number | null = null;

  private scheduleRender(): void {
    if (
      this.destroyed ||
      !this.viewReady ||
      !isPlatformBrowser(this.platformId)
    )
      return;

    this.cdr.markForCheck();

    if (this.renderRafId != null) cancelAnimationFrame(this.renderRafId);

    this.renderRafId = requestAnimationFrame(() => {
      this.renderRafId = null;
      if (this.destroyed) return;
      if (this.progresoMensual) {
        this.ngZone.runOutsideAngular(() => {
          this.renderMonthlyRadial();
          this.renderWeeklyBar();
        });
      }
    });
  }

  private get foreColor(): string {
    return this.isDarkMode ? '#d4d4d8' : '#44403c';
  }
  private get track(): string {
    return this.isDarkMode ? this.P.trackDark : this.P.trackLight;
  }
  private get bgChart(): string {
    return this.isDarkMode ? '#171717' : '#fafaf9';
  }

  private renderMonthlyRadial(): void {
    if (!this.monthlyRadialEl || !this.progresoMensual) return;

    const el = this.monthlyRadialEl.nativeElement;
    if (!el.isConnected) return;

    if (
      this.monthlyRadialInst &&
      !el.contains((this.monthlyRadialInst as any).el)
    ) {
      try {
        this.monthlyRadialInst.destroy();
      } catch {}
      this.monthlyRadialInst = undefined;
    }

    const pct = Math.min(
      Math.round(
        (this.progresoMensual.ventasMes / this.progresoMensual.metaMensual) *
          100,
      ),
      100,
    );
    const color = this.progresoMensual.cumplioMeta
      ? this.P.emerald
      : this.P.gold;

    const opts: ApexCharts.ApexOptions = {
      series: [pct],
      chart: {
        type: 'radialBar',
        height: 230,
        foreColor: this.foreColor,
        background: 'transparent',
        animations: { enabled: !this.monthlyRadialInst },
      },
      labels: ['Progreso del mes'],
      colors: [color],
      plotOptions: {
        radialBar: {
          hollow: { size: '55%' },
          track: { background: this.track, strokeWidth: '90%' },
          dataLabels: {
            name: { show: true, fontSize: '11px', color: this.foreColor },
            value: {
              fontSize: '26px',
              fontWeight: '800',
              color: this.foreColor,
              formatter: (v: number) => Math.round(v) + '%',
            },
          },
        },
      },
      stroke: { lineCap: 'round' },
      theme: { mode: this.isDarkMode ? 'dark' : 'light' },
    };

    try {
      if (this.monthlyRadialInst) {
        this.monthlyRadialInst.updateOptions(opts, true, false);
      } else {
        this.monthlyRadialInst = new ApexCharts(el, opts);
        this.monthlyRadialInst.render();
      }
    } catch (err) {
      console.error(
        'Error renderizando chart mensual, se recreará en el próximo intento:',
        err,
      );
      try {
        this.monthlyRadialInst?.destroy();
      } catch {}
      this.monthlyRadialInst = undefined;
    }
  }

  private renderWeeklyBar(): void {
    if (!this.weeklyBarEl || !this.progresoMensual) return;

    const el = this.weeklyBarEl.nativeElement;
    if (!el.isConnected) return;

    if (this.weeklyBarInst && !el.contains((this.weeklyBarInst as any).el)) {
      try {
        this.weeklyBarInst.destroy();
      } catch {}
      this.weeklyBarInst = undefined;
    }

    const semanas = this.progresoMensual.semanas;
    const opts: ApexCharts.ApexOptions = {
      series: [
        { name: 'Vendidos', data: semanas.map((s) => s.ventas) },
        { name: 'Meta', data: semanas.map((s) => s.meta) },
      ],
      chart: {
        type: 'bar',
        height: 260,
        foreColor: this.foreColor,
        toolbar: { show: false },
        background: 'transparent',
        animations: { enabled: !this.weeklyBarInst },
      },
      xaxis: {
        categories: semanas.map((s) => `Sem. ${s.numero}`),
        labels: { style: { fontSize: '11px' } },
      },
      yaxis: { labels: { style: { fontSize: '11px' } } },
      colors: [this.P.gold, this.isDarkMode ? '#3f3f46' : '#d6d3d1'],
      plotOptions: {
        bar: {
          borderRadius: 6,
          columnWidth: '55%',
          dataLabels: { position: 'top' },
        },
      },
      dataLabels: {
        enabled: true,
        offsetY: -18,
        style: { fontSize: '10px', colors: [this.foreColor] },
      },
      legend: {
        show: true,
        position: 'top',
        fontSize: '12px',
        fontWeight: '600',
        labels: { colors: this.foreColor },
      },
      grid: { borderColor: this.track, strokeDashArray: 4 },
      fill: { opacity: 1 },
      stroke: { show: false },
      tooltip: { y: { formatter: (v: number) => v + ' pares' } },
      theme: { mode: this.isDarkMode ? 'dark' : 'light' },
    };

    try {
      if (this.weeklyBarInst) {
        this.weeklyBarInst.updateOptions(opts, true, false);
      } else {
        this.weeklyBarInst = new ApexCharts(el, opts);
        this.weeklyBarInst.render();
      }
    } catch (err) {
      console.error(
        'Error renderizando chart semanal, se recreará en el próximo intento:',
        err,
      );
      try {
        this.weeklyBarInst?.destroy();
      } catch {}
      this.weeklyBarInst = undefined;
    }
  }

  private listenToMensual(): void {
    this.metasService.progresoMensual$.subscribe((progresos) => {
      if (this.destroyed) return;
      this.isLoadingMensual = false;
      this.progresoMensual = this.usuario?.id
        ? (progresos.find((p) => p.vendedorId === this.usuario.id) ?? null)
        : null;
      this.scheduleRender();
    });
  }

  private async cargarConsejoIA(): Promise<void> {
    if (!this.usuario?.name) {
      this.isLoadingConsejo = false;
      return;
    }
    this.isLoadingConsejo = true;
    try {
      const meta = this.progreso?.meta;
      this.consejo = await this.aiConsejoService.getConsejoDelDia(
        this.usuario.name,
        meta?.metaVentas,
        meta?.metaIngresos,
        this.progreso?.ventasActuales,
        this.progreso?.ingresosActuales,
      );
    } catch {
      this.consejo = null;
    } finally {
      if (this.destroyed) return;
      this.isLoadingConsejo = false;
      this.cdr.markForCheck();
    }
  }

  private async cargarMeta(): Promise<void> {
    if (!this.usuario) {
      this.isLoadingMeta = false;
      return;
    }
    this.isLoadingMeta = true;
    try {
      const progresos = await this.metasService.calcularProgreso();
      this.progreso =
        progresos.find(
          (p) =>
            p.vendedorId === this.usuario.id ||
            p.vendedor === this.usuario.name,
        ) ?? null;
    } catch (error) {
      console.error('Error cargando metas:', error);
      this.progreso = null;
    } finally {
      if (this.destroyed) return;
      this.isLoadingMeta = false;
      this.scheduleRender();
    }
  }

  private cargarVentasDelDia(): void {
    if (!this.usuario?.id) {
      this.resetearTotales();
      this.isLoading = false;
      return;
    }
    this.ventasSub = this.salesService.getVentasHoy$().subscribe({
      next: (ventas) => {
        if (this.destroyed) return;
        this.isLoading = false;
        if (!ventas?.length) {
          this.resetearTotales();
          this.scheduleRender();
          return;
        }
        this.sales = ventas.filter((v) => {
          const t = v.tipoVenta?.trim().toLowerCase();
          return (
            v.vendedorId === this.usuario.id &&
            t !== 'devuelto por bono' &&
            t !== 'devuelto por cambio'
          );
        });
        this.calcularTotales();
        this.scheduleRender();
      },
      error: () => {
        if (this.destroyed) return;
        this.isLoading = false;
        this.resetearTotales();
        this.cdr.markForCheck();
      },
    });
  }

  private listenToLoans(): void {
    if (!this.usuario) {
      this.isLoadingPrestamos = false;
      return;
    }
    this.prestamosSub = this.prestamosService
      .getPrestamosPorVendedor$(this.usuario.id)
      .subscribe((prestamos) => {
        if (this.destroyed) return;
        this.isLoadingPrestamos = false;
        this.prestamosPendientes = prestamos.length;
        this.cdr.markForCheck();
      });
  }

  private calcularTotales(): void {
    this.TotalSales = this.sales.reduce((a, v) => a + this.valorVenta(v), 0);
    this.zapatosVendidos = this.sales.filter((v) => {
      if (v.tipoVenta === 'Bono') return false;
      if (v.tipoVenta === 'Cambio' && !v.esMismoDia) return false;
      return true;
    }).length;
    this.efectivoTotal = this.sumMetodo('efectivo');
    this.transferenciaTotal = this.sumMetodo('transferencia');
    this.totalAddi = this.sumMetodo('addi');
    this.totalSistecredito = this.sumMetodo('sistecredito');
    this.totalBold = this.sumMetodo('bold');
  }

  private sumMetodo(m: string): number {
    return this.sales.reduce((a, v) => a + this.sumarMetodoPago(v, m), 0);
  }

  private valorVenta(v: Venta): number {
    if (v.tipoVenta === 'Cambio')
      return v.esMismoDia ? Number(v.precio || 0) : Number(v.excedente || 0);
    if (v.tipoVenta === 'Bono') return Number(v.excedente || 0);
    return Number(v.precio || 0);
  }

  private sumarMetodoPago(v: Venta, metodo: string): number {
    if (v.tipoVenta === 'Cambio' && !v.esMismoDia)
      return v.metodoExcedente === metodo ? Number(v.excedente || 0) : 0;
    let total = 0;
    if (v.precioMetodoPrincipal != null) {
      if (v.metodoPago === metodo) total += v.precioMetodoPrincipal;
    } else {
      if (v.metodoPago === metodo) total += v.precio;
    }
    if (v.segundoMetodo?.metodo === metodo) total += v.segundoMetodo.precio;
    if (
      v.tipoVenta === 'Cambio' &&
      v.esMismoDia &&
      v.excedente &&
      v.metodoExcedente === metodo
    )
      total += Number(v.excedente);
    return total;
  }

  private resetearTotales(): void {
    this.sales = [];
    this.TotalSales = 0;
    this.zapatosVendidos = 0;
    this.efectivoTotal = 0;
    this.transferenciaTotal = 0;
    this.totalAddi = 0;
    this.totalSistecredito = 0;
    this.totalBold = 0;
  }

  get metaPctVentas(): number {
    if (!this.progreso?.meta?.metaVentas) return 0;
    return Math.min(
      Math.round(
        (this.progreso.ventasActuales / this.progreso.meta.metaVentas) * 100,
      ),
      100,
    );
  }
  get metaPctIngresos(): number {
    if (!this.progreso?.meta?.metaIngresos) return 0;
    return Math.min(
      Math.round(
        (this.progreso.ingresosActuales / this.progreso.meta.metaIngresos) *
          100,
      ),
      100,
    );
  }
  get metaPctMensual(): number {
    return this.progresoMensual
      ? Math.min(this.progresoMensual.porcentaje, 100)
      : 0;
  }

  get metodosPago(): { label: string; value: number; bar: string }[] {
    return [
      { label: 'Efectivo', value: this.efectivoTotal, bar: 'bg-emerald-500' },
      {
        label: 'Transferencia',
        value: this.transferenciaTotal,
        bar: 'bg-sky-500',
      },
      {
        label: 'Sistecrédito',
        value: this.totalSistecredito,
        bar: 'bg-violet-500',
      },
      { label: 'Addi', value: this.totalAddi, bar: 'bg-amber-500' },
      { label: 'Bold', value: this.totalBold, bar: 'bg-neutral-500' },
    ];
  }

  min100(v: number): number {
    return Math.min(Math.max(v, 0), 100);
  }

  getPaymentPercentage(amount: number): string {
    return this.TotalSales === 0
      ? '0'
      : ((amount / this.TotalSales) * 100).toFixed(1);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  navigateToAction(path: string): void {
    this.router.navigate([path]);
  }
}
