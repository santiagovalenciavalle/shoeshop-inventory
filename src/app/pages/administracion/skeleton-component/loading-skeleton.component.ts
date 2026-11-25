import { Component } from '@angular/core';
import { IaLoaderComponent } from '../../../shared/components/ia-loader/ia-loader.component';

/**
 * Esqueleto del panel de administración: reproduce la retícula del tablero
 * (encabezado, franja de indicadores, gráfico + mes, préstamos + IA) mientras cargan los datos.
 */
@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  imports: [IaLoaderComponent],
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-zinc-950" aria-busy="true">
      <div
        class="max-w-screen-xl mx-auto px-4 sm:px-6 xl:px-10 pt-6 sm:pt-8 pb-16"
      >
        <!-- Encabezado -->
        <div
          class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 pb-5 mb-6 border-b border-gray-200 dark:border-zinc-800"
        >
          <div class="space-y-2.5">
            <div class="sk h-2.5 w-28 rounded"></div>
            <div class="sk h-7 w-56 rounded-md"></div>
            <div class="sk h-3 w-64 rounded"></div>
          </div>
          <div class="flex gap-2">
            <div class="sk h-9 w-40 rounded-lg"></div>
            <div class="sk h-9 w-32 rounded-lg"></div>
            <div class="sk h-9 w-36 rounded-lg"></div>
          </div>
        </div>

        <!-- Indicadores -->
        <div
          class="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-800 bg-gray-200 dark:bg-zinc-800"
        >
          @for (i of [1, 2, 3, 4, 5, 6]; track i) {
            <div class="bg-white dark:bg-zinc-900 p-4 sm:p-5 space-y-3">
              <div class="sk h-2.5 w-20 rounded"></div>
              <div class="sk h-6 w-24 rounded-md"></div>
              <div class="sk h-2.5 w-14 rounded"></div>
            </div>
          }
        </div>

        <!-- Ventas -->
        <div class="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          <div
            class="lg:col-span-2 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
          >
            <div
              class="px-5 py-4 border-b border-gray-200 dark:border-zinc-800 space-y-2"
            >
              <div class="sk h-3.5 w-36 rounded"></div>
              <div class="sk h-2.5 w-44 rounded"></div>
            </div>
            <div class="p-5"><div class="sk h-[230px] rounded-lg"></div></div>
          </div>
          <div
            class="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
          >
            <div
              class="px-5 py-4 border-b border-gray-200 dark:border-zinc-800 space-y-2"
            >
              <div class="sk h-3.5 w-32 rounded"></div>
              <div class="sk h-2.5 w-28 rounded"></div>
            </div>
            <div class="p-5 space-y-4">
              <div class="sk h-8 w-44 rounded-md"></div>
              @for (i of [1, 2, 3, 4]; track i) {
                <div class="sk h-2 rounded-full"></div>
              }
            </div>
          </div>
        </div>

        <!-- Préstamos + IA -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          <div
            class="lg:col-span-2 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
          >
            <div
              class="px-5 py-4 border-b border-gray-200 dark:border-zinc-800 space-y-2"
            >
              <div class="sk h-3.5 w-44 rounded"></div>
              <div class="sk h-2.5 w-24 rounded"></div>
            </div>
            <div class="p-5 space-y-4">
              @for (i of [1, 2, 3, 4]; track i) {
                <div class="flex items-center gap-3">
                  <div class="sk w-7 h-7 rounded-md shrink-0"></div>
                  <div class="flex-1 space-y-2">
                    <div class="sk h-2.5 w-1/3 rounded"></div>
                    <div class="sk h-1.5 rounded-full"></div>
                  </div>
                </div>
              }
            </div>
          </div>
          <div
            class="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
          >
            <div
              class="px-5 py-4 border-b border-gray-200 dark:border-zinc-800 space-y-2"
            >
              <div class="sk h-3.5 w-32 rounded"></div>
              <div class="sk h-2.5 w-40 rounded"></div>
            </div>
            <div class="p-5 space-y-3">
              <div class="sk h-20 rounded-lg"></div>
              <div class="sk h-9 w-32 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>

      <div
        class="fixed left-1/2 -translate-x-1/2 bottom-6 z-[60] rounded-full bg-white/95 dark:bg-zinc-900/95 text-gray-900 dark:text-zinc-100 border border-gray-200 dark:border-zinc-800 shadow-lg backdrop-blur px-1.5 py-0.5"
      >
        <app-ia-loader
          variante="compacto"
          [mensajes]="[
            'Preparando tu panel…',
            'Analizando tus ventas…',
            'Revisando el inventario…',
            'Casi listo…',
          ]"
        ></app-ia-loader>
      </div>
    </div>
  `,
  styles: [
    `
      .sk {
        position: relative;
        overflow: hidden;
        background: #e5e7eb;
      }
      .sk::after {
        content: '';
        position: absolute;
        inset: 0;
        transform: translateX(-100%);
        background: linear-gradient(
          90deg,
          transparent,
          rgba(255, 255, 255, 0.65),
          transparent
        );
        animation: sk-barrido 1.5s ease-in-out infinite;
      }
      @media (prefers-color-scheme: dark) {
        .sk {
          background: #27272a;
        }
        .sk::after {
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.07),
            transparent
          );
        }
      }
      @keyframes sk-barrido {
        to {
          transform: translateX(100%);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .sk::after {
          animation: none;
        }
      }
    `,
  ],
})
export class LoadingSkeletonComponent {}
