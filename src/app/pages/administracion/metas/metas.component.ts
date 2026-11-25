import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { UsuarioService } from '../../../services/administracion/usuarios/usuario.service';
import {
  MetasService,
  ProgresoVendedor,
  ProgresoMensualVendedor,
} from '../../../services/metas/metas.service';
import { User } from '../../interfaces';

@Component({
  selector: 'app-metas',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
          opacity: 0.5;
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

      .card-appear {
        animation: fadeSlideUp 0.4s cubic-bezier(0.22, 0.68, 0, 1.2) both;
      }
      .card-appear:nth-child(1) {
        animation-delay: 0.04s;
      }
      .card-appear:nth-child(2) {
        animation-delay: 0.09s;
      }
      .card-appear:nth-child(3) {
        animation-delay: 0.14s;
      }
      .card-appear:nth-child(4) {
        animation-delay: 0.19s;
      }
      .card-appear:nth-child(5) {
        animation-delay: 0.24s;
      }
      .card-appear:nth-child(6) {
        animation-delay: 0.29s;
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
        animation: barGrow 0.8s cubic-bezier(0.22, 0.68, 0, 1.2) both;
      }
      .confetti-piece {
        animation: confettiFall linear forwards;
      }
      .celeb-card {
        animation: celebPop 0.4s cubic-bezier(0.22, 0.68, 0, 1.2) both;
      }
      .form-panel {
        animation: fadeSlideUp 0.3s cubic-bezier(0.22, 0.68, 0, 1.2) both;
      }
      .vendor-card {
        transition:
          transform 0.2s cubic-bezier(0.22, 0.68, 0, 1.2),
          box-shadow 0.2s ease;
      }
      .vendor-card:hover {
        transform: translateY(-2px);
      }
      .input-field {
        transition:
          border-color 0.15s ease,
          box-shadow 0.15s ease;
      }
      .input-field:focus {
        box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.15);
      }
      .ai-pulse {
        animation: pulse 2.5s ease-in-out infinite;
      }
      .robot-eye {
        display: inline-block;
        animation: robotBlink 4s ease-in-out infinite;
        transform-origin: center;
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
                      shadow-2xl shadow-yellow-500/20 bg-white dark:bg-neutral-900
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
              ¡Meta{{
                vendedoresCelebrados.length > 1 ? 's cumplidas!' : ' cumplida!'
              }}
            </h2>
            <p
              class="text-sm leading-relaxed text-neutral-500 dark:text-neutral-400"
            >
              {{ celebracionMensaje }}
            </p>
          </div>
        </div>
      </div>
    }

    <div
      class="w-full bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white
                px-4 pt-8 pb-16 sm:px-6 lg:px-8"
    >
      <div class="mx-auto max-w-2xl">
        <header class="mb-8">
          <p
            class="text-xs font-semibold tracking-[.22em] uppercase
                     text-yellow-600 dark:text-yellow-600/70 mb-3"
          >
            Equipo &bull; Seguimiento Semanal
          </p>
          <div class="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1
                class="text-3xl sm:text-4xl font-bold tracking-tight leading-tight
                          text-neutral-900 dark:text-white"
              >
                Metas
                <span class="gold-shimmer block sm:inline">Semanales</span>
              </h1>
              <p
                class="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-500"
              >
                Semana del {{ semanaLabel }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <button
                (click)="actualizar()"
                [disabled]="cargando"
                aria-label="Actualizar metas"
                class="btn-gold w-9 h-9 rounded-xl flex items-center justify-center
                       text-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed
                       focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-500"
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
              <button
                (click)="abrirNuevaMeta()"
                class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold
                       tracking-wide transition
                       focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-500"
                [class]="
                  mostrarForm && !editando
                    ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700'
                    : 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100'
                "
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  @if (mostrarForm && !editando) {
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  } @else {
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  }
                </svg>
                {{ mostrarForm && !editando ? 'Cerrar' : 'Nueva meta' }}
              </button>
            </div>
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
                Las metas se guardan una sola vez por vendedor y se renuevan
                automáticamente cada semana. Solo edítalas cuando necesites
                cambiar los objetivos.
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

        @if (esSabado && progresos.length > 0) {
          <div
            class="card-appear mb-7 rounded-2xl overflow-hidden
                      border border-yellow-200 dark:border-yellow-800/40"
          >
            <div class="px-5 pt-5 pb-3 bg-yellow-50 dark:bg-yellow-950/20">
              <p
                class="text-[10px] font-semibold uppercase tracking-widest mb-1 text-yellow-600 dark:text-yellow-600/70"
              >
                Cierre de semana · Hoy es sábado
              </p>
              <h3 class="text-base font-black text-neutral-900 dark:text-white">
                Resultado final de la semana
              </h3>
            </div>
            <div
              class="grid grid-cols-2 divide-x divide-neutral-100 dark:divide-neutral-800
                        border-t border-neutral-100 dark:border-neutral-800"
            >
              <div class="p-4 bg-white dark:bg-neutral-900">
                <p
                  class="text-[10px] font-semibold uppercase tracking-widest mb-2 text-emerald-600 dark:text-emerald-400"
                >
                  ✓ Cumplieron
                </p>
                @if (vendedoresCumplieron.length === 0) {
                  <p
                    class="text-xs text-neutral-400 dark:text-neutral-600 italic"
                  >
                    Ninguno aún
                  </p>
                }
                @for (v of vendedoresCumplieron; track v.vendedorId) {
                  <div class="flex items-center gap-2 mb-1.5">
                    <div
                      class="w-6 h-6 rounded-lg flex items-center justify-center
                                text-[10px] font-black text-neutral-900
                                bg-yellow-400 dark:bg-yellow-500 flex-shrink-0"
                    >
                      {{ v.vendedor.charAt(0).toUpperCase() }}
                    </div>
                    <span
                      class="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate"
                    >
                      {{ v.vendedor }}
                    </span>
                  </div>
                }
              </div>
              <div class="p-4 bg-white dark:bg-neutral-900">
                <p
                  class="text-[10px] font-semibold uppercase tracking-widest mb-2 text-red-500 dark:text-red-400"
                >
                  ✗ Pendientes
                </p>
                @if (vendedoresNoCumplieron.length === 0) {
                  <p
                    class="text-xs text-neutral-400 dark:text-neutral-600 italic"
                  >
                    ¡Todos cumplieron!
                  </p>
                }
                @for (v of vendedoresNoCumplieron; track v.vendedorId) {
                  <div class="flex items-center gap-2 mb-1.5">
                    <div
                      class="w-6 h-6 rounded-lg flex items-center justify-center
                                text-[10px] font-black text-white
                                bg-neutral-400 dark:bg-neutral-600 flex-shrink-0"
                    >
                      {{ v.vendedor.charAt(0).toUpperCase() }}
                    </div>
                    <span
                      class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 truncate"
                    >
                      {{ v.vendedor }}
                    </span>
                  </div>
                }
              </div>
            </div>
          </div>
        }

        @if (mostrarForm) {
          <div
            class="form-panel rounded-2xl mb-8 overflow-hidden
                      border border-neutral-200 dark:border-neutral-800
                      bg-neutral-50 dark:bg-neutral-900"
          >
            <div
              class="px-5 pt-5 pb-4 border-b border-neutral-100 dark:border-neutral-800"
            >
              <p
                class="text-[10px] font-semibold uppercase tracking-widest text-yellow-600 dark:text-yellow-600/70 mb-0.5"
              >
                {{ editando ? 'Editar' : 'Configurar' }}
              </p>
              <h3 class="text-sm font-bold text-neutral-900 dark:text-white">
                {{
                  editando
                    ? 'Actualizar metas de ' + formVendedorNombre
                    : 'Definir metas para un vendedor'
                }}
              </h3>
              @if (editando) {
                <p
                  class="text-[11px] mt-1 text-neutral-400 dark:text-neutral-500"
                >
                  La meta actualizada se aplicará desde esta semana en adelante
                  automáticamente.
                </p>
              }
            </div>
            <div class="p-5 space-y-4">
              <div>
                <label
                  class="text-[10px] font-semibold uppercase tracking-widest mb-2 block
                              text-neutral-400 dark:text-neutral-600"
                >
                  Vendedor
                </label>
                @if (editando) {
                  <div
                    class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl
                              bg-neutral-100 dark:bg-neutral-800
                              border border-neutral-200 dark:border-neutral-700"
                  >
                    <div
                      class="w-7 h-7 rounded-lg flex items-center justify-center
                                text-xs font-black text-neutral-900 bg-yellow-400 dark:bg-yellow-500 flex-shrink-0"
                    >
                      {{ formVendedorNombre.charAt(0).toUpperCase() }}
                    </div>
                    <span
                      class="text-sm font-semibold text-neutral-800 dark:text-white"
                    >
                      {{ formVendedorNombre }}
                    </span>
                    <span
                      class="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full
                                 bg-yellow-100 dark:bg-yellow-900/30
                                 text-yellow-700 dark:text-yellow-400
                                 border border-yellow-200 dark:border-yellow-800/40"
                    >
                      Editando
                    </span>
                  </div>
                } @else {
                  <select
                    [(ngModel)]="formVendedorId"
                    (change)="onVendedorChange()"
                    class="input-field w-full px-3.5 py-2.5 rounded-xl text-sm
                           bg-white dark:bg-neutral-800
                           border border-neutral-200 dark:border-neutral-700
                           text-neutral-800 dark:text-white
                           focus:outline-none focus:border-yellow-400 dark:focus:border-yellow-500
                           cursor-pointer"
                  >
                    <option value="">Seleccionar vendedor…</option>
                    @for (v of vendedoresSinMeta; track v.id) {
                      <option [value]="v.id">{{ v.name }}</option>
                    }
                  </select>
                  @if (
                    vendedoresSinMeta.length === 0 && vendedores.length > 0
                  ) {
                    <p
                      class="mt-1.5 text-[11px] text-emerald-600 dark:text-emerald-400"
                    >
                      ✓ Todos los vendedores ya tienen meta asignada. Usa
                      "Editar" en cada card para modificarlas.
                    </p>
                  }
                }
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    class="text-[10px] font-semibold uppercase tracking-widest mb-2 block
                                text-neutral-400 dark:text-neutral-600"
                  >
                    Meta semanal (pares)
                  </label>
                  <input
                    type="number"
                    [(ngModel)]="formMetaVentas"
                    (ngModelChange)="sugerirMensual()"
                    min="1"
                    placeholder="Ej: 15"
                    class="input-field w-full px-3.5 py-2.5 rounded-xl text-sm
                           bg-white dark:bg-neutral-800
                           border border-neutral-200 dark:border-neutral-700
                           text-neutral-800 dark:text-white
                           placeholder-neutral-300 dark:placeholder-neutral-600
                           focus:outline-none focus:border-yellow-400 dark:focus:border-yellow-500"
                  />
                </div>
                <div>
                  <label
                    class="text-[10px] font-semibold uppercase tracking-widest mb-2 block
                                text-yellow-600 dark:text-yellow-600/70"
                  >
                    Meta mensual (pares)
                  </label>
                  <input
                    type="number"
                    [(ngModel)]="formMetaMensual"
                    min="1"
                    placeholder="Ej: 60"
                    class="input-field w-full px-3.5 py-2.5 rounded-xl text-sm
                           bg-yellow-50 dark:bg-yellow-950/20
                           border border-yellow-200 dark:border-yellow-800/40
                           text-neutral-800 dark:text-white
                           placeholder-yellow-300 dark:placeholder-yellow-800
                           focus:outline-none focus:border-yellow-400 dark:focus:border-yellow-500"
                  />
                  <p
                    class="mt-1.5 text-[10px] text-neutral-400 dark:text-neutral-600"
                  >
                    Sugerido: {{ formMetaVentas * 4 || 0 }} pares (4 semanas)
                  </p>
                </div>
              </div>

              <div class="flex gap-3 pt-1">
                <button
                  (click)="guardarMeta()"
                  [disabled]="
                    (!editando && !formVendedorId) ||
                    !formMetaVentas ||
                    !formMetaMensual ||
                    guardando
                  "
                  class="btn-gold flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wide
                         text-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed
                         focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-500"
                >
                  {{
                    guardando
                      ? 'Guardando…'
                      : editando
                        ? 'Actualizar metas'
                        : 'Guardar metas'
                  }}
                </button>
                <button
                  (click)="cerrarFormulario()"
                  class="px-4 py-2.5 rounded-xl text-xs font-semibold transition
                         bg-neutral-100 dark:bg-neutral-800
                         border border-neutral-200 dark:border-neutral-700
                         text-neutral-500 dark:text-neutral-400
                         hover:bg-neutral-200 dark:hover:bg-neutral-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        }

        @if (cargando && progresos.length === 0) {
          <div class="flex flex-col items-center justify-center py-28 gap-5">
            <div class="spin-ring"></div>
            <p
              class="text-sm font-medium text-neutral-500 dark:text-neutral-400"
            >
              Calculando progreso…
            </p>
          </div>
        }

        @if (!cargando && progresos.length === 0) {
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
                Sin metas configuradas
              </p>
              <p
                class="text-sm mt-1.5 max-w-xs leading-relaxed text-neutral-500 dark:text-neutral-500"
              >
                Agrega una meta por vendedor y se renovará automáticamente cada
                semana
              </p>
            </div>
            <div
              class="h-px w-24 bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent"
            ></div>
          </div>
        }

        @if (progresos.length > 0) {
          <div class="flex items-center gap-3 mb-5">
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
                Metas Semanales
              </span>
            </div>
            <div class="h-px flex-1 bg-neutral-100 dark:bg-neutral-800"></div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            @for (p of progresos; track p.vendedorId) {
              <div
                class="vendor-card card-appear relative overflow-hidden rounded-2xl border"
                [class]="
                  p.cumplioVentas
                    ? 'border-yellow-300 dark:border-yellow-700/60 bg-yellow-50 dark:bg-yellow-950/15'
                    : 'border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                "
              >
                <div
                  class="absolute inset-x-0 top-0 h-px"
                  [class]="
                    p.cumplioVentas
                      ? 'bg-gradient-to-r from-transparent via-yellow-400/80 to-transparent'
                      : 'bg-gradient-to-r from-transparent via-neutral-200/60 dark:via-neutral-700/60 to-transparent'
                  "
                ></div>

                @if (p.cumplioVentas) {
                  <div
                    class="absolute top-3 right-3 flex items-center gap-1
                              px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider
                              bg-yellow-400 dark:bg-yellow-500 text-neutral-900"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="9"
                      height="9"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      stroke="none"
                    >
                      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                    </svg>
                    META
                  </div>
                }

                <div class="p-5 space-y-4">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-11 h-11 rounded-xl flex items-center justify-center
                                font-black text-base flex-shrink-0"
                      [class]="
                        p.cumplioVentas
                          ? 'bg-yellow-400 dark:bg-yellow-500 text-neutral-900'
                          : 'bg-neutral-900 dark:bg-neutral-700 text-white'
                      "
                    >
                      {{ p.vendedor.charAt(0).toUpperCase() }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <p
                        class="text-sm font-bold truncate text-neutral-900 dark:text-white"
                      >
                        {{ p.vendedor }}
                      </p>
                      <p
                        class="text-[11px] mt-0.5 text-neutral-400 dark:text-neutral-500"
                      >
                        {{ p.ventasActuales }} de {{ p.meta.metaVentas }} pares
                      </p>
                    </div>
                  </div>

                  <div class="flex items-end justify-between">
                    <div>
                      <p
                        class="text-4xl font-black tabular-nums leading-none"
                        [class]="
                          p.cumplioVentas
                            ? 'text-yellow-500 dark:text-yellow-400'
                            : 'text-neutral-800 dark:text-white'
                        "
                      >
                        {{ p.ventasActuales }}
                      </p>
                      <p
                        class="text-[10px] font-semibold uppercase tracking-widest mt-1
                                text-neutral-400 dark:text-neutral-600"
                      >
                        ventas esta semana
                      </p>
                    </div>
                    <div class="text-right">
                      <p
                        class="text-xl font-black tabular-nums"
                        [class]="
                          p.cumplioVentas
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-neutral-400 dark:text-neutral-500'
                        "
                      >
                        {{ p.porcentajeVentas }}%
                      </p>
                      <p
                        class="text-[10px] font-semibold uppercase tracking-widest
                                text-neutral-400 dark:text-neutral-600"
                      >
                        de la meta
                      </p>
                    </div>
                  </div>

                  <div>
                    <div
                      class="h-2.5 rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-800"
                    >
                      <div
                        class="bar-anim h-full rounded-full"
                        [class]="
                          p.cumplioVentas
                            ? 'bg-emerald-500 dark:bg-emerald-400'
                            : 'bg-yellow-400 dark:bg-yellow-500'
                        "
                        [style.width]="
                          (p.porcentajeVentas > 100
                            ? 100
                            : p.porcentajeVentas) + '%'
                        "
                      ></div>
                    </div>
                    <div class="flex justify-between mt-1">
                      <span
                        class="text-[10px] text-neutral-400 dark:text-neutral-600"
                        >0</span
                      >
                      <span
                        class="text-[10px] text-neutral-400 dark:text-neutral-600"
                      >
                        Meta: {{ p.meta.metaVentas }} pares
                      </span>
                    </div>
                  </div>

                  @if (!p.cumplioVentas) {
                    <div
                      class="flex items-center gap-2 rounded-xl px-3 py-2
                                bg-neutral-100 dark:bg-neutral-800"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#d4af37"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <p
                        class="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400"
                      >
                        Faltan
                        <span
                          class="text-neutral-800 dark:text-white font-black"
                        >
                          {{ p.meta.metaVentas - p.ventasActuales }}
                        </span>
                        pares
                      </p>
                    </div>
                  } @else {
                    <div
                      class="flex items-center gap-2 rounded-xl px-3 py-2
                                bg-emerald-50 dark:bg-emerald-950/20
                                border border-emerald-100 dark:border-emerald-900/40"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#10b981"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <p
                        class="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400"
                      >
                        ¡Meta completada esta semana!
                      </p>
                    </div>
                  }

                  <div
                    class="flex items-center justify-between pt-1
                              border-t border-neutral-50 dark:border-neutral-800"
                  >
                    <button
                      (click)="editarMeta(p)"
                      class="flex items-center gap-1.5 text-[11px] font-semibold mt-2
                             text-neutral-400 dark:text-neutral-500
                             hover:text-yellow-500 dark:hover:text-yellow-400 transition
                             cursor-pointer"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path
                          d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                        />
                        <path
                          d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                        />
                      </svg>
                      Editar meta
                    </button>
                    <button
                      (click)="eliminarMeta(p.vendedorId)"
                      class="flex items-center gap-1.5 text-[11px] font-semibold mt-2
                             text-neutral-300 dark:text-neutral-700
                             hover:text-red-500 dark:hover:text-red-400 transition
                             cursor-pointer"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path
                          d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
                        />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>

          @if (progresosMensuales.length > 0) {
            <div class="flex items-center gap-3 mb-5">
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
                  Metas Mensuales · {{ mesActualLabel }}
                </span>
              </div>
              <div class="h-px flex-1 bg-neutral-100 dark:bg-neutral-800"></div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              @for (pm of progresosMensuales; track pm.vendedorId) {
                <div
                  class="vendor-card card-appear relative overflow-hidden rounded-2xl border"
                  [class]="
                    pm.cumplioMeta
                      ? 'border-yellow-300 dark:border-yellow-700/60 bg-yellow-50 dark:bg-yellow-950/15'
                      : 'border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                  "
                >
                  <div
                    class="absolute inset-x-0 top-0 h-px"
                    [class]="
                      pm.cumplioMeta
                        ? 'bg-gradient-to-r from-transparent via-yellow-400/80 to-transparent'
                        : 'bg-gradient-to-r from-transparent via-neutral-200/60 dark:via-neutral-700/60 to-transparent'
                    "
                  ></div>

                  @if (pm.cumplioMeta) {
                    <div
                      class="absolute top-3 right-3 flex items-center gap-1
                                px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider
                                bg-yellow-400 dark:bg-yellow-500 text-neutral-900"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="9"
                        height="9"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        stroke="none"
                      >
                        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                      </svg>
                      MES
                    </div>
                  }

                  <div class="p-5 space-y-4">
                    <div class="flex items-center gap-3">
                      <div
                        class="w-11 h-11 rounded-xl flex items-center justify-center
                                  font-black text-base flex-shrink-0"
                        [class]="
                          pm.cumplioMeta
                            ? 'bg-yellow-400 dark:bg-yellow-500 text-neutral-900'
                            : 'bg-neutral-900 dark:bg-neutral-700 text-white'
                        "
                      >
                        {{ pm.vendedor.charAt(0).toUpperCase() }}
                      </div>
                      <div class="min-w-0 flex-1">
                        <p
                          class="text-sm font-bold truncate text-neutral-900 dark:text-white"
                        >
                          {{ pm.vendedor }}
                        </p>
                        <p
                          class="text-[11px] mt-0.5 text-neutral-400 dark:text-neutral-500"
                        >
                          {{ pm.ventasMes }} de {{ pm.metaMensual }} pares este
                          mes
                        </p>
                      </div>
                    </div>

                    <div class="flex items-end justify-between">
                      <div>
                        <p
                          class="text-4xl font-black tabular-nums leading-none"
                          [class]="
                            pm.cumplioMeta
                              ? 'text-yellow-500 dark:text-yellow-400'
                              : 'text-neutral-800 dark:text-white'
                          "
                        >
                          {{ pm.ventasMes }}
                        </p>
                        <p
                          class="text-[10px] font-semibold uppercase tracking-widest mt-1
                                  text-neutral-400 dark:text-neutral-600"
                        >
                          pares este mes
                        </p>
                      </div>
                      <div class="text-right">
                        <p
                          class="text-xl font-black tabular-nums"
                          [class]="
                            pm.cumplioMeta
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-neutral-400 dark:text-neutral-500'
                          "
                        >
                          {{ pm.porcentaje }}%
                        </p>
                        <p
                          class="text-[10px] font-semibold uppercase tracking-widest
                                  text-neutral-400 dark:text-neutral-600"
                        >
                          de la meta
                        </p>
                      </div>
                    </div>

                    <div>
                      <div
                        class="h-2.5 rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-800"
                      >
                        <div
                          class="bar-anim h-full rounded-full"
                          [class]="
                            pm.cumplioMeta
                              ? 'bg-emerald-500 dark:bg-emerald-400'
                              : 'bg-yellow-400 dark:bg-yellow-500'
                          "
                          [style.width]="
                            (pm.porcentaje > 100 ? 100 : pm.porcentaje) + '%'
                          "
                        ></div>
                      </div>
                      <div class="flex justify-between mt-1">
                        <span
                          class="text-[10px] text-neutral-400 dark:text-neutral-600"
                          >0</span
                        >
                        <span
                          class="text-[10px] text-neutral-400 dark:text-neutral-600"
                        >
                          Meta: {{ pm.metaMensual }} pares
                        </span>
                      </div>
                    </div>

                    <div
                      class="space-y-1.5 pt-1 border-t border-neutral-50 dark:border-neutral-800"
                    >
                      @for (sem of pm.semanas; track sem.numero) {
                        <div class="flex items-center gap-2">
                          <span
                            class="text-[9px] font-semibold text-neutral-400 dark:text-neutral-600 w-10 flex-shrink-0"
                          >
                            Sem {{ sem.numero }}
                          </span>
                          <div
                            class="flex-1 h-1.5 rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-800"
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
                                (sem.porcentaje > 100 ? 100 : sem.porcentaje) +
                                '%'
                              "
                            ></div>
                          </div>
                          <span
                            class="text-[9px] font-bold tabular-nums w-10 text-right"
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
                        </div>
                      }
                    </div>

                    @if (!pm.cumplioMeta) {
                      <div
                        class="flex items-center gap-2 rounded-xl px-3 py-2
                                  bg-neutral-100 dark:bg-neutral-800"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#d4af37"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <p
                          class="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400"
                        >
                          Faltan
                          <span
                            class="text-neutral-800 dark:text-white font-black"
                          >
                            {{ pm.metaMensual - pm.ventasMes }}
                          </span>
                          pares para la meta del mes
                        </p>
                      </div>
                    } @else {
                      <div
                        class="flex items-center gap-2 rounded-xl px-3 py-2
                                  bg-emerald-50 dark:bg-emerald-950/20
                                  border border-emerald-100 dark:border-emerald-900/40"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#10b981"
                          stroke-width="2.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <p
                          class="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400"
                        >
                          ¡Meta del mes completada!
                        </p>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class MetasComponent implements OnInit, OnDestroy {
  private metasService = inject(MetasService);
  private usuarioService = inject(UsuarioService);
  private cdr = inject(ChangeDetectorRef);

  progresos: ProgresoVendedor[] = [];
  progresosMensuales: ProgresoMensualVendedor[] = [];
  cargando = false;
  mostrarForm = false;
  guardando = false;

  editando = false;
  formVendedorId = '';
  formVendedorNombre = '';
  formMetaVentas = 15;
  formMetaMensual = 60;

  vendedores: { id: string; name: string }[] = [];
  semanaLabel = '';
  mesActualLabel = '';

  mostrarCelebracion = false;
  celebracionMensaje = '';
  particulas: any[] = [];
  vendedoresCelebrados: ProgresoVendedor[] = [];

  private subs = new Subscription();
  private yaFestejados = new Set<string>();

  get esSabado(): boolean {
    return new Date().getDay() === 6;
  }

  get vendedoresCumplieron(): ProgresoVendedor[] {
    return this.progresos.filter((p) => p.cumplioVentas);
  }

  get vendedoresNoCumplieron(): ProgresoVendedor[] {
    return this.progresos.filter((p) => !p.cumplioVentas);
  }

  get vendedoresSinMeta(): { id: string; name: string }[] {
    const idsConMeta = new Set(this.progresos.map((p) => p.vendedorId));
    return this.vendedores.filter((v) => !idsConMeta.has(v.id!));
  }

  ngOnInit(): void {
    this.usuarioService.initUsuarios();

    const inicio = this.metasService.getSemanaActualInicio();
    const fin = this.metasService.getSemanaActualFin();
    this.semanaLabel = `${inicio.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} - ${fin.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`;

    const ahora = new Date();
    this.mesActualLabel = ahora.toLocaleDateString('es-CO', {
      month: 'long',
      year: 'numeric',
    });

    this.subs.add(
      this.usuarioService.usuarios$.subscribe((usuarios: User[]) => {
        this.vendedores = usuarios
          .filter((u) => u.role === 'vendedor' && u.active?.value === true)
          .map((u) => ({ id: u.id!, name: u.name }));
        this.cdr.markForCheck();
      }),
    );

    this.subs.add(
      this.metasService.progreso$.subscribe((progresos) => {
        this.progresos = progresos;
        this.verificarCelebracion(progresos);
        this.cdr.markForCheck();
      }),
    );

    this.subs.add(
      this.metasService.progresoMensual$.subscribe((pm) => {
        this.progresosMensuales = pm;
        this.cdr.markForCheck();
      }),
    );

    this.actualizar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  async actualizar(): Promise<void> {
    await this.metasService.calcularProgreso();
  }

  abrirNuevaMeta(): void {
    if (this.mostrarForm && !this.editando) {
      this.cerrarFormulario();
      return;
    }
    this.editando = false;
    this.formVendedorId = '';
    this.formVendedorNombre = '';
    this.formMetaVentas = 15;
    this.formMetaMensual = 60;
    this.mostrarForm = true;
    this.cdr.markForCheck();
  }

  editarMeta(p: ProgresoVendedor): void {
    this.editando = true;
    this.formVendedorId = p.vendedorId;
    this.formVendedorNombre = p.vendedor;
    this.formMetaVentas = p.meta.metaVentas;
    this.formMetaMensual = p.meta.metaMensual;
    this.mostrarForm = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.cdr.markForCheck();
  }

  cerrarFormulario(): void {
    this.mostrarForm = false;
    this.editando = false;
    this.formVendedorId = '';
    this.formVendedorNombre = '';
    this.formMetaVentas = 15;
    this.formMetaMensual = 60;
    this.cdr.markForCheck();
  }

  onVendedorChange(): void {
    const v = this.vendedores.find((v) => v.id === this.formVendedorId);
    this.formVendedorNombre = v?.name ?? '';
    this.sugerirMensual();
  }

  sugerirMensual(): void {
    if (this.formMetaVentas) {
      this.formMetaMensual = this.formMetaVentas * 4;
    }
  }

  async guardarMeta(): Promise<void> {
    const vendedorId = this.formVendedorId;
    const nombre =
      this.formVendedorNombre ||
      this.vendedores.find((v) => v.id === vendedorId)?.name ||
      '';

    if (!vendedorId || !nombre || !this.formMetaVentas || !this.formMetaMensual)
      return;

    this.guardando = true;
    this.cdr.markForCheck();
    try {
      await this.metasService.guardarMeta(
        vendedorId,
        nombre,
        this.formMetaVentas,
        0,
        this.formMetaMensual,
      );
      this.cerrarFormulario();
      await this.actualizar();
    } finally {
      this.guardando = false;
      this.cdr.markForCheck();
    }
  }

  async eliminarMeta(vendedorId: string): Promise<void> {
    await this.metasService.eliminarMeta(vendedorId);
    await this.actualizar();
  }

  private verificarCelebracion(progresos: ProgresoVendedor[]): void {
    const nuevos = progresos.filter(
      (p) => p.cumplioVentas && !this.yaFestejados.has(p.vendedorId),
    );
    if (nuevos.length === 0) return;
    nuevos.forEach((p) => this.yaFestejados.add(p.vendedorId));
    this.vendedoresCelebrados = nuevos;
    this.lanzarCelebracion(nuevos);
  }

  private lanzarCelebracion(vendedores: ProgresoVendedor[]): void {
    const nombres = vendedores.map((v) => v.vendedor);
    if (nombres.length === 1) {
      this.celebracionMensaje = `${nombres[0]} alcanzó la meta esta semana 🎉`;
    } else if (nombres.length === 2) {
      this.celebracionMensaje = `${nombres[0]} y ${nombres[1]} han completado la meta 🎉`;
    } else {
      const ultimo = nombres[nombres.length - 1];
      const resto = nombres.slice(0, -1).join(', ');
      this.celebracionMensaje = `${resto} y ${ultimo} han completado la meta 🎉`;
    }
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
