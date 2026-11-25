import { Component, Input, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section
      class="relative w-full px-6 sm:px-10 py-8
             bg-white dark:bg-zinc-950
             border-b border-zinc-100 dark:border-zinc-800/60
             overflow-hidden"
      (mousemove)="onMouseMove($event)"
    >
      <!-- Subtle mouse-follow glow -->
      <div
        class="pointer-events-none absolute inset-0 transition-opacity duration-700 opacity-50"
        [ngStyle]="{
          background:
            'radial-gradient(420px circle at ' +
            mouseX +
            'px ' +
            mouseY +
            'px, rgba(201,168,76,0.06), transparent 60%)',
        }"
      ></div>

      <!-- Top decorative line -->
      <div
        class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent"
      ></div>

      <div
        class="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6"
      >
        <!-- LEFT: Avatar + greeting -->
        <div class="flex items-center gap-4 header-content">
          <!-- Avatar circle with initials -->
          <div class="relative flex-shrink-0">
            <div
              class="w-14 h-14 rounded-2xl flex items-center justify-center
                     bg-gradient-to-br from-yellow-400 to-yellow-600
                     shadow-lg shadow-yellow-500/20 dark:shadow-yellow-500/10
                     text-white font-bold text-lg tracking-wide select-none"
            >
              {{ getInitials(nombre) }}
            </div>
            <!-- Online indicator -->
            <span
              class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400
                     border-2 border-white dark:border-zinc-950"
              aria-label="En línea"
            ></span>
          </div>

          <!-- Text block -->
          <div class="flex flex-col gap-1">
            <!-- Eyebrow -->
            <div class="flex items-center gap-2">
              <span
                class="text-xs font-semibold tracking-widest uppercase text-yellow-600 dark:text-yellow-400"
              >
                Executive Dashboard
              </span>
              <!-- Role badge -->
              <span
                class="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full
                       bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400
                       border border-zinc-200 dark:border-zinc-700"
              >
                <span
                  class="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"
                ></span>
                Administrador
              </span>
            </div>

            <!-- Name -->
            <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span
                class="text-xl sm:text-2xl font-light text-zinc-500 dark:text-zinc-400 leading-none"
              >
                Bienvenido,
              </span>
              <span
                class="text-2xl sm:text-3xl font-extrabold leading-none
                       text-transparent bg-clip-text
                       bg-gradient-to-r from-yellow-500 to-yellow-400"
              >
                {{ nombre || 'Usuario' }}
              </span>
            </div>

            <!-- Subtitle -->
            <p
              class="text-sm text-zinc-400 dark:text-zinc-500 font-light leading-snug max-w-md mt-0.5"
            >
              Monitorea tu negocio con reportes en tiempo real.
            </p>
          </div>
        </div>

        <!-- RIGHT: Date + quick stats strip -->
        <div
          class="flex flex-col items-start sm:items-end gap-3 header-content"
        >
          <!-- Date chip -->
          <div
            class="flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500
                   px-3 py-1.5 rounded-xl
                   bg-zinc-50 dark:bg-zinc-900
                   border border-zinc-100 dark:border-zinc-800"
          >
            <svg
              class="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5"
              />
            </svg>
            {{ today | date: 'EEEE, d MMMM yyyy' : '' : 'es' }}
          </div>

          <!-- Quick action buttons -->
          <div class="flex items-center gap-2">
            <button
              class="flex items-center gap-1.5 text-xs font-medium
                     px-3 py-1.5 rounded-xl
                     bg-zinc-50 dark:bg-zinc-900
                     border border-zinc-200 dark:border-zinc-700
                     text-zinc-600 dark:text-zinc-300
                     hover:border-yellow-400/50 dark:hover:border-yellow-500/40
                     hover:text-yellow-600 dark:hover:text-yellow-400
                     transition-all duration-200 cursor-pointer"
              aria-label="Actualizar datos"
            >
              <svg
                class="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
              Actualizar
            </button>
            <button
              class="flex items-center gap-1.5 text-xs font-medium
                     px-3 py-1.5 rounded-xl
                     bg-yellow-500 hover:bg-yellow-400
                     text-white
                     shadow-sm shadow-yellow-500/30
                     transition-all duration-200 cursor-pointer"
              aria-label="Ver reportes"
            >
              <svg
                class="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                />
              </svg>
              Reportes
            </button>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      @keyframes fadeUp {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .header-content {
        opacity: 0;
        animation: fadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards;
      }
    `,
  ],
})
export class DashboardHeaderComponent {
  @Input() nombre: string | undefined = '';

  mouseX = 0;
  mouseY = 0;
  today = new Date();

  constructor(private el: ElementRef) {}

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    const rect = this.el.nativeElement.getBoundingClientRect();
    this.mouseX = event.clientX - rect.left;
    this.mouseY = event.clientY - rect.top;
  }

  getInitials(name: string | undefined): string {
    if (!name) return 'U';
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  }
}
