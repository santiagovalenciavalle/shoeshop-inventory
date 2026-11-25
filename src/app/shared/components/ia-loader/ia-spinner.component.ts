import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Indicador de IA para botones y textos: una estrella ✦ que "respira" (crece y se apaga
 * suavemente) con dos chispas que titilan a su alrededor. No gira.
 * Toma el color del texto (`currentColor`): ponle el tamaño (`w-4 h-4`) y `text-…`.
 */
@Component({
  selector: 'app-ia-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path
        class="s-main"
        d="M11 4c.55 4.7 3.3 7.45 8 8-4.7.55-7.45 3.3-8 8-.55-4.7-3.3-7.45-8-8 4.7-.55 7.45-3.3 8-8Z"
      />
      <path
        class="s-chispa s-a"
        d="M19.5 1.2c.2 1.5 1.1 2.4 2.6 2.6-1.5.2-2.4 1.1-2.6 2.6-.2-1.5-1.1-2.4-2.6-2.6 1.5-.2 2.4-1.1 2.6-2.6Z"
      />
      <path
        class="s-chispa s-b"
        d="M20 17.5c.15 1.1.9 1.85 2 2-1.1.15-1.85.9-2 2-.15-1.1-.9-1.85-2-2 1.1-.15 1.85-.9 2-2Z"
      />
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-block;
        line-height: 0;
        flex-shrink: 0;
        vertical-align: middle;
      }
      /* Tamaño por defecto con la prioridad más baja: cualquier w-/h- o text-* lo reemplaza */
      @layer base {
        :host {
          width: 1em;
          height: 1em;
        }
      }
      svg {
        width: 100%;
        height: 100%;
        overflow: visible;
      }
      .s-main,
      .s-chispa {
        transform-box: fill-box;
        transform-origin: center;
      }
      .s-main {
        animation: ia-respirar 1.5s ease-in-out infinite;
      }
      .s-chispa {
        opacity: 0;
        animation: ia-titilar 1.5s ease-in-out infinite;
      }
      .s-a {
        animation-delay: 0.15s;
      }
      .s-b {
        animation-delay: 0.8s;
      }
      @keyframes ia-respirar {
        0%,
        100% {
          transform: scale(0.72);
          opacity: 0.55;
        }
        50% {
          transform: scale(1.1);
          opacity: 1;
        }
      }
      @keyframes ia-titilar {
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
      @media (prefers-reduced-motion: reduce) {
        .s-main,
        .s-chispa {
          animation-duration: 3.5s;
        }
      }
    `,
  ],
})
export class IaSpinnerComponent {}
