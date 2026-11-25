import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { AsyncPipe, DatePipe, NgClass } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  NotificacionIA,
  NotificacionesIaService,
} from '../../../services/administracion/ia/notificaciones-ia.service';

const ICONOS: Record<string, string> = {
  'venta-bajo-costo': '💸',
  'posible-duplicada': '🧾',
  calendario: '📅',
  'descuadre-inventario': '📦',
  'cuadre-pendiente': '💵',
  'patron-vendedor': '🕵️',
  'marketing-temporada': '📣',
  'publicacion-sugerida': '📸',
};

/** Campana con contador para la cabecera del admin. */
@Component({
  selector: 'app-campana-notificaciones',
  standalone: true,
  imports: [AsyncPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      routerLink="/admin/notificaciones"
      class="relative inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-900 text-gray-700 dark:text-zinc-200 hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors"
      aria-label="Notificaciones de la IA"
      title="Notificaciones de la IA"
    >
      <svg
        class="w-4 h-4"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
        />
      </svg>
      @if ((servicio.noLeidas$ | async); as n) {
        <span
          class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
          >{{ n > 99 ? '99+' : n }}</span
        >
      }
    </a>
  `,
})
export class CampanaNotificacionesComponent implements OnInit, OnDestroy {
  servicio = inject(NotificacionesIaService);
  ngOnInit(): void {
    this.servicio.escuchar();
  }
  ngOnDestroy(): void {
    this.servicio.detener();
  }
}

/** Página con todas las notificaciones; cada una abre la pantalla relacionada con sus filtros. */
@Component({
  selector: 'app-notificaciones-ia',
  standalone: true,
  imports: [AsyncPipe, DatePipe, NgClass, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-zinc-950 px-4 sm:px-6 py-6">
      <div class="max-w-3xl mx-auto">
        <div class="flex items-center justify-between gap-3 mb-5">
          <div>
            <a
              routerLink="/admin"
              class="text-xs text-gray-400 hover:text-gray-600 dark:text-zinc-500"
              >← Volver al panel</a
            >
            <h1
              class="text-2xl font-black tracking-tight text-gray-900 dark:text-zinc-50"
            >
              Notificaciones de la IA
            </h1>
            <p class="text-sm text-gray-400 dark:text-zinc-500">
              Toca una para ir directo a lo que detectó.
            </p>
          </div>
          <button
            type="button"
            (click)="servicio.marcarTodasLeidas()"
            class="px-3 py-2 rounded-lg text-xs font-semibold bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-80"
          >
            Marcar todas como leídas
          </button>
        </div>

        @if (servicio.notificaciones$ | async; as lista) {
          @if (!lista.length) {
            <div
              class="text-center py-20 text-sm text-gray-400 dark:text-zinc-500"
            >
              Todavía no hay notificaciones. Aquí aparecerán las alertas y
              recomendaciones de la IA.
            </div>
          }
          <ul class="space-y-2.5">
            @for (n of lista; track n.id) {
              <li>
                <button
                  type="button"
                  (click)="abrir(n)"
                  class="w-full text-left flex gap-3 p-4 rounded-2xl border transition-colors cursor-pointer"
                  [ngClass]="
                    n.leida
                      ? 'bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800 opacity-75'
                      : 'bg-white dark:bg-zinc-900 border-amber-300/60 dark:border-amber-500/40 shadow-sm'
                  "
                >
                  <span class="text-xl leading-none mt-0.5" aria-hidden="true">{{
                    icono(n)
                  }}</span>
                  <span class="flex-1 min-w-0">
                    <span class="flex items-center gap-2">
                      <span
                        class="text-sm font-bold text-gray-900 dark:text-zinc-100"
                        >{{ n.titulo }}</span
                      >
                      <span
                        class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                        [ngClass]="{
                          'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300':
                            n.severidad === 'alta',
                          'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300':
                            n.severidad === 'media',
                          'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300':
                            n.severidad === 'info',
                        }"
                        >{{ n.severidad }}</span
                      >
                      @if (!n.leida) {
                        <span
                          class="w-2 h-2 rounded-full bg-red-500"
                          aria-label="Sin leer"
                        ></span>
                      }
                    </span>
                    <span
                      class="block text-sm text-gray-600 dark:text-zinc-400 mt-1 whitespace-pre-line"
                      >{{ n.descripcion }}</span
                    >
                    <span class="block text-[11px] text-gray-400 dark:text-zinc-500 mt-1.5">
                      {{ n.fecha | date: "d MMM y, h:mm a" }}
                      @if (n.ruta) {
                        · Toca para ver →
                      }
                    </span>
                  </span>
                </button>
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
})
export class NotificacionesIaComponent implements OnInit, OnDestroy {
  servicio = inject(NotificacionesIaService);
  private router = inject(Router);

  ngOnInit(): void {
    this.irAlInicio();
    this.servicio.escuchar();
    // Una vez pintada la lista se vuelve a subir: al llegar desde otra pantalla el navegador
    // podía conservar la posición de scroll que tenía allá (a veces al final).
    requestAnimationFrame(() => this.irAlInicio());
    setTimeout(() => this.irAlInicio(), 150);
  }

  private irAlInicio(): void {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }
  ngOnDestroy(): void {
    this.servicio.detener();
  }

  icono(n: NotificacionIA): string {
    if (n.tipo.startsWith('cambios-frecuentes')) return '🔁';
    return ICONOS[n.tipo] ?? '✦';
  }

  async abrir(n: NotificacionIA): Promise<void> {
    if (!n.leida) {
      this.servicio.marcarLeida(n.id).catch((e) => console.error(e));
    }
    if (n.ruta) {
      await this.router.navigate([n.ruta], { queryParams: n.params });
    }
  }
}
