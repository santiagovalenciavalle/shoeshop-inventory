import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AlertaReposicion } from '../../../services/administracion/reposicion/reposicion.service';
import { ReposicionModalService } from '../../../services/administracion/reposicion/reposicion-modal.service';

@Component({
  selector: 'app-reposicion-modal',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      @keyframes rm-fade-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      @keyframes rm-pop {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }
      .rm-overlay {
        animation: rm-fade-in 0.2s ease both;
        backdrop-filter: blur(4px);
      }
      .rm-card {
        animation: rm-pop 0.25s ease both;
      }
      @media (prefers-reduced-motion: reduce) {
        .rm-overlay,
        .rm-card {
          animation: none;
        }
      }
    `,
  ],
  template: `
    <div
      *ngIf="mostrar"
      class="rm-overlay fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/40 dark:bg-black/60 sm:px-4"
      (click)="cerrar()"
    >
      <div
        class="rm-card w-full sm:max-w-lg flex flex-col max-h-[92dvh] rounded-t-2xl sm:rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
        (click)="$event.stopPropagation()"
      >
        <div
          class="px-5 py-4 flex items-start gap-3 border-b border-gray-200 dark:border-zinc-800 flex-shrink-0"
        >
          <span
            class="w-8 h-8 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/60 flex items-center justify-center flex-shrink-0"
          >
            <svg
              class="w-4 h-4 text-amber-600 dark:text-amber-400"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3 3v18h18M7 14l4-4 3 3 5-6"
              />
            </svg>
          </span>
          <div class="flex-1 min-w-0">
            <p
              class="text-[10px] font-semibold tracking-[.18em] uppercase text-amber-600 dark:text-amber-400"
            >
              ShoeShop IA
            </p>
            <h2
              class="text-sm font-semibold text-gray-900 dark:text-zinc-100 mt-0.5"
            >
              Recomendaciones de reposición{{
                nombreUsuario ? ' para ' + nombreUsuario : ''
              }}
            </h2>
            <p
              class="text-xs text-gray-500 dark:text-zinc-400 mt-1 leading-relaxed"
            >
              Estas referencias se están vendiendo rápido y se están agotando.
              Conviene reponerlas pronto.
            </p>
          </div>
          <button
            (click)="cerrar()"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0 cursor-pointer"
            aria-label="Cerrar"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
            >
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <div
          class="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-zinc-800"
        >
          <div
            *ngFor="let a of alertas"
            class="flex items-center gap-3 px-5 py-3"
          >
            <img
              [src]="a.imagen || '/logo.svg'"
              class="w-11 h-11 rounded-lg object-cover flex-shrink-0 bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-800 cursor-pointer hover:opacity-80 transition-opacity"
              loading="lazy"
              alt="zapato"
              (click)="verImagen(a.imagen, $event)"
            />
            <div class="flex-1 min-w-0">
              <p
                class="text-[13px] font-medium text-gray-900 dark:text-zinc-100 truncate"
              >
                {{ a.marca }} {{ a.referencia }}
              </p>
              <p class="text-[11px] text-gray-500 dark:text-zinc-400">
                Cód. {{ a.zapatoId }} · Talla {{ a.talla }}
              </p>
            </div>
            <div class="text-right flex-shrink-0">
              <p
                class="text-[13px] font-semibold tabular-nums"
                [ngClass]="urgenciaColor(a.urgencia)"
              >
                {{ a.stockActual }} uds
              </p>
              <p
                class="text-[10px] text-gray-500 dark:text-zinc-400 tabular-nums"
              >
                ~{{ a.diasParaAgotarse }} días
              </p>
            </div>
          </div>
        </div>

        <div
          class="px-5 py-4 flex items-center gap-3 border-t border-gray-200 dark:border-zinc-800 flex-shrink-0"
        >
          <button
            (click)="cerrar()"
            class="h-9 px-4 rounded-lg border border-gray-300 dark:border-zinc-700 text-[13px] font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Ahora no
          </button>
          <a
            routerLink="/admin/reposiciones"
            (click)="cerrar()"
            class="flex-1 h-9 inline-flex items-center justify-center rounded-lg bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[13px] font-semibold hover:bg-gray-700 dark:hover:bg-zinc-300 transition-colors"
          >
            Ver todas las recomendaciones
          </a>
        </div>
        <!-- Lightbox de imagen -->
        <div
          *ngIf="imagenAmpliada"
          class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/85 px-4 animate-[rm-fade-in_.2s_ease_both]"
          (click)="cerrarImagen()"
        >
          <button
            (click)="cerrarImagen()"
            class="absolute top-5 right-5 text-white/70 hover:text-white transition-colors"
            aria-label="Cerrar imagen"
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
            </svg>
          </button>
          <img
            [src]="imagenAmpliada"
            (click)="$event.stopPropagation()"
            class="max-w-[90vw] max-h-[85vh] rounded-xl object-contain shadow-2xl"
            alt="zapato ampliado"
          />
        </div>
      </div>
    </div>
  `,
})
export class ReposicionModalComponent implements OnInit, OnDestroy {
  @Input() nombreUsuario = '';

  mostrar = false;
  alertas: AlertaReposicion[] = [];
  imagenAmpliada: string | null = null;
  private subs = new Subscription();

  constructor(
    private modalService: ReposicionModalService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.subs.add(
      this.modalService.mostrar$.subscribe((v) => {
        this.mostrar = v;
        this.cdr.markForCheck();
      }),
    );
    this.subs.add(
      this.modalService.alertas$.subscribe((a) => {
        this.alertas = a;
        this.cdr.markForCheck();
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  cerrar(): void {
    this.modalService.cerrar();
  }

  verImagen(url: string, event: MouseEvent): void {
    event.stopPropagation();
    if (!url) return;
    this.imagenAmpliada = url;
  }

  cerrarImagen(): void {
    this.imagenAmpliada = null;
  }

  urgenciaColor(u: AlertaReposicion['urgencia']): string {
    return u === 'critica'
      ? 'text-red-600 dark:text-red-400'
      : u === 'alta'
        ? 'text-orange-600 dark:text-orange-400'
        : 'text-amber-600 dark:text-amber-400';
  }
}
