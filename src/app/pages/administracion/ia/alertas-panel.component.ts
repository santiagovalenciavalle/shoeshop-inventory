import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  AlertasIaService,
  ResumenAlertas,
} from '../../../services/administracion/ia/alertas-ia.service';
import {
  RankingSemanalService,
  RankingSemana,
} from '../../../services/administracion/ia/ranking-semanal.service';

@Component({
  selector: 'app-alertas-panel',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <button
      *ngIf="!mostrarAlertas && resumen"
      (click)="mostrarAlertas = true"
      class="si-trigger"
      aria-label="Abrir Smart Insights"
    >
      <span class="si-trigger__spark" aria-hidden="true">✦</span>
      <span>Smart Insights</span>
      <span
        class="si-trigger__pill"
        [class.si-trigger__pill--active]="resumen.totalAlertas > 0"
        >{{ resumen.totalAlertas }}</span
      >
    </button>

    <div
      class="si-panel"
      *ngIf="mostrarAlertas"
      role="region"
      aria-label="ShoeShop IA"
    >
      <div class="si-panel__head">
        <span class="si-panel__spark" aria-hidden="true">✦</span>
        <h2 class="si-panel__title">ShoeShop IA</h2>
        <div class="si-panel__head-actions">
          <button
            (click)="actualizarAlertas()"
            class="si-icon-btn"
            aria-label="Actualizar"
            title="Actualizar"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <button
            (click)="mostrarAlertas = false"
            class="si-icon-btn"
            aria-label="Cerrar panel"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div *ngIf="cargando" class="si-loading">
        <div class="si-dot"></div>
        <div class="si-dot si-dot--2"></div>
        <div class="si-dot si-dot--3"></div>
        <span>Analizando el negocio...</span>
      </div>

      <div *ngIf="!cargando && resumen" class="si-body">
        <div class="si-card si-card--accent">
          <div class="si-card__label">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <rect x="3" y="8" width="18" height="12" rx="3" />
              <path d="M8 8V6a4 4 0 018 0v2" />
              <circle cx="9" cy="14" r="1.2" fill="currentColor" />
              <circle cx="15" cy="14" r="1.2" fill="currentColor" />
              <path d="M9 17.5h6" stroke-linecap="round" />
            </svg>
            Resumen IA
          </div>
          <p
            class="si-card__body"
            [innerHTML]="formatearTexto(resumen.mensajeIA)"
          ></p>
          <div class="si-card__footer">
            <button
              *ngIf="!modoCompacto"
              (click)="mostrarRankingPanel = !mostrarRankingPanel"
              class="si-chip"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              Ranking semanal
            </button>
            <a
              *ngIf="modoCompacto"
              routerLink="/admin/ia"
              class="si-chip"
              style="text-decoration:none"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              Asistente IA
            </a>
          </div>
        </div>

        <ng-container *ngIf="resumen.totalAlertas > 0">
          <div
            *ngFor="let alerta of resumen.alertas"
            class="si-card"
            [ngClass]="{
              'si-card--info': alerta.nivel === 'info',
              'si-card--warning': alerta.nivel === 'warning',
              'si-card--danger': alerta.nivel === 'danger',
            }"
          >
            <div class="si-card__label">
              <span class="si-card__emoji" aria-hidden="true">{{
                iconoAlerta(alerta.tipo)
              }}</span>
              {{ alerta.titulo }}
              <span class="si-badge si-badge--{{ alerta.nivel }}">{{
                nivelLabel(alerta.nivel)
              }}</span>
            </div>
            <p class="si-card__body">{{ alerta.descripcion }}</p>
            <div class="si-card__bar" aria-hidden="true"></div>
          </div>
        </ng-container>

        <div *ngIf="resumen.totalAlertas === 0" class="si-card si-card--ok">
          <div class="si-card__label">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            Todo en orden hoy
          </div>
          <p class="si-card__body">Sin alertas activas en este momento.</p>
        </div>
      </div>
    </div>

    <div
      class="si-overlay"
      *ngIf="mostrarRankingPanel"
      (click)="mostrarRankingPanel = false"
      aria-hidden="true"
    ></div>

    <aside
      class="si-drawer"
      *ngIf="mostrarRankingPanel"
      role="dialog"
      aria-label="Ranking semanal"
    >
      <div class="si-drawer__head">
        <div class="si-drawer__head-left">
          <span class="si-panel__spark" aria-hidden="true">✦</span>
          <div>
            <h2 class="si-drawer__title">Ranking Semanal</h2>
            <p class="si-drawer__sub">Rendimiento del equipo</p>
          </div>
        </div>
        <button
          (click)="mostrarRankingPanel = false"
          class="si-icon-btn"
          aria-label="Cerrar ranking"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <div class="si-tabs" role="tablist">
        <button
          role="tab"
          [attr.aria-selected]="tabRanking === 'actual'"
          class="si-tab"
          [class.si-tab--active]="tabRanking === 'actual'"
          (click)="tabRanking = 'actual'; cargarRankingActual()"
        >
          Esta semana
        </button>
        <button
          role="tab"
          [attr.aria-selected]="tabRanking === 'historial'"
          class="si-tab"
          [class.si-tab--active]="tabRanking === 'historial'"
          (click)="tabRanking = 'historial'; cargarHistorial()"
        >
          Historial
        </button>
        <div
          class="si-tabs__line"
          [class.si-tabs__line--right]="tabRanking === 'historial'"
        ></div>
      </div>

      <div class="si-drawer__body">
        <ng-container *ngIf="tabRanking === 'actual'">
          <div *ngIf="rankingCargando" class="si-loading">
            <div class="si-dot"></div>
            <div class="si-dot si-dot--2"></div>
            <div class="si-dot si-dot--3"></div>
            <span>Generando ranking...</span>
          </div>

          <ng-container *ngIf="rankingActual && !rankingCargando">
            <div class="si-card si-card--accent">
              <div class="si-card__label">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                Análisis de la semana
              </div>
              <p
                class="si-card__body"
                [innerHTML]="formatearTexto(rankingActual.narrativa)"
              ></p>
            </div>

            <div class="si-stats">
              <div class="si-stat">
                <span class="si-stat__value">{{
                  rankingActual.totalVentasSemana
                }}</span>
                <span class="si-stat__label">Ventas</span>
              </div>
              <div class="si-stat__divider"></div>
              <div class="si-stat">
                <span class="si-stat__value si-stat__value--sm">
                  {{
                    rankingActual.totalIngresosSemana
                      | currency: 'COP' : 'symbol-narrow' : '1.0-0'
                  }}
                </span>
                <span class="si-stat__label">Ingresos</span>
              </div>
              <ng-container *ngIf="rankingActual.localMasActivo">
                <div class="si-stat__divider"></div>
                <div class="si-stat">
                  <span class="si-stat__value si-stat__value--sm"
                    >Local {{ rankingActual.localMasActivo.local }}</span
                  >
                  <span class="si-stat__label">Top local</span>
                </div>
              </ng-container>
            </div>

            <div class="si-podium" *ngIf="rankingActual.vendedores.length >= 3">
              <div class="si-podium__slot">
                <div class="si-podium__avatar si-podium__avatar--silver">
                  {{ rankingActual.vendedores[1].nombre.charAt(0) }}
                </div>
                <p class="si-podium__name">
                  {{ rankingActual.vendedores[1].nombre.split(' ')[0] }}
                </p>
                <p class="si-podium__sales">
                  {{ rankingActual.vendedores[1].ventas }} ventas
                </p>
                <div class="si-podium__bar si-podium__bar--silver">2°</div>
              </div>
              <div class="si-podium__slot si-podium__slot--center">
                <div class="si-podium__crown" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.5 19h19l-2-10-5 5-2.5-8L9.5 14l-5-5-2 10z" />
                  </svg>
                </div>
                <div
                  class="si-podium__avatar si-podium__avatar--gold si-podium__avatar--lg"
                >
                  {{ rankingActual.vendedores[0].nombre.charAt(0) }}
                </div>
                <p class="si-podium__name si-podium__name--bold">
                  {{ rankingActual.vendedores[0].nombre.split(' ')[0] }}
                </p>
                <p class="si-podium__sales">
                  {{ rankingActual.vendedores[0].ventas }} ventas
                </p>
                <div class="si-podium__bar si-podium__bar--gold">1°</div>
              </div>
              <div class="si-podium__slot">
                <div class="si-podium__avatar si-podium__avatar--bronze">
                  {{ rankingActual.vendedores[2].nombre.charAt(0) }}
                </div>
                <p class="si-podium__name">
                  {{ rankingActual.vendedores[2].nombre.split(' ')[0] }}
                </p>
                <p class="si-podium__sales">
                  {{ rankingActual.vendedores[2].ventas }} ventas
                </p>
                <div class="si-podium__bar si-podium__bar--bronze">3°</div>
              </div>
            </div>

            <div class="si-table-wrap">
              <table class="si-table" role="grid">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Vendedor</th>
                    <th scope="col">Ventas</th>
                    <th scope="col">Ingresos</th>
                    <th scope="col">P. Bajo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    *ngFor="let v of rankingActual.vendedores; let i = index"
                    [ngClass]="{
                      'si-table__row--gold': i === 0,
                      'si-table__row--silver': i === 1,
                      'si-table__row--bronze': i === 2,
                    }"
                  >
                    <td>
                      <span *ngIf="i === 0">🥇</span>
                      <span *ngIf="i === 1">🥈</span>
                      <span *ngIf="i === 2">🥉</span>
                      <span *ngIf="i > 2" class="si-table__pos">{{
                        i + 1
                      }}</span>
                    </td>
                    <td>
                      <div class="si-vendor">
                        <span class="si-vendor__init">{{
                          v.nombre.charAt(0)
                        }}</span>
                        <span class="si-vendor__name">{{ v.nombre }}</span>
                      </div>
                    </td>
                    <td class="si-table__num">{{ v.ventas }}</td>
                    <td class="si-table__num si-table__num--sm">
                      {{
                        v.ingresos | currency: 'COP' : 'symbol-narrow' : '1.0-0'
                      }}
                    </td>
                    <td>
                      <span
                        class="si-pct"
                        [class.si-pct--high]="v.porcentajePrecioBajo > 30"
                        >{{ v.porcentajePrecioBajo }}%</span
                      >
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="si-drawer__footer">
              <span class="si-drawer__ts"
                >Generado
                {{ rankingActual.generadoEn | date: 'dd/MM/yyyy HH:mm' }}</span
              >
              <button (click)="generarRanking()" class="si-chip si-chip--ghost">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                Regenerar
              </button>
            </div>
          </ng-container>

          <div *ngIf="!rankingActual && !rankingCargando" class="si-empty">
            <div class="si-empty__icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                aria-hidden="true"
              >
                <path
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
            <p class="si-empty__title">Sin ranking esta semana</p>
            <p class="si-empty__sub">
              Genera el ranking para ver el rendimiento del equipo
            </p>
            <button (click)="generarRanking()" class="si-chip">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path
                  d="M5 3l14 9-14 9V3z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              Generar ahora
            </button>
          </div>
        </ng-container>

        <ng-container *ngIf="tabRanking === 'historial'">
          <div *ngIf="rankingCargando" class="si-loading">
            <div class="si-dot"></div>
            <div class="si-dot si-dot--2"></div>
            <div class="si-dot si-dot--3"></div>
            <span>Cargando historial...</span>
          </div>

          <div
            *ngIf="historialRanking.length === 0 && !rankingCargando"
            class="si-empty"
          >
            <div class="si-empty__icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                aria-hidden="true"
              >
                <path
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
            <p class="si-empty__title">Sin semanas anteriores</p>
            <p class="si-empty__sub">El historial aparecerá aquí</p>
          </div>

          <div class="si-history" *ngIf="historialRanking.length > 0">
            <div class="si-hcard" *ngFor="let semana of historialRanking">
              <div class="si-hcard__head">
                <div class="si-hcard__period">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    aria-hidden="true"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {{ semana.semanaInicio | date: 'dd MMM' }} —
                  {{ semana.semanaFin | date: 'dd MMM yyyy' }}
                </div>
                <span class="si-hcard__meta">
                  {{ semana.totalVentasSemana }} ventas ·
                  {{
                    semana.totalIngresosSemana
                      | currency: 'COP' : 'symbol-narrow' : '1.0-0'
                  }}
                </span>
              </div>

              <div class="si-hcard__winner" *ngIf="semana.vendedores[0]">
                <span aria-hidden="true">🥇</span>
                <span class="si-hcard__winner-name">{{
                  semana.vendedores[0].nombre
                }}</span>
                <span class="si-hcard__winner-sales"
                  >— {{ semana.vendedores[0].ventas }} ventas</span
                >
              </div>

              <details class="si-hcard__details">
                <summary class="si-hcard__summary">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    class="si-hcard__chevron"
                    aria-hidden="true"
                  >
                    <path
                      d="M9 18l6-6-6-6"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  Ver narrativa
                </summary>
                <p
                  class="si-hcard__narrativa"
                  [innerHTML]="formatearTexto(semana.narrativa)"
                ></p>
              </details>
            </div>
          </div>
        </ng-container>
      </div>
    </aside>
  `,
  styles: [
    `
      :host {
        /* Tonos del tablero (gray / zinc) con acento ámbar; sigue el modo claro u oscuro */
        --si-bg: #ffffff;
        --si-surface: #f9fafb;
        --si-surface2: #f3f4f6;
        --si-border: #e5e7eb;
        --si-green: #d97706;
        --si-green-dim: rgba(217, 119, 6, 0.1);
        --si-green-glow: rgba(217, 119, 6, 0.22);
        --si-amber: #d97706;
        --si-red: #dc2626;
        --si-blue: #2563eb;
        --si-text: #111827;
        --si-muted: #6b7280;
        --si-radius: 12px;
        --si-radius-sm: 8px;
        display: block;
        font-family: inherit;
      }
      @media (prefers-color-scheme: dark) {
        :host {
          --si-bg: #18181b;
          --si-surface: #1f1f23;
          --si-surface2: #27272a;
          --si-border: rgba(255, 255, 255, 0.09);
          --si-green: #fbbf24;
          --si-green-dim: rgba(251, 191, 36, 0.12);
          --si-green-glow: rgba(251, 191, 36, 0.25);
          --si-amber: #fbbf24;
          --si-red: #f87171;
          --si-blue: #60a5fa;
          --si-text: #f4f4f5;
          --si-muted: #a1a1aa;
        }
      }

      .si-trigger {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 9px 16px;
        background: var(--si-surface);
        border: 1px solid var(--si-border);
        border-radius: 99px;
        color: var(--si-text);
        font-size: 0.8125rem;
        font-weight: 600;
        cursor: pointer;
        margin-bottom: 12px;
        transition:
          box-shadow 200ms,
          transform 150ms;
        -webkit-tap-highlight-color: transparent;
      }
      .si-trigger:hover {
        box-shadow:
          0 0 0 1px var(--si-green),
          0 4px 20px var(--si-green-dim);
      }
      .si-trigger:active {
        transform: scale(0.97);
      }
      .si-trigger:focus-visible {
        outline: 2px solid var(--si-green);
        outline-offset: 2px;
      }

      .si-trigger__spark {
        color: var(--si-green);
        font-size: 0.75rem;
      }

      .si-trigger__pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        border-radius: 99px;
        background: var(--si-surface2);
        color: var(--si-muted);
        font-size: 0.6875rem;
        font-weight: 700;
      }
      .si-trigger__pill--active {
        background: var(--si-green-dim);
        color: var(--si-green);
      }

      .si-panel {
        width: 100%;
        background: var(--si-bg);
        border: 1px solid var(--si-border);
        border-radius: var(--si-radius);
        overflow: hidden;
        animation: siFadeUp 200ms ease-out both;
      }
      @keyframes siFadeUp {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .si-panel__head {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 16px 18px;
        border-bottom: 1px solid var(--si-border);
      }
      .si-panel__spark {
        color: var(--si-green);
        font-size: 0.875rem;
        flex-shrink: 0;
      }
      .si-panel__title {
        flex: 1;
        margin: 0;
        font-size: 0.9375rem;
        font-weight: 700;
        color: var(--si-text);
        letter-spacing: -0.01em;
      }
      .si-panel__head-actions {
        display: flex;
        gap: 6px;
      }

      .si-loading {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 24px 18px;
        color: var(--si-muted);
        font-size: 0.8125rem;
      }
      .si-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--si-green);
        animation: siDot 1.2s ease-in-out infinite;
        opacity: 0.5;
      }
      .si-dot--2 {
        animation-delay: 0.2s;
      }
      .si-dot--3 {
        animation-delay: 0.4s;
      }
      @keyframes siDot {
        0%,
        80%,
        100% {
          transform: translateY(0);
          opacity: 0.3;
        }
        40% {
          transform: translateY(-4px);
          opacity: 1;
        }
      }

      .si-body {
        display: flex;
        flex-direction: column;
        gap: 1px;
        background: var(--si-border);
      }

      .si-card {
        position: relative;
        background: var(--si-surface);
        padding: 16px 18px;
        overflow: hidden;
      }
      .si-card + .si-card {
      }

      .si-card--accent::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: var(--si-green);
        border-radius: 0 2px 2px 0;
      }
      .si-card--accent {
        padding-left: 21px;
      }

      .si-card--info::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: var(--si-blue);
        border-radius: 0 2px 2px 0;
      }
      .si-card--warning::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: var(--si-amber);
        border-radius: 0 2px 2px 0;
      }
      .si-card--danger::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: var(--si-red);
        border-radius: 0 2px 2px 0;
      }
      .si-card--info,
      .si-card--warning,
      .si-card--danger {
        padding-left: 21px;
      }

      .si-card--ok::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: var(--si-green);
        opacity: 0.4;
        border-radius: 0 2px 2px 0;
      }
      .si-card--ok {
        padding-left: 21px;
      }

      .si-card__label {
        display: flex;
        align-items: center;
        gap: 7px;
        font-size: 0.8125rem;
        font-weight: 700;
        color: var(--si-green);
        letter-spacing: 0.01em;
        margin-bottom: 8px;
      }
      .si-card--info .si-card__label {
        color: var(--si-blue);
      }
      .si-card--warning .si-card__label {
        color: var(--si-amber);
      }
      .si-card--danger .si-card__label {
        color: var(--si-red);
      }
      .si-card--ok .si-card__label {
        color: var(--si-green);
        opacity: 0.7;
      }

      .si-card__label svg {
        width: 14px;
        height: 14px;
        flex-shrink: 0;
        opacity: 0.8;
      }
      .si-card__emoji {
        font-size: 1rem;
      }

      .si-card__body {
        margin: 0;
        font-size: 0.8125rem;
        line-height: 1.6;
        color: var(--si-text);
        opacity: 0.85;
      }

      .si-card__footer {
        margin-top: 14px;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .si-card__bar {
        height: 2px;
        border-radius: 99px;
        margin-top: 14px;
        background: var(--si-border);
        overflow: hidden;
      }
      .si-card__bar::after {
        content: '';
        display: block;
        width: 60%;
        height: 100%;
        background: currentColor;
        opacity: 0.3;
        border-radius: inherit;
      }

      .si-badge {
        margin-left: auto;
        padding: 2px 8px;
        border-radius: 99px;
        font-size: 0.65rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .si-badge--info {
        background: rgba(96, 165, 250, 0.15);
        color: var(--si-blue);
      }
      .si-badge--warning {
        background: rgba(245, 158, 11, 0.15);
        color: var(--si-amber);
      }
      .si-badge--danger {
        background: rgba(239, 68, 68, 0.15);
        color: var(--si-red);
      }

      .si-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border-radius: var(--si-radius-sm);
        font-size: 0.8125rem;
        font-weight: 600;
        cursor: pointer;
        border: none;
        background: var(--si-green);
        color: #0a0f1a;
        transition:
          opacity 150ms,
          transform 150ms,
          box-shadow 150ms;
        -webkit-tap-highlight-color: transparent;
        white-space: nowrap;
      }
      .si-chip:hover {
        box-shadow: 0 4px 16px var(--si-green-glow);
        opacity: 0.92;
      }
      .si-chip:active {
        transform: scale(0.96);
      }
      .si-chip:focus-visible {
        outline: 2px solid var(--si-green);
        outline-offset: 2px;
      }
      .si-chip svg {
        width: 13px;
        height: 13px;
        flex-shrink: 0;
      }

      .si-chip--ghost {
        background: var(--si-surface2);
        color: var(--si-text);
        border: 1px solid var(--si-border);
      }
      .si-chip--ghost:hover {
        box-shadow: none;
        background: var(--si-surface);
      }

      .si-icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: var(--si-radius-sm);
        border: none;
        background: var(--si-surface2);
        color: var(--si-muted);
        cursor: pointer;
        transition:
          background 150ms,
          color 150ms,
          transform 150ms;
        -webkit-tap-highlight-color: transparent;
      }
      .si-icon-btn svg {
        width: 15px;
        height: 15px;
      }
      .si-icon-btn:hover {
        background: var(--si-green-dim);
        color: var(--si-green);
      }
      .si-icon-btn:active {
        transform: scale(0.9);
      }
      .si-icon-btn:focus-visible {
        outline: 2px solid var(--si-green);
        outline-offset: 2px;
      }

      .si-overlay {
        position: fixed;
        inset: 0;
        z-index: 40;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        animation: siFadeIn 200ms ease-out;
      }
      @keyframes siFadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      .si-drawer {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        max-height: 90dvh;
        border-radius: 22px 22px 0 0;
        z-index: 50;
        background: var(--si-bg);
        border: 1px solid var(--si-border);
        border-bottom: none;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: siSlideUp 260ms cubic-bezier(0.32, 0.72, 0, 1) both;
      }
      @keyframes siSlideUp {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      @media (min-width: 768px) {
        .si-drawer {
          right: 0;
          left: auto;
          bottom: 0;
          top: 0;
          max-height: 100dvh;
          width: min(460px, 100vw);
          border-radius: 20px 0 0 20px;
          border-bottom: 1px solid var(--si-border);
          border-right: none;
          animation: siSlideRight 260px cubic-bezier(0.32, 0.72, 0, 1) both;
        }
        @keyframes siSlideRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      }

      .si-drawer__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 18px 16px;
        border-bottom: 1px solid var(--si-border);
        flex-shrink: 0;
      }
      .si-drawer__head-left {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .si-drawer__title {
        margin: 0;
        font-size: 0.9375rem;
        font-weight: 700;
        color: var(--si-text);
      }
      .si-drawer__sub {
        margin: 2px 0 0;
        font-size: 0.75rem;
        color: var(--si-muted);
      }

      .si-drawer__body {
        flex: 1;
        overflow-y: auto;
        padding: 16px 18px;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
        display: flex;
        flex-direction: column;
        gap: 12px;
        scrollbar-width: thin;
        scrollbar-color: var(--si-border) transparent;
      }

      .si-drawer__footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-top: 12px;
        border-top: 1px solid var(--si-border);
        margin-top: auto;
      }
      .si-drawer__ts {
        font-size: 0.75rem;
        color: var(--si-muted);
      }

      .si-tabs {
        position: relative;
        display: flex;
        border-bottom: 1px solid var(--si-border);
        flex-shrink: 0;
      }
      .si-tab {
        flex: 1;
        padding: 12px 0;
        background: transparent;
        border: none;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--si-muted);
        cursor: pointer;
        transition: color 150ms;
        -webkit-tap-highlight-color: transparent;
      }
      .si-tab--active {
        color: var(--si-green);
        font-weight: 700;
      }
      .si-tab:focus-visible {
        outline: 2px solid var(--si-green);
        outline-offset: -2px;
      }

      .si-tabs__line {
        position: absolute;
        bottom: -1px;
        left: 0;
        width: 50%;
        height: 2px;
        border-radius: 2px 2px 0 0;
        background: var(--si-green);
        transition: transform 220ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .si-tabs__line--right {
        transform: translateX(100%);
      }

      .si-stats {
        display: flex;
        align-items: center;
        background: var(--si-surface);
        border: 1px solid var(--si-border);
        border-radius: var(--si-radius);
        padding: 14px 16px;
      }
      .si-stat {
        flex: 1;
        text-align: center;
      }
      .si-stat__value {
        display: block;
        font-size: 1.25rem;
        font-weight: 800;
        color: var(--si-text);
        line-height: 1.1;
        letter-spacing: -0.02em;
      }
      .si-stat__value--sm {
        font-size: 0.9375rem;
      }
      .si-stat__label {
        display: block;
        font-size: 0.6875rem;
        color: var(--si-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-top: 4px;
      }
      .si-stat__divider {
        width: 1px;
        height: 36px;
        background: var(--si-border);
        flex-shrink: 0;
        margin: 0 6px;
      }

      .si-podium {
        display: flex;
        align-items: flex-end;
        justify-content: center;
        gap: 8px;
        padding: 8px 0 0;
      }
      .si-podium__slot {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 1;
        max-width: 100px;
      }
      .si-podium__slot--center {
        max-width: 110px;
      }
      .si-podium__crown {
        color: var(--si-amber);
        margin-bottom: 4px;
      }
      .si-podium__crown svg {
        width: 18px;
        height: 18px;
      }

      .si-podium__avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.125rem;
        font-weight: 800;
        margin-bottom: 6px;
        color: #fff;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }
      .si-podium__avatar--lg {
        width: 52px;
        height: 52px;
        font-size: 1.25rem;
      }
      .si-podium__avatar--gold {
        background: linear-gradient(135deg, #f59e0b, #d97706);
      }
      .si-podium__avatar--silver {
        background: linear-gradient(135deg, #94a3b8, #64748b);
      }
      .si-podium__avatar--bronze {
        background: linear-gradient(135deg, #c2773a, #a05c2b);
      }

      .si-podium__name {
        margin: 0 0 2px;
        font-size: 0.6875rem;
        font-weight: 600;
        color: var(--si-text);
        text-align: center;
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .si-podium__name--bold {
        font-weight: 800;
      }
      .si-podium__sales {
        margin: 0 0 8px;
        font-size: 0.625rem;
        color: var(--si-muted);
      }

      .si-podium__bar {
        width: 100%;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        border-radius: 8px 8px 0 0;
        font-size: 0.75rem;
        font-weight: 800;
        padding-top: 6px;
        color: #fff;
      }
      .si-podium__bar--gold {
        height: 64px;
        background: linear-gradient(180deg, #f59e0b, #b45309);
      }
      .si-podium__bar--silver {
        height: 48px;
        background: linear-gradient(180deg, #94a3b8, #475569);
      }
      .si-podium__bar--bronze {
        height: 36px;
        background: linear-gradient(180deg, #c2773a, #7c4a1a);
      }

      .si-table-wrap {
        border: 1px solid var(--si-border);
        border-radius: var(--si-radius);
        overflow: hidden;
        overflow-x: auto;
      }
      .si-table {
        width: 100%;
        border-collapse: collapse;
        min-width: 320px;
      }
      .si-table thead {
        background: var(--si-surface2);
      }
      .si-table th {
        text-align: left;
        padding: 10px 12px;
        font-size: 0.65rem;
        font-weight: 700;
        color: var(--si-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .si-table td {
        padding: 10px 12px;
      }
      .si-table tbody tr {
        border-top: 1px solid var(--si-border);
      }
      .si-table__row--gold {
        background: rgba(245, 158, 11, 0.05);
      }
      .si-table__row--silver {
        background: rgba(148, 163, 184, 0.04);
      }
      .si-table__row--bronze {
        background: rgba(194, 119, 58, 0.04);
      }
      .si-table__pos {
        font-size: 0.8125rem;
        color: var(--si-muted);
        font-weight: 600;
      }
      .si-table__num {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--si-text);
      }
      .si-table__num--sm {
        font-size: 0.75rem;
        color: color-mix(in srgb, var(--si-text) 72%, transparent);
        white-space: nowrap;
      }

      .si-vendor {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .si-vendor__init {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: var(--si-green-dim);
        color: var(--si-green);
        font-size: 0.6875rem;
        font-weight: 800;
        flex-shrink: 0;
      }
      .si-vendor__name {
        font-size: 0.8125rem;
        color: var(--si-text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .si-pct {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        border-radius: 99px;
        font-size: 0.7rem;
        font-weight: 700;
        background: var(--si-surface2);
        color: var(--si-muted);
      }
      .si-pct--high {
        background: rgba(239, 68, 68, 0.15);
        color: var(--si-red);
      }

      .si-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 40px 20px;
        gap: 8px;
        text-align: center;
      }
      .si-empty__icon {
        width: 52px;
        height: 52px;
        border-radius: 14px;
        background: var(--si-surface2);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 8px;
      }
      .si-empty__icon svg {
        width: 26px;
        height: 26px;
        color: var(--si-muted);
      }
      .si-empty__title {
        margin: 0;
        font-size: 0.9375rem;
        font-weight: 700;
        color: var(--si-text);
      }
      .si-empty__sub {
        margin: 0 0 8px;
        font-size: 0.8125rem;
        color: var(--si-muted);
      }

      .si-history {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .si-hcard {
        background: var(--si-surface);
        border: 1px solid var(--si-border);
        border-radius: var(--si-radius);
        padding: 14px 16px;
        transition: border-color 200ms;
      }
      .si-hcard:hover {
        border-color: rgba(61, 220, 132, 0.25);
      }

      .si-hcard__head {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 10px;
      }
      @media (min-width: 400px) {
        .si-hcard__head {
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
        }
      }

      .si-hcard__period {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--si-text);
      }
      .si-hcard__period svg {
        width: 13px;
        height: 13px;
        color: var(--si-muted);
        flex-shrink: 0;
      }
      .si-hcard__meta {
        font-size: 0.75rem;
        color: var(--si-muted);
        white-space: nowrap;
      }

      .si-hcard__winner {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 10px;
        border-radius: 10px;
        background: rgba(245, 158, 11, 0.08);
        margin-bottom: 10px;
      }
      .si-hcard__winner-name {
        font-size: 0.8125rem;
        font-weight: 700;
        color: var(--si-amber);
      }
      .si-hcard__winner-sales {
        font-size: 0.75rem;
        color: rgba(245, 158, 11, 0.6);
      }

      .si-hcard__details summary {
        list-style: none;
        cursor: pointer;
      }
      .si-hcard__details summary::-webkit-details-marker {
        display: none;
      }
      .si-hcard__summary {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--si-green);
        -webkit-tap-highlight-color: transparent;
        user-select: none;
      }
      .si-hcard__chevron {
        width: 13px;
        height: 13px;
        transition: transform 200ms;
      }
      .si-hcard__details[open] .si-hcard__chevron {
        transform: rotate(90deg);
      }
      .si-hcard__narrativa {
        margin: 10px 0 0;
        padding-top: 10px;
        border-top: 1px solid var(--si-border);
        font-size: 0.8125rem;
        line-height: 1.6;
        color: color-mix(in srgb, var(--si-text) 72%, transparent);
      }

      @media (prefers-reduced-motion: reduce) {
        .si-panel,
        .si-drawer,
        .si-overlay,
        .si-dot,
        .si-trigger__spark {
          animation: none !important;
        }
      }
    `,
  ],
})
export class AlertasPanelComponent implements OnInit, OnDestroy {
  @Input() nombreUsuario = '';
  @Input() modoCompacto = false;
  @Output() enviarAlChat = new EventEmitter<string>();

  mostrarAlertas = true;
  mostrarRankingPanel = false;
  tabRanking: 'actual' | 'historial' = 'actual';

  resumen: ResumenAlertas | null = null;
  cargando = false;

  rankingActual: RankingSemana | null = null;
  historialRanking: RankingSemana[] = [];
  rankingCargando = false;

  private subs = new Subscription();

  constructor(
    private alertasService: AlertasIaService,
    private rankingService: RankingSemanalService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.subs.add(
      this.alertasService.resumen$.subscribe((r) => {
        this.resumen = r;
        this.cdr.detectChanges();
      }),
    );
    this.subs.add(
      this.alertasService.cargando$.subscribe((c) => {
        this.cargando = c;
        this.cdr.detectChanges();
      }),
    );
    this.subs.add(
      this.rankingService.rankingActual$.subscribe((r) => {
        this.rankingActual = r;
        this.cdr.detectChanges();
      }),
    );
    this.subs.add(
      this.rankingService.historial$.subscribe((h) => {
        this.historialRanking = h;
        this.cdr.detectChanges();
      }),
    );
    this.subs.add(
      this.rankingService.cargando$.subscribe((c) => {
        this.rankingCargando = c;
        this.cdr.detectChanges();
      }),
    );

    this.alertasService.verificarAlertasDelDia(this.nombreUsuario);
    this.rankingService.cargarRankingActual();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  actualizarAlertas(): void {
    this.alertasService.forzarActualizacion(this.nombreUsuario);
  }
  cargarRankingActual(): void {
    this.rankingService.cargarRankingActual();
  }
  cargarHistorial(): void {
    this.rankingService.cargarHistorial();
  }
  generarRanking(): void {
    this.rankingService.generarYGuardarRanking();
  }

  nivelLabel(nivel: string): string {
    return (
      (
        { info: 'Info', warning: 'Atención', danger: 'Urgente' } as Record<
          string,
          string
        >
      )[nivel] ?? nivel
    );
  }

  iconoAlerta(tipo: string): string {
    return (
      (
        {
          prestamo_viejo: '🔄',
          pedido_viejo: '📋',
          precio_bajo: '💸',
          stock_critico: '📦',
        } as Record<string, string>
      )[tipo] ?? '⚠️'
    );
  }

  formatearTexto(texto: string): string {
    return texto
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }
}
