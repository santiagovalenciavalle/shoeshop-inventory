import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../services/auth/auth.service';
import {
  MetasService,
  ProgresoVendedor,
  ProgresoMensualVendedor,
} from '../../../services/metas/metas.service';
import { User } from '../../interfaces';

@Component({
  selector: 'app-mis-metas',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      @keyframes fadeSlideUp {
        from {
          opacity: 0;
          transform: translateY(14px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes shimmer {
        0% {
          background-position: -200% center;
        }
        100% {
          background-position: 200% center;
        }
      }
      @keyframes spinRing {
        to {
          transform: rotate(360deg);
        }
      }
      @keyframes barGrow {
        from {
          width: 0;
        }
      }
      @keyframes confettiFall {
        0% {
          transform: translateY(-20px) rotate(0deg);
          opacity: 1;
        }
        100% {
          transform: translateY(100vh) rotate(720deg);
          opacity: 0;
        }
      }
      @keyframes celebPop {
        0% {
          transform: scale(0.6);
          opacity: 0;
        }
        60% {
          transform: scale(1.05);
        }
        100% {
          transform: scale(1);
          opacity: 1;
        }
      }
      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.4;
        }
      }
      @keyframes robotBlink {
        0%,
        90%,
        100% {
          transform: scaleY(1);
        }
        95% {
          transform: scaleY(0.1);
        }
      }
      @keyframes countUp {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .card-appear {
        animation: fadeSlideUp 0.4s cubic-bezier(0.22, 0.68, 0, 1.2) both;
      }
      .gold-shimmer {
        background: linear-gradient(
          90deg,
          #b8973a 0%,
          #e8c84a 30%,
          #f5e080 50%,
          #e8c84a 70%,
          #b8973a 100%
        );
        background-size: 200% auto;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: shimmer 3s linear infinite;
      }
      .spin-ring {
        width: 34px;
        height: 34px;
        border: 2px solid rgba(212, 175, 55, 0.15);
        border-top-color: #d4af37;
        border-radius: 9999px;
        animation: spinRing 0.8s linear infinite;
      }
      .btn-gold {
        background: linear-gradient(
          135deg,
          #c9a227 0%,
          #e8c84a 50%,
          #c9a227 100%
        );
        background-size: 200% auto;
        transition:
          background-position 0.4s ease,
          transform 0.15s ease,
          box-shadow 0.25s ease;
      }
      .btn-gold:hover:not(:disabled) {
        background-position: right center;
        box-shadow: 0 4px 20px rgba(212, 175, 55, 0.3);
        transform: translateY(-1px);
      }
      .btn-gold:active:not(:disabled) {
        transform: translateY(0);
      }
      .bar-anim {
        animation: barGrow 1s cubic-bezier(0.22, 0.68, 0, 1.2) both;
      }
      .confetti-piece {
        animation: confettiFall linear forwards;
      }
      .celeb-card {
        animation: celebPop 0.4s cubic-bezier(0.22, 0.68, 0, 1.2) both;
      }
      .ai-pulse {
        animation: pulse 2.5s ease-in-out infinite;
      }
      .count-anim {
        animation: countUp 0.5s cubic-bezier(0.22, 0.68, 0, 1.2) both;
      }
      .robot-eye {
        display: inline-block;
        animation: robotBlink 4s ease-in-out infinite;
        transform-origin: center;
      }
      .ring-track {
        fill: none;
        stroke-linecap: round;
        transition: stroke-dashoffset 1.2s cubic-bezier(0.22, 0.68, 0, 1.2);
      }
    `,
  ],
  template: `
    @if (mostrarCelebracion) {
      <div class="fixed inset-0 z-50 pointer-events-none overflow-hidden">
        @for (p of particulas; track p.id) {
          <div
            class="confetti-piece absolute w-2.5 h-2.5 rounded-sm"
            [style.left]="p.x + '%'"
            [style.top]="'-20px'"
            [style.background]="p.color"
            [style.transform]="'rotate(' + p.rot + 'deg)'"
            [style.animation-duration]="1.5 + p.delay / 500 + 's'"
            [style.animation-delay]="p.delay + 'ms'"
          ></div>
        }
        <div class="absolute inset-0 flex items-center justify-center px-6">
          <div
            class="celeb-card rounded-3xl p-8 text-center max-w-sm w-full
                       shadow-2xl shadow-yellow-500/20
                       bg-white dark:bg-neutral-900
                       border border-yellow-200 dark:border-yellow-700/50"
          >
            <div
              class="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center
                         bg-yellow-50 dark:bg-yellow-950/30
                         border-2 border-yellow-300 dark:border-yellow-600/50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="#d4af37"
                stroke="#b8973a"
                stroke-width="1"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path
                  d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"
                />
                <path
                  d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"
                />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
              </svg>
            </div>
            <h2
              class="text-xl font-black text-neutral-900 dark:text-white mb-2"
            >
              ¡Meta cumplida!
            </h2>
            <p
              class="text-sm leading-relaxed text-neutral-500 dark:text-neutral-400"
            >
              {{ usuario?.name }}, lograste tu meta de ventas esta semana 🎉
            </p>
          </div>
        </div>
      </div>
    }

    <div
      class="w-full bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white
                px-4 pt-8 pb-16 sm:px-6 lg:px-8"
    >
      <div class="mx-auto max-w-lg">
        <header class="mb-8 card-appear">
          <p
            class="text-xs font-semibold tracking-[.22em] uppercase
                     text-yellow-600 dark:text-yellow-600/70 mb-3"
          >
            Mi rendimiento &bull; Semana actual
          </p>
          <div class="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1
                class="text-3xl sm:text-4xl font-bold tracking-tight leading-tight
                          text-neutral-900 dark:text-white"
              >
                Mis <span class="gold-shimmer block sm:inline">Metas</span>
              </h1>
              @if (usuario) {
                <p
                  class="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-500"
                >
                  Hola,
                  <span
                    class="font-semibold text-neutral-700 dark:text-neutral-300"
                    >{{ usuario.name }}</span
                  >
                  @if (usuario.local) {
                    &nbsp;&middot;&nbsp; Local {{ usuario.local }}
                  }
                </p>
              }
            </div>
            <button
              (click)="actualizar()"
              [disabled]="cargando"
              aria-label="Actualizar"
              class="btn-gold w-9 h-9 rounded-xl flex items-center justify-center
                     text-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed
                     focus-visible:outline focus-visible:outline-2
                     focus-visible:outline-offset-2 focus-visible:outline-yellow-500"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                [class.animate-spin]="cargando"
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
            class="mt-6 h-px bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent"
          ></div>
        </header>

        <div
          class="card-appear mb-7 rounded-2xl overflow-hidden
                     border border-neutral-100 dark:border-neutral-800
                     bg-neutral-50 dark:bg-neutral-900"
        >
          <div class="flex items-start gap-4 p-4">
            <div
              class="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center
                         bg-neutral-900 dark:bg-neutral-800
                         border border-neutral-200 dark:border-neutral-700"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#d4af37"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="12" y1="2" x2="12" y2="5" />
                <circle cx="12" cy="2" r="1" fill="#d4af37" stroke="none" />
                <rect x="3" y="5" width="18" height="13" rx="3" />
                <rect
                  class="robot-eye"
                  x="7"
                  y="9"
                  width="3"
                  height="3"
                  rx="1"
                  fill="#d4af37"
                  stroke="none"
                />
                <rect
                  class="robot-eye"
                  x="14"
                  y="9"
                  width="3"
                  height="3"
                  rx="1"
                  fill="#d4af37"
                  stroke="none"
                />
                <line x1="8" y1="14" x2="16" y2="14" stroke-width="1.5" />
                <line x1="8" y1="18" x2="8" y2="21" />
                <line x1="16" y1="18" x2="16" y2="21" />
                <line x1="6" y1="21" x2="10" y2="21" />
                <line x1="14" y1="21" x2="18" y2="21" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <p
                  class="text-xs font-black uppercase tracking-widest text-neutral-900 dark:text-white"
                >
                  ShoeShop AI
                </p>
                <span
                  class="ai-pulse flex h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"
                ></span>
                <span
                  class="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
                  >En vivo</span
                >
              </div>
              <p
                class="text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-500"
              >
                Tu desempeño es monitoreado en tiempo real. Cada día se genera
                un análisis personalizado de tu progreso para ayudarte a cerrar
                la semana cumpliendo tu meta.
              </p>
            </div>
          </div>
          <div
            class="flex items-center justify-between px-4 py-2
                       border-t border-neutral-100 dark:border-neutral-800
                       bg-neutral-100/50 dark:bg-neutral-800/30"
          >
            <span
              class="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-600"
            >
              Monitoreado por la inteligencia artificial de ShoeShop
            </span>
            <span
              class="text-[10px] font-bold text-yellow-600 dark:text-yellow-600/80"
              >v2.0</span
            >
          </div>
        </div>

        @if (cargando) {
          <div class="flex flex-col items-center justify-center py-28 gap-5">
            <div class="spin-ring"></div>
            <p
              class="text-sm font-medium text-neutral-500 dark:text-neutral-400"
            >
              Calculando tu progreso…
            </p>
          </div>
        }

        @if (!cargando && !miProgreso) {
          <div
            class="card-appear flex flex-col items-center justify-center py-24 text-center gap-5"
          >
            <div
              class="w-20 h-20 rounded-full flex items-center justify-center
                         border border-yellow-200 dark:border-yellow-800/40
                         bg-yellow-50 dark:bg-yellow-950/20"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#d4af37"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <p class="text-lg font-bold text-neutral-800 dark:text-white">
                Sin meta asignada
              </p>
              <p
                class="text-sm mt-1.5 max-w-xs leading-relaxed text-neutral-500 dark:text-neutral-500"
              >
                Tu administrador aún no ha definido una meta para ti esta
                semana. Consulta con tu encargado.
              </p>
            </div>
            <div
              class="h-px w-24 bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent"
            ></div>
          </div>
        }

        @if (!cargando && miProgreso) {
          <div class="card-appear flex items-center gap-3 mb-5">
            <div class="h-px flex-1 bg-neutral-100 dark:bg-neutral-800"></div>
            <div
              class="flex items-center gap-2 px-3 py-1.5 rounded-full
                         bg-neutral-100 dark:bg-neutral-800
                         border border-neutral-200 dark:border-neutral-700"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#d4af37"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span
                class="text-[10px] font-black uppercase tracking-widest text-neutral-500 dark:text-neutral-400"
              >
                Meta Semanal
              </span>
            </div>
            <div class="h-px flex-1 bg-neutral-100 dark:bg-neutral-800"></div>
          </div>

          <div class="card-appear flex flex-col items-center mb-7">
            <div class="relative w-48 h-48">
              <svg viewBox="0 0 120 120" class="w-full h-full -rotate-90">
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke-width="8"
                  class="stroke-neutral-100 dark:stroke-neutral-800"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke-width="8"
                  stroke-linecap="round"
                  class="ring-track"
                  [attr.stroke]="
                    miProgreso.cumplioVentas ? '#10b981' : '#d4af37'
                  "
                  [attr.stroke-dasharray]="circumference"
                  [attr.stroke-dashoffset]="ringOffset"
                />
              </svg>
              <div
                class="absolute inset-0 flex flex-col items-center justify-center text-center"
              >
                <p
                  class="count-anim text-4xl font-black tabular-nums leading-none"
                  [class]="
                    miProgreso.cumplioVentas
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-yellow-500 dark:text-yellow-400'
                  "
                >
                  {{ miProgreso.porcentajeVentas }}%
                </p>
                <p
                  class="text-[10px] font-semibold uppercase tracking-widest mt-1
                            text-neutral-400 dark:text-neutral-600"
                >
                  completado
                </p>
              </div>
            </div>
            <p
              class="mt-3 text-sm font-semibold text-neutral-600 dark:text-neutral-400"
            >
              {{ miProgreso.ventasActuales }} de
              {{ miProgreso.meta.metaVentas }} pares vendidos
            </p>
            @if (miProgreso.cumplioVentas) {
              <span
                class="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                ¡Meta de la semana cumplida!
              </span>
            }
          </div>

          <div class="card-appear grid grid-cols-3 gap-3 mb-7">
            <div
              class="relative overflow-hidden rounded-2xl text-center p-4
                         border border-neutral-100 dark:border-neutral-800
                         bg-neutral-50 dark:bg-neutral-900"
            >
              <div
                class="absolute inset-x-0 top-0 h-px
                           bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent"
              ></div>
              <p
                class="text-2xl font-black tabular-nums leading-none text-neutral-900 dark:text-white"
              >
                {{ miProgreso.ventasActuales }}
              </p>
              <p
                class="mt-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-600"
              >
                Ventas
              </p>
            </div>
            <div
              class="relative overflow-hidden rounded-2xl text-center p-4
                         border border-yellow-200 dark:border-yellow-800/40
                         bg-yellow-50 dark:bg-yellow-950/20"
            >
              <div
                class="absolute inset-x-0 top-0 h-px
                           bg-gradient-to-r from-transparent via-yellow-400/70 to-transparent"
              ></div>
              <p
                class="text-2xl font-black tabular-nums leading-none text-yellow-600 dark:text-yellow-400"
              >
                {{ miProgreso.meta.metaVentas }}
              </p>
              <p
                class="mt-1.5 text-[10px] font-semibold uppercase tracking-widest text-yellow-600 dark:text-yellow-600/70"
              >
                Meta
              </p>
            </div>
            <div
              class="relative overflow-hidden rounded-2xl text-center p-4"
              [class]="
                miProgreso.cumplioVentas
                  ? 'border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20'
                  : 'border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900'
              "
            >
              <div
                class="absolute inset-x-0 top-0 h-px"
                [class]="
                  miProgreso.cumplioVentas
                    ? 'bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent'
                    : 'bg-gradient-to-r from-transparent via-neutral-300/50 dark:via-neutral-700/50 to-transparent'
                "
              ></div>
              <p
                class="text-2xl font-black tabular-nums leading-none"
                [class]="
                  miProgreso.cumplioVentas
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-neutral-500 dark:text-neutral-400'
                "
              >
                {{
                  miProgreso.cumplioVentas
                    ? '+' +
                      (miProgreso.ventasActuales - miProgreso.meta.metaVentas)
                    : miProgreso.meta.metaVentas - miProgreso.ventasActuales
                }}
              </p>
              <p
                class="mt-1.5 text-[10px] font-semibold uppercase tracking-widest"
                [class]="
                  miProgreso.cumplioVentas
                    ? 'text-emerald-600 dark:text-emerald-600/70'
                    : 'text-neutral-400 dark:text-neutral-600'
                "
              >
                {{ miProgreso.cumplioVentas ? 'Extra' : 'Faltan' }}
              </p>
            </div>
          </div>

          <div
            class="card-appear rounded-2xl p-5 mb-7
                       border border-neutral-100 dark:border-neutral-800
                       bg-white dark:bg-neutral-900"
          >
            <div class="flex items-center justify-between mb-4">
              <p
                class="text-xs font-black uppercase tracking-widest text-neutral-900 dark:text-white"
              >
                Progreso semanal
              </p>
              <span
                class="text-xs font-bold"
                [class]="
                  miProgreso.cumplioVentas
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-yellow-600 dark:text-yellow-400'
                "
              >
                {{ miProgreso.porcentajeVentas }}%
              </span>
            </div>
            <div
              class="h-3 rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-800 mb-2"
            >
              <div
                class="bar-anim h-full rounded-full"
                [class]="
                  miProgreso.cumplioVentas
                    ? 'bg-emerald-500 dark:bg-emerald-400'
                    : 'bg-yellow-400 dark:bg-yellow-500'
                "
                [style.width]="
                  (miProgreso.porcentajeVentas > 100
                    ? 100
                    : miProgreso.porcentajeVentas) + '%'
                "
              ></div>
            </div>
            <div class="flex justify-between">
              <span class="text-[10px] text-neutral-400 dark:text-neutral-600"
                >0 pares</span
              >
              <span class="text-[10px] text-neutral-400 dark:text-neutral-600"
                >Meta: {{ miProgreso.meta.metaVentas }} pares</span
              >
            </div>
            <div
              class="mt-4 flex items-center gap-3 rounded-xl px-4 py-3"
              [class]="
                miProgreso.cumplioVentas
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40'
                  : 'bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700'
              "
            >
              @if (miProgreso.cumplioVentas) {
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#10b981"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="flex-shrink-0"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <p
                  class="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400"
                >
                  ¡Excelente semana! Superaste tu meta. Sigue así.
                </p>
              } @else {
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#d4af37"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="flex-shrink-0"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <p
                  class="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400"
                >
                  Te faltan
                  <span class="text-neutral-900 dark:text-white font-black">{{
                    miProgreso.meta.metaVentas - miProgreso.ventasActuales
                  }}</span>
                  pares para cumplir tu meta esta semana.
                </p>
              }
            </div>
          </div>

          @if (esSabado) {
            <div
              class="card-appear rounded-2xl overflow-hidden mb-7 border"
              [class]="
                miProgreso.cumplioVentas
                  ? 'border-yellow-200 dark:border-yellow-800/40'
                  : 'border-red-200 dark:border-red-900/40'
              "
            >
              <div
                class="px-5 pt-5 pb-3"
                [class]="
                  miProgreso.cumplioVentas
                    ? 'bg-yellow-50 dark:bg-yellow-950/20'
                    : 'bg-red-50 dark:bg-red-950/15'
                "
              >
                <p
                  class="text-[10px] font-semibold uppercase tracking-widest mb-1"
                  [class]="
                    miProgreso.cumplioVentas
                      ? 'text-yellow-600 dark:text-yellow-600/70'
                      : 'text-red-500 dark:text-red-400'
                  "
                >
                  Cierre de semana · Hoy es sábado
                </p>
                <h3
                  class="text-base font-black text-neutral-900 dark:text-white"
                >
                  {{
                    miProgreso.cumplioVentas
                      ? '¡Cerraste la semana cumpliendo tu meta!'
                      : 'Cerraste la semana sin alcanzar la meta'
                  }}
                </h3>
              </div>
              <div
                class="px-5 py-4 bg-white dark:bg-neutral-900 border-t"
                [class]="
                  miProgreso.cumplioVentas
                    ? 'border-yellow-100 dark:border-yellow-800/30'
                    : 'border-red-100 dark:border-red-900/30'
                "
              >
                <p
                  class="text-sm leading-relaxed text-neutral-500 dark:text-neutral-400"
                >
                  {{
                    miProgreso.cumplioVentas
                      ? 'Vendiste ' +
                        miProgreso.ventasActuales +
                        ' pares de ' +
                        miProgreso.meta.metaVentas +
                        ' requeridos. Excelente desempeño esta semana. El sistema de IA de ShoeShop registró tu resultado.'
                      : 'Vendiste ' +
                        miProgreso.ventasActuales +
                        ' pares de ' +
                        miProgreso.meta.metaVentas +
                        ' requeridos. La semana próxima es una nueva oportunidad. El equipo de ShoeShop confía en ti.'
                  }}
                </p>
              </div>
            </div>
          }

          @if (miProgresoMensual) {
            <div class="card-appear flex items-center gap-3 mb-5 mt-2">
              <div class="h-px flex-1 bg-neutral-100 dark:bg-neutral-800"></div>
              <div
                class="flex items-center gap-2 px-3 py-1.5 rounded-full
                           bg-yellow-50 dark:bg-yellow-950/20
                           border border-yellow-200 dark:border-yellow-800/40"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#d4af37"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M8 2v4M16 2v4M3 10h18M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
                  />
                </svg>
                <span
                  class="text-[10px] font-black uppercase tracking-widest text-yellow-600 dark:text-yellow-500"
                >
                  Meta Mensual · {{ mesActualLabel }}
                </span>
              </div>
              <div class="h-px flex-1 bg-neutral-100 dark:bg-neutral-800"></div>
            </div>

            <div class="card-appear flex flex-col items-center mb-7">
              <div class="relative w-44 h-44">
                <svg viewBox="0 0 120 120" class="w-full h-full -rotate-90">
                  <circle
                    cx="60"
                    cy="60"
                    r="54"
                    fill="none"
                    stroke-width="1"
                    class="stroke-yellow-200/40 dark:stroke-yellow-800/20"
                    stroke-dasharray="4 6"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke-width="8"
                    class="stroke-neutral-100 dark:stroke-neutral-800"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke-width="8"
                    stroke-linecap="round"
                    class="ring-track"
                    [attr.stroke]="
                      miProgresoMensual.cumplioMeta ? '#10b981' : '#c9a227'
                    "
                    [attr.stroke-dasharray]="circumference"
                    [attr.stroke-dashoffset]="ringOffsetMensual"
                  />
                </svg>
                <div
                  class="absolute inset-0 flex flex-col items-center justify-center text-center"
                >
                  <p
                    class="count-anim text-3xl font-black tabular-nums leading-none"
                    [class]="
                      miProgresoMensual.cumplioMeta
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-yellow-600 dark:text-yellow-400'
                    "
                  >
                    {{ miProgresoMensual.porcentaje }}%
                  </p>
                  <p
                    class="text-[10px] font-semibold uppercase tracking-widest mt-1
                              text-neutral-400 dark:text-neutral-600"
                  >
                    del mes
                  </p>
                </div>
              </div>
              <p
                class="mt-3 text-sm font-semibold text-neutral-600 dark:text-neutral-400"
              >
                {{ miProgresoMensual.ventasMes }} de
                {{ miProgresoMensual.metaMensual }} pares este mes
              </p>
              @if (miProgresoMensual.cumplioMeta) {
                <span
                  class="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  ¡Meta del mes cumplida!
                </span>
              }
            </div>

            <div class="card-appear grid grid-cols-3 gap-3 mb-7">
              <div
                class="relative overflow-hidden rounded-2xl text-center p-4
                           border border-neutral-100 dark:border-neutral-800
                           bg-neutral-50 dark:bg-neutral-900"
              >
                <div
                  class="absolute inset-x-0 top-0 h-px
                             bg-gradient-to-r from-transparent via-yellow-400/40 to-transparent"
                ></div>
                <p
                  class="text-2xl font-black tabular-nums leading-none text-neutral-900 dark:text-white"
                >
                  {{ miProgresoMensual.ventasMes }}
                </p>
                <p
                  class="mt-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-600"
                >
                  Este mes
                </p>
              </div>
              <div
                class="relative overflow-hidden rounded-2xl text-center p-4
                           border border-yellow-200 dark:border-yellow-800/40
                           bg-yellow-50 dark:bg-yellow-950/20"
              >
                <div
                  class="absolute inset-x-0 top-0 h-px
                             bg-gradient-to-r from-transparent via-yellow-400/70 to-transparent"
                ></div>
                <p
                  class="text-2xl font-black tabular-nums leading-none text-yellow-600 dark:text-yellow-400"
                >
                  {{ miProgresoMensual.metaMensual }}
                </p>
                <p
                  class="mt-1.5 text-[10px] font-semibold uppercase tracking-widest text-yellow-600 dark:text-yellow-600/70"
                >
                  Meta mes
                </p>
              </div>
              <div
                class="relative overflow-hidden rounded-2xl text-center p-4"
                [class]="
                  miProgresoMensual.cumplioMeta
                    ? 'border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20'
                    : 'border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900'
                "
              >
                <div
                  class="absolute inset-x-0 top-0 h-px"
                  [class]="
                    miProgresoMensual.cumplioMeta
                      ? 'bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent'
                      : 'bg-gradient-to-r from-transparent via-neutral-300/50 dark:via-neutral-700/50 to-transparent'
                  "
                ></div>
                <p
                  class="text-2xl font-black tabular-nums leading-none"
                  [class]="
                    miProgresoMensual.cumplioMeta
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-neutral-500 dark:text-neutral-400'
                  "
                >
                  {{
                    miProgresoMensual.cumplioMeta
                      ? '+' +
                        (miProgresoMensual.ventasMes -
                          miProgresoMensual.metaMensual)
                      : miProgresoMensual.metaMensual -
                        miProgresoMensual.ventasMes
                  }}
                </p>
                <p
                  class="mt-1.5 text-[10px] font-semibold uppercase tracking-widest"
                  [class]="
                    miProgresoMensual.cumplioMeta
                      ? 'text-emerald-600 dark:text-emerald-600/70'
                      : 'text-neutral-400 dark:text-neutral-600'
                  "
                >
                  {{ miProgresoMensual.cumplioMeta ? 'Extra' : 'Faltan' }}
                </p>
              </div>
            </div>

            <div
              class="card-appear rounded-2xl p-5 mb-7
                         border border-neutral-100 dark:border-neutral-800
                         bg-white dark:bg-neutral-900"
            >
              <div class="flex items-center justify-between mb-4">
                <p
                  class="text-xs font-black uppercase tracking-widest text-neutral-900 dark:text-white"
                >
                  Progreso mensual
                </p>
                <span
                  class="text-xs font-bold"
                  [class]="
                    miProgresoMensual.cumplioMeta
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-yellow-600 dark:text-yellow-400'
                  "
                >
                  {{ miProgresoMensual.porcentaje }}%
                </span>
              </div>

              <div
                class="h-3 rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-800 mb-2"
              >
                <div
                  class="bar-anim h-full rounded-full"
                  [class]="
                    miProgresoMensual.cumplioMeta
                      ? 'bg-emerald-500 dark:bg-emerald-400'
                      : 'bg-yellow-400 dark:bg-yellow-500'
                  "
                  [style.width]="
                    (miProgresoMensual.porcentaje > 100
                      ? 100
                      : miProgresoMensual.porcentaje) + '%'
                  "
                ></div>
              </div>
              <div class="flex justify-between mb-5">
                <span class="text-[10px] text-neutral-400 dark:text-neutral-600"
                  >0 pares</span
                >
                <span class="text-[10px] text-neutral-400 dark:text-neutral-600"
                  >Meta: {{ miProgresoMensual.metaMensual }} pares</span
                >
              </div>

              <div
                class="border-t border-neutral-100 dark:border-neutral-800 pt-4"
              >
                <p
                  class="text-[10px] font-semibold uppercase tracking-widest mb-3 text-neutral-400 dark:text-neutral-600"
                >
                  Desglose por semana
                </p>
                <div class="space-y-2.5">
                  @for (sem of miProgresoMensual.semanas; track sem.numero) {
                    <div class="flex items-center gap-3">
                      <span
                        class="text-[10px] font-semibold text-neutral-400 dark:text-neutral-600 w-14 flex-shrink-0"
                      >
                        Sem. {{ sem.numero }}
                      </span>
                      <div
                        class="flex-1 h-2 rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-800"
                      >
                        <div
                          class="h-full rounded-full transition-all duration-700"
                          [class]="
                            sem.cumplida
                              ? 'bg-emerald-400 dark:bg-emerald-500'
                              : sem.esActual
                                ? 'bg-yellow-400 dark:bg-yellow-500'
                                : 'bg-neutral-300 dark:bg-neutral-700'
                          "
                          [style.width]="
                            (sem.porcentaje > 100 ? 100 : sem.porcentaje) + '%'
                          "
                        ></div>
                      </div>
                      <div
                        class="flex items-center gap-1.5 w-20 flex-shrink-0 justify-end"
                      >
                        <span
                          class="text-[10px] font-bold tabular-nums"
                          [class]="
                            sem.cumplida
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : sem.esActual
                                ? 'text-yellow-600 dark:text-yellow-400'
                                : 'text-neutral-400 dark:text-neutral-600'
                          "
                        >
                          {{ sem.ventas }}/{{ sem.meta }}
                        </span>
                        @if (sem.cumplida) {
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="9"
                            height="9"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#10b981"
                            stroke-width="3"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        } @else if (sem.esActual) {
                          <span
                            class="ai-pulse flex h-1.5 w-1.5 rounded-full bg-yellow-400 dark:bg-yellow-500"
                          ></span>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>

              <div
                class="mt-4 flex items-center gap-3 rounded-xl px-4 py-3"
                [class]="
                  miProgresoMensual.cumplioMeta
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40'
                    : 'bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700'
                "
              >
                @if (miProgresoMensual.cumplioMeta) {
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#10b981"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="flex-shrink-0"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <p
                    class="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400"
                  >
                    ¡Increíble! Cumpliste tu meta del mes. Eres el mejor
                    vendedor del equipo.
                  </p>
                } @else {
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#d4af37"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="flex-shrink-0"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <p
                    class="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400"
                  >
                    Te faltan
                    <span class="text-neutral-900 dark:text-white font-black">
                      {{
                        miProgresoMensual.metaMensual -
                          miProgresoMensual.ventasMes
                      }}
                    </span>
                    pares para cumplir tu meta del mes.
                  </p>
                }
              </div>
            </div>
          }

          <div class="card-appear flex items-center justify-center gap-2">
            <div
              class="h-px flex-1 bg-gradient-to-r from-transparent to-neutral-200 dark:to-neutral-800"
            ></div>
            <span
              class="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-600"
            >
              Semana del {{ semanaLabel }}
            </span>
            <div
              class="h-px flex-1 bg-gradient-to-l from-transparent to-neutral-200 dark:to-neutral-800"
            ></div>
          </div>
        }
      </div>
    </div>
  `,
})
export class MisMetasComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private metasService = inject(MetasService);
  private cdr = inject(ChangeDetectorRef);

  usuario: User | null = null;
  miProgreso: ProgresoVendedor | null = null;
  miProgresoMensual: ProgresoMensualVendedor | null = null;
  cargando = false;
  semanaLabel = '';
  mesActualLabel = '';

  mostrarCelebracion = false;
  particulas: any[] = [];
  private yaCelebrado = false;

  private subs = new Subscription();

  readonly circumference = 2 * Math.PI * 50;

  get ringOffset(): number {
    if (!this.miProgreso) return this.circumference;
    const pct = Math.min(this.miProgreso.porcentajeVentas, 100) / 100;
    return this.circumference * (1 - pct);
  }

  get ringOffsetMensual(): number {
    if (!this.miProgresoMensual) return this.circumference;
    const pct = Math.min(this.miProgresoMensual.porcentaje, 100) / 100;
    return this.circumference * (1 - pct);
  }

  get esSabado(): boolean {
    return new Date().getDay() === 6;
  }

  ngOnInit(): void {
    this.usuario = this.authService.getCurrentUser();

    const inicio = this.metasService.getSemanaActualInicio();
    const fin = this.metasService.getSemanaActualFin();
    this.semanaLabel = `${inicio.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} - ${fin.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`;

    const ahora = new Date();
    this.mesActualLabel = ahora.toLocaleDateString('es-CO', {
      month: 'long',
      year: 'numeric',
    });

    this.subs.add(
      this.metasService.cargando$.subscribe((c) => {
        this.cargando = c;
        this.cdr.markForCheck();
      }),
    );

    this.subs.add(
      this.metasService.progreso$.subscribe((progresos) => {
        const miId = this.usuario?.id;
        this.miProgreso = miId
          ? (progresos.find((p) => p.vendedorId === miId) ?? null)
          : null;

        if (this.miProgreso?.cumplioVentas && !this.yaCelebrado) {
          this.yaCelebrado = true;
          this.lanzarCelebracion();
        }

        this.cdr.markForCheck();
      }),
    );

    this.subs.add(
      this.metasService.progresoMensual$.subscribe((progresosMensuales) => {
        const miId = this.usuario?.id;
        this.miProgresoMensual = miId
          ? (progresosMensuales.find((p) => p.vendedorId === miId) ?? null)
          : null;
        this.cdr.markForCheck();
      }),
    );

    this.actualizar();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  async actualizar(): Promise<void> {
    await this.metasService.calcularProgreso();
  }

  private lanzarCelebracion(): void {
    const colores = [
      '#d4af37',
      '#e8c84a',
      '#f5e080',
      '#10b981',
      '#3b82f6',
      '#ef4444',
    ];
    this.particulas = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: colores[Math.floor(Math.random() * colores.length)],
      rot: Math.random() * 360,
      delay: Math.random() * 600,
    }));
    this.mostrarCelebracion = true;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.mostrarCelebracion = false;
      this.particulas = [];
      this.cdr.markForCheck();
    }, 4500);
  }
}
