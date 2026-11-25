import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';

/**
 * Loader de IA: en lugar de un círculo girando, muestra a la IA "trabajando".
 *
 *  · `seccion` / `pagina`: un panel con la insignia ✦ brillando, el título con destello,
 *    pasos que se van completando (✓) y barras de esqueleto. Si solo hay un mensaje, muestra
 *    el título y el esqueleto.
 *  · `compacto`: una píldora de una línea (insignia + texto con destello). Sirve para
 *    superponer sobre pantallas o dentro de botones grandes.
 *
 *   <app-ia-loader mensaje="Cargando ventas…" />
 *   <app-ia-loader [mensajes]="['Leyendo ventas…', 'Comparando inventario…', 'Casi listo…']" />
 *   <app-ia-loader variante="compacto" mensaje="Un momento…" />
 *
 * Hereda el color del texto del contenedor (funciona en modo claro y oscuro).
 */
@Component({
  selector: 'app-ia-loader',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (variante === 'compacto') {
      <div class="pil" role="status" aria-live="polite">
        <span class="insignia insignia--mini" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path
              class="estrella"
              d="M12 3c.5 4.6 4.4 8.5 9 9-4.6.5-8.5 4.4-9 9-.5-4.6-4.4-8.5-9-9 4.6-.5 8.5-4.4 9-9Z"
            />
          </svg>
        </span>
        <span class="destello pil-texto">{{ titulo }}</span>
      </div>
    } @else {
      <div
        class="panel"
        [class.panel--pagina]="variante === 'pagina'"
        role="status"
        aria-live="polite"
      >
        <div class="cabecera">
          <span class="insignia" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                class="estrella"
                d="M11 4c.55 4.7 3.3 7.45 8 8-4.7.55-7.45 3.3-8 8-.55-4.7-3.3-7.45-8-8 4.7-.55 7.45-3.3 8-8Z"
              />
              <path
                class="chispa chispa--a"
                d="M19.5 1.2c.2 1.5 1.1 2.4 2.6 2.6-1.5.2-2.4 1.1-2.6 2.6-.2-1.5-1.1-2.4-2.6-2.6 1.5-.2 2.4-1.1 2.6-2.6Z"
              />
              <path
                class="chispa chispa--b"
                d="M20 17.5c.15 1.1.9 1.85 2 2-1.1.15-1.85.9-2 2-.15-1.1-.9-1.85-2-2 1.1-.15 1.85-.9 2-2Z"
              />
            </svg>
          </span>
          <div class="cabecera-texto">
            @for (t of [titulo]; track t) {
              <p class="titulo destello">{{ t }}</p>
            }
            @if (detalle) {
              <p class="detalle">{{ detalle }}</p>
            }
          </div>
          <span class="etiqueta">IA</span>
        </div>

        @if (pasos.length > 1) {
          <ul class="pasos">
            @for (p of pasos; track p; let i = $index) {
              <li
                class="paso"
                [class.paso--hecho]="i < paso"
                [class.paso--activo]="i === paso"
                [class.paso--espera]="i > paso"
              >
                <span class="marca" aria-hidden="true">
                  @if (i < paso) {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  }
                </span>
                <span class="paso-texto">{{ p }}</span>
              </li>
            }
          </ul>
        }

        <div class="esqueleto" aria-hidden="true">
          <span class="barra" style="width: 92%"></span>
          <span class="barra" style="width: 78%"></span>
          <span class="barra" style="width: 54%"></span>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        --acento: #f59e0b;
        --acento-claro: #fcd34d;
        --acento-fondo: color-mix(in srgb, #f59e0b 14%, transparent);
      }

      /* ───────── Insignia con la estrella de IA ───────── */
      .insignia {
        position: relative;
        flex-shrink: 0;
        display: grid;
        place-items: center;
        width: 2.6rem;
        height: 2.6rem;
        border-radius: 0.85rem;
        color: #1c1304;
        background: linear-gradient(135deg, var(--acento-claro), var(--acento));
        box-shadow:
          0 0 0 1px color-mix(in srgb, var(--acento) 55%, transparent),
          0 6px 20px color-mix(in srgb, var(--acento) 38%, transparent);
        animation: brillo 2.2s ease-in-out infinite;
        overflow: visible;
      }
      .insignia svg {
        width: 68%;
        height: 68%;
        overflow: visible;
      }
      .insignia--mini {
        width: 1.35rem;
        height: 1.35rem;
        border-radius: 0.45rem;
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--acento) 55%, transparent);
      }
      .insignia--mini svg {
        width: 74%;
        height: 74%;
      }
      .estrella,
      .chispa {
        transform-box: fill-box;
        transform-origin: center;
      }
      .estrella {
        animation: respirar 1.8s ease-in-out infinite;
      }
      .chispa {
        opacity: 0;
        animation: titilar 1.8s ease-in-out infinite;
      }
      .chispa--a {
        animation-delay: 0.2s;
      }
      .chispa--b {
        animation-delay: 0.95s;
      }

      /* ───────── Panel (sección / pantalla) ───────── */
      .panel {
        width: min(100%, 26rem);
        margin: 1.5rem auto;
        padding: 1.1rem 1.15rem 1.25rem;
        border-radius: 1.15rem;
        background: color-mix(in srgb, currentColor 4%, transparent);
        border: 1px solid color-mix(in srgb, currentColor 11%, transparent);
        backdrop-filter: blur(8px);
        animation: entrar 0.4s ease both;
      }
      .panel--pagina {
        margin-top: 18vh;
      }
      .cabecera {
        display: flex;
        align-items: center;
        gap: 0.8rem;
      }
      .cabecera-texto {
        flex: 1;
        min-width: 0;
      }
      .titulo {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 650;
        letter-spacing: -0.01em;
        animation: entrar 0.35s ease both;
      }
      .detalle {
        margin: 0.15rem 0 0;
        font-size: 0.76rem;
        opacity: 0.55;
      }
      .etiqueta {
        flex-shrink: 0;
        padding: 0.15rem 0.45rem;
        border-radius: 9999px;
        font-size: 0.62rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        color: color-mix(in srgb, var(--acento) 85%, currentColor);
        background: var(--acento-fondo);
        border: 1px solid color-mix(in srgb, var(--acento) 35%, transparent);
      }

      /* ───────── Pasos ───────── */
      .pasos {
        list-style: none;
        margin: 1rem 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .paso {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        font-size: 0.82rem;
        transition:
          opacity 0.35s ease,
          transform 0.35s ease;
      }
      .marca {
        position: relative;
        flex-shrink: 0;
        display: grid;
        place-items: center;
        width: 1.1rem;
        height: 1.1rem;
        border-radius: 9999px;
        border: 1.5px solid color-mix(in srgb, currentColor 28%, transparent);
        transition: all 0.3s ease;
      }
      .marca svg {
        width: 70%;
        height: 70%;
      }
      .paso--espera {
        opacity: 0.38;
      }
      .paso--activo {
        font-weight: 600;
      }
      .paso--activo .marca {
        border-color: var(--acento);
        background: var(--acento-fondo);
      }
      .paso--activo .marca::after {
        content: '';
        width: 0.4rem;
        height: 0.4rem;
        border-radius: 9999px;
        background: var(--acento);
        animation: latir 1s ease-in-out infinite;
      }
      .paso--hecho {
        opacity: 0.72;
      }
      .paso--hecho .marca {
        border-color: transparent;
        color: #1c1304;
        background: linear-gradient(135deg, var(--acento-claro), var(--acento));
      }

      /* ───────── Esqueleto ───────── */
      .esqueleto {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-top: 1.1rem;
      }
      .barra {
        position: relative;
        height: 0.55rem;
        border-radius: 9999px;
        overflow: hidden;
        background: color-mix(in srgb, currentColor 8%, transparent);
      }
      .barra::after {
        content: '';
        position: absolute;
        inset: 0;
        transform: translateX(-100%);
        background: linear-gradient(
          90deg,
          transparent,
          color-mix(in srgb, var(--acento) 38%, transparent),
          transparent
        );
        animation: barrido 1.7s ease-in-out infinite;
      }
      .barra:nth-child(2)::after {
        animation-delay: 0.2s;
      }
      .barra:nth-child(3)::after {
        animation-delay: 0.4s;
      }

      /* ───────── Píldora compacta ───────── */
      .pil {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        padding: 0.3rem 0.8rem 0.3rem 0.4rem;
        border-radius: 9999px;
        background: color-mix(in srgb, currentColor 6%, transparent);
        border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
      }
      .pil-texto {
        font-size: 0.82rem;
        font-weight: 600;
        white-space: nowrap;
      }

      /* Destello que recorre el texto sin cambiarle el color */
      .destello {
        -webkit-mask-image: linear-gradient(
          100deg,
          rgba(0, 0, 0, 0.5) 20%,
          #000 50%,
          rgba(0, 0, 0, 0.5) 80%
        );
        mask-image: linear-gradient(
          100deg,
          rgba(0, 0, 0, 0.5) 20%,
          #000 50%,
          rgba(0, 0, 0, 0.5) 80%
        );
        -webkit-mask-size: 250% 100%;
        mask-size: 250% 100%;
        animation: destello 2.2s ease-in-out infinite;
      }

      @keyframes brillo {
        0%,
        100% {
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--acento) 55%, transparent),
            0 4px 14px color-mix(in srgb, var(--acento) 25%, transparent);
        }
        50% {
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--acento) 80%, transparent),
            0 6px 26px color-mix(in srgb, var(--acento) 55%, transparent);
        }
      }
      @keyframes respirar {
        0%,
        100% {
          transform: scale(0.8);
        }
        50% {
          transform: scale(1.08);
        }
      }
      @keyframes titilar {
        0%,
        100% {
          opacity: 0;
          transform: scale(0.2);
        }
        40% {
          opacity: 1;
          transform: scale(1);
        }
        70% {
          opacity: 0;
          transform: scale(0.6);
        }
      }
      @keyframes latir {
        0%,
        100% {
          transform: scale(0.7);
          opacity: 0.6;
        }
        50% {
          transform: scale(1.2);
          opacity: 1;
        }
      }
      @keyframes barrido {
        to {
          transform: translateX(100%);
        }
      }
      @keyframes destello {
        from {
          -webkit-mask-position: 120% 0;
          mask-position: 120% 0;
        }
        to {
          -webkit-mask-position: -20% 0;
          mask-position: -20% 0;
        }
      }
      @keyframes entrar {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .insignia,
        .estrella,
        .chispa,
        .barra::after,
        .destello,
        .paso--activo .marca::after {
          animation-duration: 5s;
        }
      }
    `,
  ],
})
export class IaLoaderComponent implements OnInit, OnChanges, OnDestroy {
  /** Mensaje fijo (título). */
  @Input() mensaje = 'Cargando…';
  /**
   * Varios mensajes: se muestran como pasos que se van completando (✓) mientras carga.
   * El último queda activo hasta que termine la carga.
   */
  @Input() mensajes: string[] = [];
  /** Texto pequeño debajo del título. */
  @Input() detalle = '';
  /** `pagina` lo baja un poco para pantallas completas; `compacto` es una píldora. */
  @Input() variante: 'pagina' | 'seccion' | 'compacto' = 'seccion';

  titulo = this.mensaje;
  pasos: string[] = [];
  paso = 0;

  private reloj: ReturnType<typeof setInterval> | null = null;
  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.reiniciar();
  }

  ngOnChanges(): void {
    this.reiniciar();
  }

  private reiniciar(): void {
    this.detenerReloj();
    this.paso = 0;
    this.pasos = this.mensajes ?? [];

    if (this.pasos.length > 1) {
      this.titulo = this.pasos[0];
      this.reloj = setInterval(() => {
        if (this.paso < this.pasos.length - 1) {
          this.paso++;
          this.titulo = this.pasos[this.paso];
          this.cdr.markForCheck();
        } else {
          this.detenerReloj();
        }
      }, 1900);
    } else {
      this.titulo = this.pasos[0] ?? this.mensaje;
    }
  }

  private detenerReloj(): void {
    if (this.reloj) clearInterval(this.reloj);
    this.reloj = null;
  }

  ngOnDestroy(): void {
    this.detenerReloj();
  }
}
