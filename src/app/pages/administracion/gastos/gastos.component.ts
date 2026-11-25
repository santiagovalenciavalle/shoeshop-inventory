import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  GastosService,
  Gasto,
  CATEGORIAS_GASTO,
} from '../../../services/administracion/gastos/gastos.service';

import { IaSpinnerComponent } from '../../../shared/components/ia-loader/ia-spinner.component';
type VistaModal = 'form' | 'confirmar-eliminar' | null;

@Component({
  selector: 'app-gastos',
  standalone: true,
  imports: [
    IaSpinnerComponent,CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(24px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-12px);
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
      @keyframes shimmer {
        0%,
        100% {
          opacity: 0.4;
        }
        50% {
          opacity: 0.9;
        }
      }
      .anim-fade {
        animation: fadeIn 0.2s ease both;
      }
      .anim-up {
        animation: slideUp 0.3s cubic-bezier(0.22, 0.68, 0, 1.2) both;
      }
      .anim-down {
        animation: slideDown 0.25s cubic-bezier(0.22, 0.68, 0, 1.2) both;
      }
      .anim-scale {
        animation: scaleIn 0.3s cubic-bezier(0.22, 0.68, 0, 1.2) both;
      }
      .skeleton {
        animation: shimmer 1.4s ease-in-out infinite;
        background: currentColor;
        border-radius: 6px;
      }
      .scroll-thin::-webkit-scrollbar {
        width: 4px;
      }
      .scroll-thin::-webkit-scrollbar-track {
        background: transparent;
      }
      .scroll-thin::-webkit-scrollbar-thumb {
        background: #374151;
        border-radius: 4px;
      }
      .input-base {
        width: 100%;
        padding: 0.625rem 0.875rem;
        border-radius: 0.75rem;
        font-size: 0.875rem;
        outline: none;
        background: rgb(17 24 39);
        border: 1px solid rgb(55 65 81);
        color: white;
        transition:
          border-color 0.15s,
          box-shadow 0.15s;
      }
      .input-base:focus {
        border-color: #f59e0b;
        box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.12);
      }
      .input-base::placeholder {
        color: rgb(107 114 128);
      }
      .card-gasto {
        transition:
          transform 0.2s cubic-bezier(0.22, 0.68, 0, 1.2),
          box-shadow 0.2s;
      }
      .card-gasto:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
      }
      .btn-primary {
        background: linear-gradient(135deg, #d97706, #f59e0b);
        color: #111;
        font-weight: 700;
        padding: 0.625rem 1.25rem;
        border-radius: 0.75rem;
        font-size: 0.8125rem;
        letter-spacing: 0.04em;
        transition:
          transform 0.15s,
          box-shadow 0.2s,
          opacity 0.15s;
      }
      .btn-primary:hover:not(:disabled) {
        box-shadow: 0 4px 16px rgba(245, 158, 11, 0.35);
        transform: translateY(-1px);
      }
      .btn-primary:active:not(:disabled) {
        transform: translateY(0);
      }
      .btn-primary:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .btn-ghost {
        padding: 0.625rem 1rem;
        border-radius: 0.75rem;
        font-size: 0.8125rem;
        font-weight: 600;
        color: rgb(156 163 175);
        background: rgb(31 41 55);
        border: 1px solid rgb(55 65 81);
        transition:
          background 0.15s,
          color 0.15s;
      }
      .btn-ghost:hover {
        background: rgb(55 65 81);
        color: white;
      }
      .tab-btn {
        padding: 0.375rem 0.875rem;
        border-radius: 0.625rem;
        font-size: 0.75rem;
        font-weight: 700;
        transition: all 0.15s;
      }
    `,
  ],
  template: `
    <div class="min-h-screen bg-neutral-950 text-white px-4 pt-8 pb-20 sm:px-6">
      <div class="mx-auto max-w-2xl">
        <header class="mb-8 anim-down">
          <p
            class="text-[10px] font-semibold tracking-[.22em] uppercase text-amber-500/70 mb-2"
          >
            Finanzas · ShoeShop
          </p>
          <div class="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1
                class="text-3xl sm:text-4xl font-black tracking-tight text-white"
              >
                Control de
                <span
                  class="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600"
                  >Gastos</span
                >
              </h1>
              <p class="mt-1.5 text-sm text-neutral-500">
                {{ mesAnioLabel }} &middot;
                {{ gastosFiltrados.length }} registro{{
                  gastosFiltrados.length !== 1 ? 's' : ''
                }}
              </p>
            </div>
            <button
              (click)="abrirFormulario()"
              class="btn-primary flex items-center gap-2"
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
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nuevo gasto
            </button>
          </div>
          <div
            class="mt-5 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent"
          ></div>
        </header>

        <div class="flex items-center gap-3 mb-6 anim-down">
          <button
            (click)="cambiarMes(-1)"
            class="w-9 h-9 rounded-xl flex items-center justify-center bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white hover:border-amber-500 transition"
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
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div class="flex-1 text-center">
            <p class="text-sm font-bold text-white capitalize">
              {{ mesAnioLabel }}
            </p>
          </div>
          <button
            (click)="cambiarMes(1)"
            [disabled]="esMesActual"
            class="w-9 h-9 rounded-xl flex items-center justify-center bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white hover:border-amber-500 transition disabled:opacity-30 disabled:cursor-not-allowed"
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
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        @if (!cargando) {
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 anim-up">
            <div
              class="col-span-2 rounded-2xl bg-gradient-to-br from-amber-900/40 to-amber-950/20 border border-amber-800/30 p-4"
            >
              <p
                class="text-[10px] font-semibold uppercase tracking-widest text-amber-500/70 mb-1"
              >
                Total del mes
              </p>
              <p class="text-2xl font-black text-amber-400">
                {{ totalMes | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
              </p>
              <p class="text-xs text-neutral-500 mt-0.5">
                {{ gastosFiltrados.length }} gasto{{
                  gastosFiltrados.length !== 1 ? 's' : ''
                }}
              </p>
            </div>
            @for (cat of topCategorias; track cat.id) {
              <div
                class="rounded-2xl bg-neutral-900 border border-neutral-800 p-4"
              >
                <p class="text-lg mb-1">{{ cat.emoji }}</p>
                <p
                  class="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 mb-0.5 truncate"
                >
                  {{ cat.label }}
                </p>
                <p class="text-sm font-black text-white">
                  {{ cat.total | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
                </p>
              </div>
            }
          </div>
        }

        @if (cargando) {
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            @for (i of [1, 2, 3, 4]; track i) {
              <div
                class="rounded-2xl bg-neutral-900 border border-neutral-800 p-4 space-y-2"
              >
                <div class="skeleton h-3 w-16 text-neutral-700"></div>
                <div class="skeleton h-5 w-24 text-neutral-700"></div>
              </div>
            }
          </div>
        }

        <div class="flex flex-col sm:flex-row gap-3 mb-5 anim-down">
          <div class="relative flex-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              class="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              [(ngModel)]="busqueda"
              placeholder="Buscar gasto..."
              class="input-base pl-9"
            />
          </div>
          <div class="relative">
            <select
              [(ngModel)]="categoriaFiltro"
              class="input-base pr-8 appearance-none cursor-pointer min-w-[160px]"
            >
              <option value="">Todas las categorías</option>
              @for (c of categorias; track c.id) {
                <option [value]="c.id">{{ c.emoji }} {{ c.label }}</option>
              }
            </select>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        @if (cargando) {
          <div class="space-y-3">
            @for (i of [1, 2, 3, 4, 5]; track i) {
              <div
                class="rounded-2xl bg-neutral-900 border border-neutral-800 p-4 flex gap-4"
              >
                <div
                  class="skeleton w-11 h-11 rounded-xl text-neutral-700 flex-shrink-0"
                ></div>
                <div class="flex-1 space-y-2 pt-1">
                  <div class="skeleton h-3.5 w-2/3 text-neutral-700"></div>
                  <div class="skeleton h-3 w-1/3 text-neutral-700"></div>
                </div>
                <div
                  class="skeleton h-5 w-20 text-neutral-700 self-center"
                ></div>
              </div>
            }
          </div>
        }

        @if (!cargando && gastosFiltrados.length === 0 && gastos.length === 0) {
          <div
            class="anim-up flex flex-col items-center justify-center py-20 text-center gap-4"
          >
            <div
              class="w-20 h-20 rounded-full border border-neutral-800 bg-neutral-900 flex items-center justify-center text-3xl"
            >
              💸
            </div>
            <div>
              <p class="text-base font-bold text-white">
                Sin gastos en {{ mesAnioLabel }}
              </p>
              <p class="text-sm text-neutral-500 mt-1">
                Registra tu primer gasto del mes
              </p>
            </div>
            <button (click)="abrirFormulario()" class="btn-primary mt-2">
              Agregar gasto
            </button>
          </div>
        }

        @if (!cargando && gastosFiltrados.length === 0 && gastos.length > 0) {
          <div
            class="anim-up flex flex-col items-center justify-center py-14 text-center gap-3"
          >
            <div class="text-4xl">🔍</div>
            <p class="text-sm font-semibold text-neutral-400">
              Sin resultados para tu búsqueda
            </p>
            <button (click)="limpiarFiltros()" class="btn-ghost text-xs mt-1">
              Limpiar filtros
            </button>
          </div>
        }

        @if (!cargando && gastosFiltrados.length > 0) {
          <div class="space-y-3">
            @for (g of gastosFiltrados; track g.id) {
              <div
                class="card-gasto anim-up rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden"
              >
                <div class="flex items-center gap-4 p-4">
                  <div
                    class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                    [style.background]="categoriaColor(g.categoria)"
                  >
                    {{ getCat(g.categoria).emoji }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-white truncate">
                      {{ g.nombre }}
                    </p>
                    <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span
                        class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700"
                      >
                        {{ getCat(g.categoria).label }}
                      </span>
                      <span class="text-[10px] text-neutral-500">{{
                        formatFecha(g.fecha)
                      }}</span>
                    </div>
                    @if (g.nota) {
                      <p class="text-xs text-neutral-500 mt-1 truncate">
                        {{ g.nota }}
                      </p>
                    }
                  </div>
                  <div class="text-right flex-shrink-0">
                    <p class="text-base font-black text-amber-400">
                      {{
                        g.monto | currency: 'COP' : 'symbol-narrow' : '1.0-0'
                      }}
                    </p>
                    <div class="flex items-center gap-1 justify-end mt-1.5">
                      <button
                        (click)="abrirEdicion(g)"
                        title="Editar"
                        class="w-7 h-7 rounded-lg flex items-center justify-center bg-neutral-800 text-neutral-400 hover:bg-blue-900/40 hover:text-blue-400 transition"
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
                        >
                          <path
                            d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                          />
                          <path
                            d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                          />
                        </svg>
                      </button>
                      <button
                        (click)="confirmarEliminar(g)"
                        title="Eliminar"
                        class="w-7 h-7 rounded-lg flex items-center justify-center bg-neutral-800 text-neutral-400 hover:bg-red-900/40 hover:text-red-400 transition"
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
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path
                            d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
                          />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>

    @if (vistaModal) {
      <div
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm anim-fade"
        (click)="cerrarModal()"
      >
        <div
          class="w-full sm:max-w-md mx-0 sm:mx-4"
          (click)="$event.stopPropagation()"
        >
          @if (vistaModal === 'form') {
            <div
              class="anim-scale bg-neutral-900 border border-neutral-800 rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92dvh] flex flex-col"
            >
              <div
                class="flex items-center justify-between px-6 pt-6 pb-4 border-b border-neutral-800 flex-shrink-0"
              >
                <div>
                  <p
                    class="text-[10px] font-semibold uppercase tracking-widest text-amber-500/70 mb-0.5"
                  >
                    {{ modoEdicion ? 'Editar' : 'Nuevo' }} gasto
                  </p>
                  <h2 class="text-base font-black text-white">
                    {{
                      modoEdicion ? gastoEditando?.nombre : 'Registrar gasto'
                    }}
                  </h2>
                </div>
                <button
                  (click)="cerrarModal()"
                  class="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition flex items-center justify-center"
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
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div class="overflow-y-auto scroll-thin flex-1 p-6 space-y-4">
                <div>
                  <label
                    class="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 mb-2 block"
                    >Nombre del gasto *</label
                  >
                  <input
                    [(ngModel)]="form.nombre"
                    type="text"
                    placeholder="Ej: Arriendo local 01"
                    class="input-base"
                    [class.!border-red-500]="enviado && !form.nombre"
                  />
                  @if (enviado && !form.nombre) {
                    <p class="text-xs text-red-400 mt-1">
                      Este campo es requerido
                    </p>
                  }
                </div>

                <div>
                  <label
                    class="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 mb-2 block"
                    >Categoría *</label
                  >
                  <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    @for (c of categorias; track c.id) {
                      <button
                        (click)="form.categoria = c.id"
                        class="flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center transition-all"
                        [class]="
                          form.categoria === c.id
                            ? 'border-amber-500 bg-amber-950/30 scale-105'
                            : 'border-neutral-700 bg-neutral-800 hover:border-neutral-600'
                        "
                      >
                        <span class="text-xl">{{ c.emoji }}</span>
                        <span
                          class="text-[9px] font-semibold text-neutral-400 leading-tight"
                          >{{ c.label }}</span
                        >
                      </button>
                    }
                  </div>
                  @if (enviado && !form.categoria) {
                    <p class="text-xs text-red-400 mt-1">
                      Selecciona una categoría
                    </p>
                  }
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      class="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 mb-2 block"
                      >Monto (COP) *</label
                    >
                    <input
                      [ngModel]="montoFormateado"
                      (input)="onMontoInput($any($event.target).value)"
                      type="text"
                      inputmode="numeric"
                      placeholder="0"
                      class="input-base"
                      [class.!border-red-500]="enviado && !form.monto"
                    />
                    @if (enviado && !form.monto) {
                      <p class="text-xs text-red-400 mt-1">Ingresa el monto</p>
                    }
                  </div>
                  <div>
                    <label
                      class="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 mb-2 block"
                      >Fecha *</label
                    >
                    <input
                      [(ngModel)]="form.fecha"
                      type="date"
                      class="input-base"
                      [class.!border-red-500]="enviado && !form.fecha"
                    />
                    @if (enviado && !form.fecha) {
                      <p class="text-xs text-red-400 mt-1">Ingresa la fecha</p>
                    }
                  </div>
                </div>

                <div>
                  <label
                    class="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 mb-2 block"
                    >Nota (opcional)</label
                  >
                  <textarea
                    [(ngModel)]="form.nota"
                    rows="2"
                    placeholder="Descripción adicional..."
                    class="input-base resize-none"
                  ></textarea>
                </div>
              </div>

              <div
                class="p-6 pt-4 border-t border-neutral-800 flex gap-3 flex-shrink-0"
              >
                <button
                  (click)="guardar()"
                  [disabled]="guardando"
                  class="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  @if (guardando) {
                    <app-ia-spinner class="w-4 h-4 text-neutral-900"></app-ia-spinner>
                    Guardando...
                  } @else {
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      stroke-linecap="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {{ modoEdicion ? 'Guardar cambios' : 'Registrar gasto' }}
                  }
                </button>
                <button (click)="cerrarModal()" class="btn-ghost">
                  Cancelar
                </button>
              </div>
            </div>
          }

          @if (vistaModal === 'confirmar-eliminar') {
            <div
              class="anim-scale bg-neutral-900 border border-neutral-800 rounded-t-3xl sm:rounded-3xl p-6 mx-0 sm:mx-4"
            >
              <div class="flex flex-col items-center text-center gap-4">
                <div
                  class="w-16 h-16 rounded-full bg-red-950/40 border border-red-900/50 flex items-center justify-center"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#f87171"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </div>
                <div>
                  <h3 class="text-base font-black text-white">
                    ¿Eliminar gasto?
                  </h3>
                  <p class="text-sm text-neutral-400 mt-1">
                    <span class="text-white font-semibold">{{
                      gastoAEliminar?.nombre
                    }}</span>
                    —
                    {{
                      gastoAEliminar?.monto
                        | currency: 'COP' : 'symbol-narrow' : '1.0-0'
                    }}
                  </p>
                  <p class="text-xs text-neutral-500 mt-1">
                    Esta acción no se puede deshacer
                  </p>
                </div>
                <div class="flex gap-3 w-full">
                  <button (click)="cerrarModal()" class="btn-ghost flex-1">
                    Cancelar
                  </button>
                  <button
                    (click)="eliminar()"
                    [disabled]="eliminando"
                    class="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-500 text-white transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    @if (eliminando) {
                      <app-ia-spinner class="w-4 h-4 text-white"></app-ia-spinner>
                    } @else {
                      Sí, eliminar
                    }
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      </div>
    }

    @if (toast) {
      <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] anim-up">
        <div
          class="flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border text-sm font-semibold"
          [class]="
            toast.tipo === 'ok'
              ? 'bg-emerald-900/90 border-emerald-700/60 text-emerald-300'
              : 'bg-red-900/90 border-red-700/60 text-red-300'
          "
        >
          <span class="text-base">{{ toast.tipo === 'ok' ? '✅' : '❌' }}</span>
          {{ toast.mensaje }}
        </div>
      </div>
    }
  `,
})
export class GastosComponent implements OnInit, OnDestroy {
  private service = inject(GastosService);
  private cdr = inject(ChangeDetectorRef);

  readonly categorias = CATEGORIAS_GASTO;

  gastos: Gasto[] = [];
  cargando = false;
  vistaModal: VistaModal = null;
  modoEdicion = false;
  guardando = false;
  eliminando = false;
  enviado = false;
  busqueda = '';
  categoriaFiltro = '';
  toast: { tipo: 'ok' | 'err'; mensaje: string } | null = null;
  montoFormateado = '';
  gastoEditando: Gasto | null = null;
  gastoAEliminar: Gasto | null = null;

  mesActual = new Date().getMonth();
  anioActual = new Date().getFullYear();

  form: Partial<Gasto> = {};

  private subs = new Subscription();
  private toastTimer: any;

  get esMesActual(): boolean {
    const h = new Date();
    return (
      this.mesActual === h.getMonth() && this.anioActual === h.getFullYear()
    );
  }

  get mesAnioLabel(): string {
    return new Date(this.anioActual, this.mesActual, 1).toLocaleDateString(
      'es-CO',
      { month: 'long', year: 'numeric' },
    );
  }

  get gastosFiltrados(): Gasto[] {
    let r = this.gastos;
    if (this.busqueda.trim()) {
      const b = this.busqueda.toLowerCase();
      r = r.filter(
        (g) =>
          g.nombre.toLowerCase().includes(b) ||
          g.nota?.toLowerCase().includes(b),
      );
    }
    if (this.categoriaFiltro)
      r = r.filter((g) => g.categoria === this.categoriaFiltro);
    return r;
  }

  get totalMes(): number {
    return this.gastosFiltrados.reduce((s, g) => s + (g.monto || 0), 0);
  }

  get topCategorias() {
    const mapa = new Map<string, number>();
    for (const g of this.gastos) {
      mapa.set(g.categoria, (mapa.get(g.categoria) ?? 0) + g.monto);
    }
    return Array.from(mapa.entries())
      .map(([id, total]) => ({ ...this.getCat(id), total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 2);
  }

  ngOnInit(): void {
    this.subs.add(
      this.service.gastos$.subscribe((g) => {
        this.gastos = g;
        this.cdr.markForCheck();
      }),
    );
    this.subs.add(
      this.service.cargando$.subscribe((c) => {
        this.cargando = c;
        this.cdr.markForCheck();
      }),
    );
    this.cargar();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    clearTimeout(this.toastTimer);
  }

  cargar(): void {
    this.service.cargarGastosPorMes(this.anioActual, this.mesActual);
  }

  cambiarMes(dir: number): void {
    const d = new Date(this.anioActual, this.mesActual + dir, 1);
    this.anioActual = d.getFullYear();
    this.mesActual = d.getMonth();
    this.busqueda = '';
    this.categoriaFiltro = '';
    this.cargar();
  }

  limpiarFiltros(): void {
    this.busqueda = '';
    this.categoriaFiltro = '';
    this.cdr.markForCheck();
  }

  abrirFormulario(): void {
    this.modoEdicion = false;
    this.enviado = false;
    this.gastoEditando = null;
    this.montoFormateado = '';
    const hoy = new Date();
    this.form = {
      nombre: '',
      categoria: '',
      monto: undefined,
      fecha: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`,
      nota: '',
    };
    this.vistaModal = 'form';
    this.cdr.markForCheck();
  }

  abrirEdicion(g: Gasto): void {
    this.modoEdicion = true;
    this.enviado = false;
    this.gastoEditando = g;
    this.form = {
      nombre: g.nombre,
      categoria: g.categoria,
      monto: g.monto,
      fecha: g.fecha,
      nota: g.nota ?? '',
    };
    this.montoFormateado = g.monto ? this.formatMiles(g.monto.toString()) : '';
    this.vistaModal = 'form';
    this.cdr.markForCheck();
  }

  onMontoInput(valor: string): void {
    const numeroLimpio = valor.replace(/\D/g, '');

    if (!numeroLimpio) {
      this.montoFormateado = '';
      this.form.monto = undefined;
      return;
    }

    this.form.monto = Number(numeroLimpio);

    this.montoFormateado = this.formatMiles(numeroLimpio);
  }

  private formatMiles(valor: string): string {
    return valor.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  confirmarEliminar(g: Gasto): void {
    this.gastoAEliminar = g;
    this.vistaModal = 'confirmar-eliminar';
    this.cdr.markForCheck();
  }

  cerrarModal(): void {
    if (this.guardando || this.eliminando) return;
    this.vistaModal = null;
    this.enviado = false;
    this.cdr.markForCheck();
  }

  async guardar(): Promise<void> {
    this.enviado = true;
    if (
      !this.form.nombre ||
      !this.form.categoria ||
      !this.form.monto ||
      !this.form.fecha
    )
      return;
    this.guardando = true;
    this.cdr.markForCheck();
    try {
      const payload = {
        nombre: this.form.nombre!.trim(),
        categoria: this.form.categoria!,
        monto: Number(this.form.monto),
        fecha: this.form.fecha!,
        nota: this.form.nota?.trim() ?? '',
      };
      if (this.modoEdicion && this.gastoEditando?.id) {
        await this.service.editar(this.gastoEditando.id, payload);
        this.mostrarToast('ok', 'Gasto actualizado correctamente');
      } else {
        await this.service.agregar(payload);
        this.mostrarToast('ok', 'Gasto registrado correctamente');
      }
      this.vistaModal = null;
      this.enviado = false;
      this.cargar();
    } catch {
      this.mostrarToast('err', 'Error al guardar. Intenta de nuevo.');
    } finally {
      this.guardando = false;
      this.cdr.markForCheck();
    }
  }

  async eliminar(): Promise<void> {
    if (!this.gastoAEliminar?.id) return;
    this.eliminando = true;
    this.cdr.markForCheck();
    try {
      await this.service.eliminar(this.gastoAEliminar.id);
      this.mostrarToast('ok', 'Gasto eliminado');
      this.vistaModal = null;
      this.gastoAEliminar = null;
      this.cargar();
    } catch {
      this.mostrarToast('err', 'Error al eliminar');
    } finally {
      this.eliminando = false;
      this.cdr.markForCheck();
    }
  }

  getCat(id: string) {
    return this.service.getCategoriaInfo(id);
  }

  formatFecha(fecha: string): string {
    if (!fecha) return '';
    const d = new Date(fecha + 'T00:00:00');
    return d.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  categoriaColor(id: string): string {
    const map: Record<string, string> = {
      arriendo: 'rgba(239,68,68,.15)',
      servicios: 'rgba(234,179,8,.15)',
      nomina: 'rgba(99,102,241,.15)',
      inventario: 'rgba(16,185,129,.15)',
      transporte: 'rgba(59,130,246,.15)',
      marketing: 'rgba(236,72,153,.15)',
      mantenimiento: 'rgba(245,158,11,.15)',
      impuestos: 'rgba(168,85,247,.15)',
      seguros: 'rgba(6,182,212,.15)',
      tecnologia: 'rgba(14,165,233,.15)',
      alimentacion: 'rgba(249,115,22,.15)',
      papeleria: 'rgba(161,161,170,.15)',
    };
    return map[id] ?? 'rgba(107,114,128,.15)';
  }

  private mostrarToast(tipo: 'ok' | 'err', mensaje: string): void {
    clearTimeout(this.toastTimer);
    this.toast = { tipo, mensaje };
    this.cdr.markForCheck();
    this.toastTimer = setTimeout(() => {
      this.toast = null;
      this.cdr.markForCheck();
    }, 3000);
  }
}
