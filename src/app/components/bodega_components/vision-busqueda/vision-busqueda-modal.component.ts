import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Products, User } from '../../../pages/interfaces';
import {
  ProductoCoincidencia,
  VisionBusquedaService,
  VisionResultado,
} from '../../../services/administracion/ia/vision-busqueda.service';
import { IaGatewayService } from '../../../services/administracion/ia/ia-gateway.service';
import { AuthService } from '../../../services/auth/auth.service';

import { IaSpinnerComponent } from '../../../shared/components/ia-loader/ia-spinner.component';
type SearchPhase = 'idle' | 'analyzing' | 'searching-web' | 'done' | 'error';

interface WebResult {
  titulo: string;
  url: string;
  descripcion: string;
  marca?: string;
  modelo?: string;
}

@Component({
  selector: 'app-vision-busqueda-modal',
  standalone: true,
  imports: [
    IaSpinnerComponent,CommonModule],
  styles: [
    `
      .overlay {
        position: fixed;
        inset: 0;
        z-index: 9000;
        background: rgba(0, 0, 0, 0.72);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        display: flex;
        align-items: flex-end;
        justify-content: center;
        animation: fadeIn 0.22s ease both;
      }
      @media (min-width: 640px) {
        .overlay {
          align-items: center;
        }
      }
      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      .sheet {
        width: 100%;
        max-width: 680px;
        max-height: 92dvh;
        background: #0e0e10;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 28px 28px 0 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: sheetUp 0.3s cubic-bezier(0.32, 1, 0.23, 1) both;
      }
      @media (min-width: 640px) {
        .sheet {
          border-radius: 24px;
          margin: 0 16px;
        }
      }
      @keyframes sheetUp {
        from {
          transform: translateY(100%);
        }
        to {
          transform: none;
        }
      }

      .handle {
        width: 36px;
        height: 4px;
        border-radius: 2px;
        background: rgba(255, 255, 255, 0.12);
        margin: 14px auto 0;
        flex-shrink: 0;
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px 12px;
        flex-shrink: 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }
      .header-left {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .header-eyebrow {
        font-size: 0.58rem;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: rgba(242, 237, 228, 0.3);
        font-family: 'Space Mono', monospace;
      }
      .header-title {
        font-size: 1rem;
        font-weight: 600;
        color: #f2ede4;
      }
      .close-btn {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.07);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: rgba(242, 237, 228, 0.5);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s;
        flex-shrink: 0;
        touch-action: manipulation;
      }
      .close-btn:hover {
        background: rgba(255, 255, 255, 0.12);
      }
      .close-btn:focus-visible {
        outline: 2px solid #c8a951;
      }
      .close-btn svg {
        width: 13px;
        height: 13px;
      }

      .body {
        flex: 1;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 16px 20px 28px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .upload-zone {
        border: 1.5px dashed rgba(200, 169, 81, 0.35);
        border-radius: 18px;
        background: rgba(200, 169, 81, 0.04);
        padding: 28px 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        transition:
          border-color 0.2s,
          background 0.2s;
        position: relative;
        touch-action: manipulation;
      }
      .upload-zone:hover {
        border-color: #c8a951;
        background: rgba(200, 169, 81, 0.07);
      }
      .upload-zone input[type='file'] {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
        width: 100%;
        height: 100%;
      }
      .upload-icon {
        width: 52px;
        height: 52px;
        border-radius: 16px;
        background: rgba(200, 169, 81, 0.1);
        border: 1px solid rgba(200, 169, 81, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .upload-icon svg {
        width: 22px;
        height: 22px;
        color: #c8a951;
      }
      .upload-title {
        font-size: 0.9rem;
        font-weight: 600;
        color: #f2ede4;
      }
      .upload-sub {
        font-size: 0.75rem;
        color: rgba(242, 237, 228, 0.35);
        text-align: center;
      }
      .camera-btns {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: center;
      }
      .camera-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 9px 16px;
        border-radius: 50px;
        border: 1px solid rgba(200, 169, 81, 0.3);
        background: transparent;
        color: #c8a951;
        font-size: 0.75rem;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.18s;
        touch-action: manipulation;
        position: relative;
        overflow: hidden;
      }
      .camera-btn svg {
        width: 14px;
        height: 14px;
        flex-shrink: 0;
      }
      .camera-btn input[type='file'] {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
      }
      .camera-btn:hover {
        background: rgba(200, 169, 81, 0.08);
      }
      .camera-btn:focus-visible {
        outline: 2px solid #c8a951;
      }

      .preview-wrap {
        position: relative;
        border-radius: 16px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.07);
        aspect-ratio: 4/3;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .preview-wrap img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .preview-clear {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        touch-action: manipulation;
      }
      .preview-clear svg {
        width: 12px;
        height: 12px;
      }

      .analyze-btn {
        width: 100%;
        padding: 15px;
        background: #c8a951;
        color: #09090b;
        border: none;
        border-radius: 14px;
        font-family: 'Bebas Neue', sans-serif;
        font-size: 1.05rem;
        letter-spacing: 0.14em;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.2s;
        touch-action: manipulation;
      }
      .analyze-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }
      .analyze-btn:hover:not(:disabled) {
        box-shadow: 0 6px 24px rgba(200, 169, 81, 0.28);
        transform: translateY(-1px);
      }
      .analyze-btn svg {
        width: 17px;
        height: 17px;
      }

      .phase-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
      }
      .phase-icon {
        width: 32px;
        height: 32px;
        border-radius: 9px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .phase-icon svg {
        width: 15px;
        height: 15px;
      }
      .phase-icon--ai {
        background: rgba(200, 169, 81, 0.1);
      }
      .phase-icon--ai svg {
        color: #c8a951;
      }
      .phase-icon--web {
        background: rgba(129, 140, 248, 0.1);
      }
      .phase-icon--web svg {
        color: #818cf8;
      }
      .phase-icon--done {
        background: rgba(74, 222, 128, 0.1);
      }
      .phase-icon--done svg {
        color: #4ade80;
      }
      .phase-text {
        flex: 1;
      }
      .phase-label {
        font-size: 0.8rem;
        font-weight: 500;
        color: #f2ede4;
      }
      .phase-sub {
        font-size: 0.68rem;
        color: rgba(242, 237, 228, 0.4);
        margin-top: 1px;
      }
      .spinner {
        width: 18px;
        height: 18px;
        border: 2px solid rgba(200, 169, 81, 0.2);
        border-top-color: #c8a951;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
        flex-shrink: 0;
      }
      .spinner--violet {
        border: 2px solid rgba(129, 140, 248, 0.2);
        border-top-color: #818cf8;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .vision-pill {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 14px;
        border-radius: 12px;
        background: rgba(200, 169, 81, 0.05);
        border: 1px solid rgba(200, 169, 81, 0.2);
      }
      .vision-pill__icon {
        font-size: 0.9rem;
        margin-top: 2px;
        flex-shrink: 0;
      }
      .vision-pill__content {
        flex: 1;
        min-width: 0;
      }
      .vision-pill__marca {
        font-size: 0.82rem;
        font-weight: 700;
        color: #c8a951;
        margin-bottom: 2px;
      }
      .vision-pill__desc {
        font-size: 0.72rem;
        color: rgba(242, 237, 228, 0.55);
        line-height: 1.5;
      }
      .tags-row {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 6px;
      }
      .tag {
        padding: 2px 8px;
        border-radius: 50px;
        font-size: 0.58rem;
        letter-spacing: 0.04em;
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: rgba(242, 237, 228, 0.5);
        background: rgba(255, 255, 255, 0.03);
      }

      .sec-heading {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .sec-heading__dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .sec-heading__dot--gold {
        background: #c8a951;
      }
      .sec-heading__dot--violet {
        background: #818cf8;
      }
      .sec-heading__label {
        font-size: 0.58rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: rgba(242, 237, 228, 0.35);
        font-family: 'Space Mono', monospace;
      }
      .sec-heading__count {
        margin-left: auto;
        font-family: 'Space Mono', monospace;
        font-size: 0.52rem;
        color: rgba(242, 237, 228, 0.3);
      }

      .match-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .match-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.025);
        border: 1px solid rgba(255, 255, 255, 0.06);
        cursor: pointer;
        transition:
          border-color 0.18s,
          background 0.18s;
        touch-action: manipulation;
      }
      .match-card:hover {
        border-color: rgba(200, 169, 81, 0.28);
        background: rgba(200, 169, 81, 0.04);
      }
      .match-card:focus-visible {
        outline: 2px solid #c8a951;
        border-radius: 12px;
      }
      .match-thumb {
        width: 48px;
        height: 56px;
        border-radius: 9px;
        overflow: hidden;
        flex-shrink: 0;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.07);
      }
      .match-thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .match-thumb__ph {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(242, 237, 228, 0.2);
      }
      .match-thumb__ph svg {
        width: 18px;
        height: 18px;
      }
      .match-info {
        flex: 1;
        min-width: 0;
      }
      .match-name {
        font-size: 0.82rem;
        font-weight: 600;
        color: #f2ede4;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 3px;
      }
      .match-meta {
        font-size: 0.68rem;
        color: rgba(242, 237, 228, 0.38);
        margin-bottom: 4px;
      }
      .match-reason {
        font-size: 0.62rem;
        color: rgba(200, 169, 81, 0.7);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .match-badges {
        display: flex;
        gap: 5px;
        align-items: center;
        flex-wrap: wrap;
        margin-top: 4px;
      }
      .badge-stock {
        font-size: 0.55rem;
        padding: 2px 7px;
        border-radius: 50px;
        font-family: 'Space Mono', monospace;
        border: 1px solid;
      }
      .badge-stock--ok {
        background: rgba(74, 222, 128, 0.07);
        border-color: rgba(74, 222, 128, 0.2);
        color: #4ade80;
      }
      .badge-stock--out {
        background: rgba(248, 113, 113, 0.06);
        border-color: rgba(248, 113, 113, 0.15);
        color: #f87171;
      }
      .match-score {
        font-family: 'Bebas Neue', sans-serif;
        font-size: 1rem;
        color: #c8a951;
        flex-shrink: 0;
      }
      .select-btn {
        flex-shrink: 0;
        padding: 5px 11px;
        border-radius: 8px;
        border: 1px solid rgba(200, 169, 81, 0.3);
        background: transparent;
        color: #c8a951;
        font-size: 0.62rem;
        font-family: 'Space Mono', monospace;
        cursor: pointer;
        transition: background 0.15s;
        touch-action: manipulation;
        white-space: nowrap;
      }
      .select-btn:hover {
        background: rgba(200, 169, 81, 0.1);
      }

      .web-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .web-card {
        padding: 12px 14px;
        border-radius: 12px;
        background: rgba(129, 140, 248, 0.04);
        border: 1px solid rgba(129, 140, 248, 0.15);
      }
      .web-card__title {
        font-size: 0.8rem;
        font-weight: 600;
        color: #f2ede4;
        margin-bottom: 3px;
      }
      .web-card__badges {
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
        margin-bottom: 5px;
      }
      .web-badge {
        font-size: 0.55rem;
        padding: 2px 7px;
        border-radius: 50px;
        border: 1px solid rgba(129, 140, 248, 0.25);
        background: rgba(129, 140, 248, 0.07);
        color: #818cf8;
        font-family: 'Space Mono', monospace;
      }
      .web-card__desc {
        font-size: 0.7rem;
        color: rgba(242, 237, 228, 0.4);
        line-height: 1.5;
      }
      .web-card__link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.62rem;
        color: #818cf8;
        margin-top: 5px;
        text-decoration: none;
      }
      .web-card__link svg {
        width: 10px;
        height: 10px;
      }
      .web-card__link:hover {
        text-decoration: underline;
      }

      .empty-state {
        padding: 24px 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        text-align: center;
      }
      .empty-state__icon {
        width: 52px;
        height: 52px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.07);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .empty-state__icon svg {
        width: 22px;
        height: 22px;
        color: rgba(242, 237, 228, 0.25);
      }
      .empty-state__title {
        font-size: 0.85rem;
        font-weight: 600;
        color: rgba(242, 237, 228, 0.6);
      }
      .empty-state__sub {
        font-size: 0.72rem;
        color: rgba(242, 237, 228, 0.3);
        line-height: 1.5;
      }

      .error-banner {
        padding: 10px 14px;
        border-radius: 10px;
        background: rgba(248, 113, 113, 0.06);
        border: 1px solid rgba(248, 113, 113, 0.2);
        font-size: 0.75rem;
        color: #f87171;
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }
      .error-banner svg {
        width: 14px;
        height: 14px;
        flex-shrink: 0;
        margin-top: 1px;
      }

      .divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.06);
      }
    `,
  ],
  template: `
    @if (open) {
      <div class="overlay" (click)="onOverlayClick($event)">
        <div
          class="sheet"
          (click)="$event.stopPropagation()"
          role="dialog"
          aria-modal="true"
          aria-label="Buscar zapato por foto"
        >
          <div class="handle" aria-hidden="true"></div>

          <div class="header">
            <div class="header-left">
              <span class="header-eyebrow">IA Visual</span>
              <span class="header-title">Buscar por foto</span>
            </div>
            <button class="close-btn" (click)="cerrar()" aria-label="Cerrar">
              <svg
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="body">
            @if (!imagenPreview()) {
              <div
                class="upload-zone"
                role="button"
                tabindex="0"
                aria-label="Seleccionar imagen de galería"
              >
                <input
                  type="file"
                  accept="image/*"
                  (change)="onFileSelected($event)"
                  aria-label="Seleccionar desde galería"
                />
                <div class="upload-icon">
                  <svg
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
                <span class="upload-title">Sube una foto del zapato</span>
                <span class="upload-sub"
                  >Toca para elegir de tu galería<br />o usa los botones de
                  abajo</span
                >
              </div>

              <div class="camera-btns">
                <button class="camera-btn" aria-label="Tomar foto con cámara">
                  <svg
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path
                      d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
                    />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  Cámara
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    (change)="onFileSelected($event)"
                    aria-label="Tomar foto con cámara"
                  />
                </button>
                <button class="camera-btn" aria-label="Seleccionar de galería">
                  <svg
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="2" y="2" width="20" height="20" rx="3" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  Galería
                  <input
                    type="file"
                    accept="image/*"
                    (change)="onFileSelected($event)"
                    aria-label="Seleccionar de galería"
                  />
                </button>
              </div>
            }

            @if (imagenPreview()) {
              <div class="preview-wrap">
                <img [src]="imagenPreview()!" alt="Zapato a buscar" />
                @if (!isAnalyzing()) {
                  <button
                    class="preview-clear"
                    (click)="limpiar()"
                    aria-label="Eliminar imagen"
                  >
                    <svg
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                }
              </div>

              @if (phase() === 'idle' || phase() === 'error') {
                <button
                  class="analyze-btn"
                  (click)="analizar()"
                  [disabled]="isAnalyzing()"
                >
                  <svg
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  ANALIZAR ZAPATO
                </button>
              }
            }

            @if (errorMsg()) {
              <div class="error-banner" role="alert">
                <svg
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {{ errorMsg() }}
              </div>
            }

            @if (phase() === 'analyzing') {
              <div class="phase-row">
                <div class="phase-icon phase-icon--ai">
                  <svg
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                    <path d="M12 8v4l3 3" />
                  </svg>
                </div>
                <div class="phase-text">
                  <div class="phase-label">
                    Analizando con ShoeShop Inteligente AI…
                  </div>
                  <div class="phase-sub">
                    Identificando marca, modelo y características
                  </div>
                </div>
                <app-ia-spinner class="w-7 h-7 text-amber-500" aria-label="Cargando"></app-ia-spinner>
              </div>
            }

            @if (phase() === 'searching-web') {
              <div class="phase-row">
                <div class="phase-icon phase-icon--web">
                  <svg
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path
                      d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"
                    />
                  </svg>
                </div>
                <div class="phase-text">
                  <div class="phase-label">Buscando en internet…</div>
                  <div class="phase-sub">Consultando referencias externas</div>
                </div>
                <app-ia-spinner class="w-7 h-7 text-violet-500" aria-label="Cargando"></app-ia-spinner>
              </div>
            }

            @if (
              visionResult() &&
              (phase() === 'done' || phase() === 'searching-web')
            ) {
              <div class="vision-pill">
                <span class="vision-pill__icon">👟</span>
                <div class="vision-pill__content">
                  <div class="vision-pill__marca">
                    {{ visionResult()!.marca }} · {{ visionResult()!.tipo }}
                  </div>
                  <div class="vision-pill__desc">
                    {{ visionResult()!.textoCompleto }}
                  </div>
                  <div class="tags-row">
                    @for (
                      d of visionResult()!.descriptores.slice(0, 4);
                      track d
                    ) {
                      <span class="tag">{{ d }}</span>
                    }
                    @for (c of visionResult()!.colores.slice(0, 2); track c) {
                      <span class="tag">{{ c }}</span>
                    }
                  </div>
                </div>
              </div>
            }

            @if (phase() === 'done' || phase() === 'searching-web') {
              <div>
                <div class="sec-heading">
                  <div class="sec-heading__dot sec-heading__dot--gold"></div>
                  <span class="sec-heading__label"
                    >Coincidencias en inventario</span
                  >
                  <span class="sec-heading__count"
                    >{{ matches().length }} resultado{{
                      matches().length !== 1 ? 's' : ''
                    }}</span
                  >
                </div>

                @if (matches().length > 0) {
                  <div class="match-list">
                    @for (m of matches(); track m.producto.id) {
                      <div
                        class="match-card"
                        (click)="seleccionarProducto(m.producto)"
                        [attr.tabindex]="0"
                        [attr.role]="'button'"
                        [attr.aria-label]="
                          'Seleccionar ' +
                          m.producto.marca +
                          ' ' +
                          m.producto.referencia
                        "
                        (keydown.enter)="seleccionarProducto(m.producto)"
                      >
                        <div class="match-thumb">
                          @if (m.producto.imagen) {
                            <img
                              [src]="m.producto.imagen"
                              [alt]="
                                m.producto.marca + ' ' + m.producto.referencia
                              "
                            />
                          } @else {
                            <div class="match-thumb__ph">
                              <svg
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                stroke-width="1.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                aria-hidden="true"
                              >
                                <rect
                                  x="2"
                                  y="3"
                                  width="20"
                                  height="14"
                                  rx="2"
                                />
                              </svg>
                            </div>
                          }
                        </div>
                        <div class="match-info">
                          <div class="match-name">
                            {{ m.producto.marca }} · {{ m.producto.referencia }}
                          </div>
                          <div class="match-meta">Cód. {{ m.producto.id }}</div>
                          <div class="match-reason">{{ m.razon }}</div>
                          <div class="match-badges">
                            @if ((m.producto.stock ?? 0) > 0) {
                              <span class="badge-stock badge-stock--ok"
                                >Stock {{ m.producto.stock }}</span
                              >
                            } @else {
                              <span class="badge-stock badge-stock--out"
                                >Agotado</span
                              >
                            }
                          </div>
                        </div>
                        @if (User.role === 'admin') {
                          <button
                            class="select-btn"
                            (click)="
                              $event.stopPropagation();
                              seleccionarProducto(m.producto)
                            "
                            aria-label="Ver producto"
                          >
                            Ver
                          </button>
                        }
                      </div>
                    }
                  </div>
                } @else {
                  <div class="empty-state">
                    <div class="empty-state__icon">
                      <svg
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                        <line x1="8" y1="11" x2="14" y2="11" />
                      </svg>
                    </div>
                    <p class="empty-state__title">
                      Sin coincidencias en inventario
                    </p>
                    <p class="empty-state__sub">
                      No encontramos productos similares.<br />Revisa los
                      resultados de internet.
                    </p>
                  </div>
                }
              </div>
            }

            @if (phase() === 'done' && webResults().length > 0) {
              <div class="divider"></div>
              <div>
                <div class="sec-heading">
                  <div class="sec-heading__dot sec-heading__dot--violet"></div>
                  <span class="sec-heading__label"
                    >Referencias en internet</span
                  >
                  <span class="sec-heading__count">{{
                    webResults().length
                  }}</span>
                </div>
                <div class="web-list">
                  @for (r of webResults(); track r.url) {
                    <div class="web-card">
                      <div class="web-card__title">{{ r.titulo }}</div>
                      <div class="web-card__badges">
                        @if (r.marca) {
                          <span class="web-badge">{{ r.marca }}</span>
                        }
                        @if (r.modelo) {
                          <span class="web-badge">{{ r.modelo }}</span>
                        }
                      </div>
                      <div class="web-card__desc">{{ r.descripcion }}</div>
                      @if (r.url) {
                        <a
                          [href]="r.url"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="web-card__link"
                          aria-label="Ver en internet"
                        >
                          Ver referencia
                          <svg
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                          >
                            <path
                              d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"
                            />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                      }
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class VisionBusquedaModalComponent implements OnDestroy {
  @Input() open = false;
  @Input() productos: Products[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() productoSeleccionado = new EventEmitter<Products>();

  imagenPreview = signal<string | null>(null);
  imagenBase64 = signal<string | null>(null);
  phase = signal<SearchPhase>('idle');
  errorMsg = signal<string | null>(null);
  visionResult = signal<VisionResultado | null>(null);
  matches = signal<ProductoCoincidencia[]>([]);
  webResults = signal<WebResult[]>([]);
  User: any = '';
  isAnalyzing = computed(
    () => this.phase() === 'analyzing' || this.phase() === 'searching-web',
  );

  ngOnInit(): void {
    this.User = this.authService.getCurrentUser();
  }

  private subs = new Subscription();

  constructor(
    private visionService: VisionBusquedaService,
    private authService: AuthService,
    private gateway: IaGatewayService,
  ) {}

  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.limpiarResultados();

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      this.imagenPreview.set(result);
      this.imagenBase64.set(result);
    };
    reader.readAsDataURL(file);
  }

  async analizar(): Promise<void> {
    const base64 = this.imagenBase64();
    if (!base64) return;

    this.errorMsg.set(null);
    this.visionResult.set(null);
    this.matches.set([]);
    this.webResults.set([]);

    this.phase.set('analyzing');
    let resultado: VisionResultado;
    try {
      resultado = await this.visionService.analizarImagen(base64);
      this.visionResult.set(resultado);
    } catch (e: any) {
      this.phase.set('error');
      this.errorMsg.set(e?.message ?? 'Error al analizar la imagen con IA.');
      return;
    }

    const coincidencias = this.visionService.filtrarProductos(
      this.productos,
      resultado,
    );
    this.matches.set(coincidencias);

    this.phase.set('searching-web');
    try {
      const webRes = await this.buscarEnInternet(resultado);
      this.webResults.set(webRes);
    } catch (e) {
      this.webResults.set([]);
    }

    this.phase.set('done');
  }

  private async buscarEnInternet(
    resultado: VisionResultado,
  ): Promise<WebResult[]> {
    const query = [
      resultado.marca !== 'Desconocida' ? resultado.marca : '',
      resultado.descriptores.slice(0, 2).join(' '),
      resultado.colores.slice(0, 1).join(' '),
      resultado.tipo,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (!query) return [];

    try {
      const texto = await this.gateway.texto('busquedaWeb', {
        temperature: 0.3,
        max_tokens: 800,
        json: true,
        messages: [
          {
            role: 'system',
            content:
              'Eres un experto en calzado. Cuando te den una descripción de un zapato, devuelves SOLO JSON válido con información de esa referencia en el mercado.',
          },
          {
            role: 'user',
            content: `Dame información de este zapato: "${query}".
Responde SOLO JSON, sin explicaciones:
{
  "resultados": [
    {
      "titulo": "nombre exacto del modelo",
      "marca": "marca",
      "modelo": "modelo",
      "descripcion": "descripción en español de 1-2 oraciones sobre este zapato",
      "url": "URL real de referencia (Nike.com, Adidas.com, etc)"
    }
  ]
}
Incluye hasta 3 resultados. Si no conoces el modelo exacto, devuelve {"resultados": []}.`,
          },
        ],
      });
      const jsonMatch = texto.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      return (parsed.resultados ?? []) as WebResult[];
    } catch {
      return [];
    }
  }

  seleccionarProducto(producto: Products): void {
    this.productoSeleccionado.emit(producto);
    this.cerrar();
  }

  limpiar(): void {
    this.imagenPreview.set(null);
    this.imagenBase64.set(null);
    this.limpiarResultados();
  }

  private limpiarResultados(): void {
    this.phase.set('idle');
    this.errorMsg.set(null);
    this.visionResult.set(null);
    this.matches.set([]);
    this.webResults.set([]);
    this.visionService.limpiar();
  }

  cerrar(): void {
    this.limpiar();
    this.closed.emit();
  }

  onOverlayClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('overlay')) {
      this.cerrar();
    }
  }
}
