import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  HostListener,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  PrinterTemplateService,
  LabelTemplate,
  LabelElement,
  TextElement,
  BarcodeElement,
  QrElement,
  LineElement,
  RectElement,
  LabelVariables,
  AVAILABLE_VARIABLES,
  DPM,
  FONT_DOTS,
  defaultElements,
  newId,
  qrSizeMm,
  resolveVariables,
} from '../../services/printer-template/printer-template.service';

import QRCode from 'qrcode';

const PX_PER_MM = 4;

const PREVIEW_VARS: LabelVariables = {
  marca: 'NIKE',
  referencia: 'Air Max 270',
  talla: '42',
  codigo: '732',
  local: 'LOCAL 125',
  precio: '$189.900',
  custom1: 'Custom 1',
  custom2: 'Custom 2',
  custom3: 'Custom 3',
};

const EL_COLORS: Record<string, string> = {
  text: '#60a5fa',
  barcode: '#f59e0b',
  qr: '#34d399',
  line: '#f43f5e',
  rect: '#a78bfa',
};

@Component({
  selector: 'app-template-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ed-root">
      <header class="ed-bar">
        <button class="bar-btn bar-btn--back" (click)="onClose()">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M9 2L4 7l5 5"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span class="bar-label">Salir</span>
        </button>

        <span class="bar-title">{{ meta.nombre || 'Sin nombre' }}</span>

        <div class="bar-tools">
          <button
            class="tool-btn"
            [class.on]="activeTool() === 'select'"
            (click)="activeTool.set('select')"
            title="Seleccionar"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path
                d="M1.5 1.5l4.5 9.5 1.8-3.8 3.8-1.8z"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <div class="tool-sep"></div>
          <button class="tool-btn" (click)="addText()" title="Texto">
            <b style="font-size:12px;line-height:1">T</b>
          </button>
          <button class="tool-btn" (click)="addBarcode()" title="Barcode">
            <svg width="15" height="12" viewBox="0 0 15 12" fill="none">
              <rect x="1" y="0" width="1.2" height="12" fill="currentColor" />
              <rect x="3.5" y="0" width="0.8" height="12" fill="currentColor" />
              <rect x="5.8" y="0" width="1.6" height="12" fill="currentColor" />
              <rect x="9" y="0" width="0.8" height="12" fill="currentColor" />
              <rect
                x="11.5"
                y="0"
                width="1.2"
                height="12"
                fill="currentColor"
              />
            </svg>
          </button>
          <button class="tool-btn" (click)="addQr()" title="QR">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <rect
                x="1"
                y="1"
                width="4"
                height="4"
                rx=".4"
                stroke="currentColor"
                stroke-width="1.2"
              />
              <rect
                x="8"
                y="1"
                width="4"
                height="4"
                rx=".4"
                stroke="currentColor"
                stroke-width="1.2"
              />
              <rect
                x="1"
                y="8"
                width="4"
                height="4"
                rx=".4"
                stroke="currentColor"
                stroke-width="1.2"
              />
              <rect
                x="2.2"
                y="2.2"
                width="1.6"
                height="1.6"
                fill="currentColor"
              />
              <rect
                x="9.2"
                y="2.2"
                width="1.6"
                height="1.6"
                fill="currentColor"
              />
              <rect
                x="2.2"
                y="9.2"
                width="1.6"
                height="1.6"
                fill="currentColor"
              />
              <rect x="8.5" y="8.5" width="4" height="1" fill="currentColor" />
              <rect x="8.5" y="11" width="4" height="1" fill="currentColor" />
              <rect
                x="11.5"
                y="8.5"
                width="1"
                height="3.5"
                fill="currentColor"
              />
            </svg>
          </button>
          <button class="tool-btn" (click)="addLine()" title="Línea">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <line
                x1="1"
                y1="6.5"
                x2="12"
                y2="6.5"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>
          <button class="tool-btn" (click)="addRect()" title="Rect">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <rect
                x="1"
                y="2"
                width="11"
                height="9"
                rx=".4"
                stroke="currentColor"
                stroke-width="1.5"
              />
            </svg>
          </button>
          <div class="tool-sep"></div>
          <button
            class="tool-btn tool-btn--del"
            [disabled]="!selectedId()"
            (click)="deleteSelected()"
            title="Eliminar"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path
                d="M2 3h9M5 3V2h3v1M3.5 3l.5 8h5l.5-8"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>

        <div class="bar-actions">
          <button class="bar-btn" (click)="resetElements()">↺</button>
          <button
            class="bar-btn bar-btn--save"
            (click)="save()"
            [disabled]="saving()"
          >
            {{ saving() ? '…' : '💾 Guardar' }}
          </button>
        </div>
      </header>

      <div class="ed-body">
        <aside class="ed-panel ed-panel--left" [class.open]="leftOpen()">
          <button
            class="panel-toggle panel-toggle--left"
            (click)="leftOpen.set(!leftOpen())"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                [attr.d]="leftOpen() ? 'M9 2L4 7l5 5' : 'M5 2l5 5-5 5'"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>

          <div class="panel-scroll">
            <div class="panel-section">
              <p class="section-label">PLANTILLA</p>
              <label class="field">
                <span>Nombre</span>
                <input
                  [(ngModel)]="meta.nombre"
                  placeholder="Ej: Sticker 50×30"
                />
              </label>
              <div class="field-row">
                <label class="field">
                  <span>Ancho mm</span>
                  <input
                    type="number"
                    [(ngModel)]="meta.width"
                    min="20"
                    max="120"
                    (ngModelChange)="onSizeChange()"
                  />
                </label>
                <label class="field">
                  <span>Alto mm</span>
                  <input
                    type="number"
                    [(ngModel)]="meta.height"
                    min="10"
                    max="200"
                    (ngModelChange)="onSizeChange()"
                  />
                </label>
                <label class="field">
                  <span>Cols</span>
                  <input
                    type="number"
                    [(ngModel)]="meta.cols"
                    min="1"
                    max="5"
                  />
                </label>
                <label class="field">
                  <span>Gap mm</span>
                  <input
                    type="number"
                    [(ngModel)]="meta.gap"
                    min="0"
                    max="10"
                  />
                </label>
                <label class="field">
                  <span>Copias</span>
                  <input
                    type="number"
                    [(ngModel)]="meta.copies"
                    min="1"
                    max="99"
                  />
                </label>
              </div>
            </div>

            <div class="panel-section">
              <p class="section-label">CAPAS</p>
              <div class="layers">
                @for (el of elementsReversed(); track el.id) {
                  <div
                    class="layer"
                    [class.active]="selectedId() === el.id"
                    (click)="select(el.id)"
                  >
                    <span
                      class="layer-dot"
                      [style.background]="colorFor(el)"
                    ></span>
                    <span class="layer-name">{{ layerLabel(el) }}</span>
                    <button
                      class="layer-eye"
                      (click)="toggleVisible(el.id); $event.stopPropagation()"
                    >
                      {{ el.visible ? '●' : '○' }}
                    </button>
                  </div>
                }
              </div>
            </div>

            <div class="panel-section">
              <p class="section-label">VISTA PREVIA</p>
              <div class="mode-pills">
                <button
                  [class.active]="previewMode() === 'exhibicion'"
                  (click)="previewMode.set('exhibicion')"
                >
                  📍 Exhibición
                </button>
                <button
                  [class.active]="previewMode() === 'venta'"
                  (click)="previewMode.set('venta')"
                >
                  🏷️ Venta
                </button>
              </div>
            </div>
          </div>
        </aside>

        <main class="ed-canvas">
          <div class="canvas-scroll">
            <div class="canvas-stage">
              <div
                class="ruler ruler--h"
                [style.width.px]="
                  canvasW() * colsArr().length + 32 + (colsArr().length - 1) * 8
                "
              >
                <div class="ruler-corner"></div>
                @for (m of hRulerMarks(); track m) {
                  <div
                    class="r-tick r-tick--h"
                    [style.left.px]="m * PX + 32"
                    [class.major]="m % 10 === 0"
                  >
                    @if (m % 10 === 0) {
                      <span>{{ m }}</span>
                    }
                  </div>
                }
              </div>

              <div class="canvas-row">
                <div class="ruler ruler--v" [style.height.px]="canvasH()">
                  @for (m of vRulerMarks(); track m) {
                    <div
                      class="r-tick r-tick--v"
                      [style.top.px]="m * PX"
                      [class.major]="m % 10 === 0"
                    >
                      @if (m % 10 === 0) {
                        <span>{{ m }}</span>
                      }
                    </div>
                  }
                </div>

                @for (col of colsArr(); track col) {
                  <div
                    class="label-canvas"
                    [style.width.px]="canvasW()"
                    [style.height.px]="canvasH()"
                    [class.tool-active]="activeTool() !== 'select'"
                    (mousedown)="onCanvasDown($event, col)"
                    (mousemove)="onCanvasMove($event)"
                    (mouseup)="onCanvasUp($event)"
                  >
                    <svg
                      class="canvas-grid"
                      [attr.width]="canvasW()"
                      [attr.height]="canvasH()"
                    >
                      <defs>
                        <pattern
                          id="g1"
                          [attr.width]="PX"
                          [attr.height]="PX"
                          patternUnits="userSpaceOnUse"
                        >
                          <path
                            [attr.d]="'M ' + PX + ' 0 L 0 0 0 ' + PX"
                            fill="none"
                            stroke="#e4e4de"
                            stroke-width="0.4"
                          />
                        </pattern>
                        <pattern
                          id="g5"
                          [attr.width]="PX * 5"
                          [attr.height]="PX * 5"
                          patternUnits="userSpaceOnUse"
                        >
                          <rect
                            [attr.width]="PX * 5"
                            [attr.height]="PX * 5"
                            fill="url(#g1)"
                          />
                          <path
                            [attr.d]="'M ' + PX * 5 + ' 0 L 0 0 0 ' + PX * 5"
                            fill="none"
                            stroke="#c8c8c0"
                            stroke-width="0.7"
                          />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="white" />
                      <rect width="100%" height="100%" fill="url(#g5)" />
                    </svg>

                    @for (el of elements(); track el.id) {
                      @if (el.visible && shouldShow(el)) {
                        <div
                          class="canvas-el"
                          [class.sel]="selectedId() === el.id"
                          [class.dragging]="draggingId() === el.id"
                          [style.left.px]="el.x * PX"
                          [style.top.px]="el.y * PX"
                          (mousedown)="onElDown($event, el.id)"
                          (click)="select(el.id); $event.stopPropagation()"
                        >
                          @if (el.type === 'text') {
                            <span
                              class="el-text"
                              [style.font-size.px]="textFontPx(asText(el))"
                              [style.font-weight]="
                                asText(el).bold ? '700' : '400'
                              "
                              [style.letter-spacing]="
                                letterSpacing(asText(el)) + 'px'
                              "
                              style="white-space:nowrap;font-family:monospace;line-height:1"
                            >
                              {{ resolvedText(asText(el)) }}
                            </span>
                          }
                          @if (el.type === 'barcode') {
                            <div
                              class="el-barcode"
                              [style.height.px]="asBarcode(el).height * PX"
                              [style.width.px]="barcodeWidthPx(asBarcode(el))"
                            >
                              <div class="bc-bars">
                                @for (
                                  bar of barcodeBars(asBarcode(el));
                                  track $index
                                ) {
                                  <div
                                    [style.width.px]="(bar.w * PX) / DPM"
                                    [style.background]="
                                      bar.dark ? '#000' : 'transparent'
                                    "
                                    style="height:100%;flex-shrink:0"
                                  ></div>
                                }
                              </div>
                              @if (asBarcode(el).showText) {
                                <div class="bc-text">
                                  {{ resolvedContent(asBarcode(el)) }}
                                </div>
                              }
                            </div>
                          }
                          @if (el.type === 'qr') {
                            <div
                              [style.width.px]="qrPx(asQr(el))"
                              [style.height.px]="qrPx(asQr(el))"
                            >
                              @if (getQrUrl(asQr(el).content)) {
                                <img
                                  [src]="getQrUrl(asQr(el).content)"
                                  [style.width.px]="qrPx(asQr(el))"
                                  [style.height.px]="qrPx(asQr(el))"
                                  style="display:block"
                                  (load)="generateQr(asQr(el).content)"
                                />
                              } @else {
                                <div
                                  [style.width.px]="qrPx(asQr(el))"
                                  [style.height.px]="qrPx(asQr(el))"
                                  style="background:#eee;display:flex;align-items:center;
                                    justify-content:center;font-size:8px;color:#999"
                                >
                                  QR
                                </div>
                              }
                            </div>
                          }
                          @if (el.type === 'line') {
                            <div
                              [style.width.px]="
                                asLine(el).direction === 'h'
                                  ? asLine(el).width * PX
                                  : (asLine(el).thickness * PX) / DPM
                              "
                              [style.height.px]="
                                asLine(el).direction === 'h'
                                  ? (asLine(el).thickness * PX) / DPM
                                  : asLine(el).width * PX
                              "
                              style="background:#000"
                            ></div>
                          }
                          @if (el.type === 'rect') {
                            <div
                              [style.width.px]="asRect(el).width * PX"
                              [style.height.px]="asRect(el).height * PX"
                              [style.border]="
                                (asRect(el).thickness * PX) / DPM +
                                'px solid #000'
                              "
                              style="background:transparent;box-sizing:border-box"
                            ></div>
                          }

                          @if (selectedId() === el.id) {
                            <div class="sel-h sel-h--tl"></div>
                            <div class="sel-h sel-h--tr"></div>
                            <div class="sel-h sel-h--bl"></div>
                            <div class="sel-h sel-h--br"></div>
                            <div class="sel-pos">
                              {{ el.x.toFixed(1) }},{{ el.y.toFixed(1) }}mm
                            </div>
                          }
                        </div>
                      }
                    }

                    <div class="canvas-border"></div>
                    <span class="col-tag">Col {{ col + 1 }}</span>
                  </div>
                }
              </div>

              <div class="canvas-info">
                📐 {{ meta.width }}×{{ meta.height }} mm
                @if (meta.cols > 1) {
                  · {{ meta.cols }} cols = {{ meta.width * meta.cols }}mm
                }
              </div>
            </div>
          </div>
        </main>

        <aside class="ed-panel ed-panel--right" [class.open]="rightOpen()">
          <button
            class="panel-toggle panel-toggle--right"
            (click)="rightOpen.set(!rightOpen())"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                [attr.d]="rightOpen() ? 'M5 2l5 5-5 5' : 'M9 2L4 7l5 5'"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>

          <div class="panel-scroll">
            @if (selectedEl()) {
              <div class="panel-section">
                <p class="section-label">
                  <span
                    class="type-pill"
                    [style.background]="colorFor(selectedEl()!)"
                  >
                    {{ selectedEl()!.type }}
                  </span>
                  PROPIEDADES
                </p>

                <div class="field-row">
                  <label class="field">
                    <span>X mm</span>
                    <input
                      type="number"
                      [ngModel]="selectedEl()!.x | number: '1.1-2'"
                      (ngModelChange)="updateEl('x', +$event)"
                      min="0"
                      step="0.5"
                    />
                  </label>
                  <label class="field">
                    <span>Y mm</span>
                    <input
                      type="number"
                      [ngModel]="selectedEl()!.y | number: '1.1-2'"
                      (ngModelChange)="updateEl('y', +$event)"
                      min="0"
                      step="0.5"
                    />
                  </label>
                </div>

                @if (selectedEl()!.type === 'text') {
                  <label class="field">
                    <span>Contenido</span>
                    <input
                      [(ngModel)]="asTextSel.content"
                      (ngModelChange)="updateEl('content', $event)"
                    />
                  </label>
                  <div class="var-chips">
                    @for (v of VARS; track v.key) {
                      <button class="var-chip" (click)="insertVar(v.key)">
                        {{ v.key }}&#125;&#125;
                      </button>
                    }
                  </div>
                  <div class="field-row">
                    <label class="field">
                      <span>Fuente</span>
                      <select
                        [ngModel]="asTextSel.fontCode"
                        (ngModelChange)="updateEl('fontCode', $event)"
                      >
                        <option value="1">1 · 2mm</option>
                        <option value="2">2 · 2.5mm</option>
                        <option value="3">3 · 3mm</option>
                        <option value="4">4 · 4mm</option>
                        <option value="5">5 · 6mm</option>
                      </select>
                    </label>
                    <label class="field">
                      <span>Esc X</span>
                      <input
                        type="number"
                        [ngModel]="asTextSel.scaleX"
                        (ngModelChange)="updateEl('scaleX', +$event)"
                        min="1"
                        max="10"
                      />
                    </label>
                    <label class="field">
                      <span>Esc Y</span>
                      <input
                        type="number"
                        [ngModel]="asTextSel.scaleY"
                        (ngModelChange)="updateEl('scaleY', +$event)"
                        min="1"
                        max="10"
                      />
                    </label>
                  </div>
                  <label class="field field--check">
                    <input
                      type="checkbox"
                      [ngModel]="asTextSel.bold"
                      (ngModelChange)="updateEl('bold', $event)"
                    />
                    <span>Negrita</span>
                  </label>
                  <div class="size-badge">
                    Alto {{ textHeightInfo() }}mm · Ancho ~{{
                      textWidthInfo()
                    }}mm
                  </div>
                }

                @if (selectedEl()!.type === 'barcode') {
                  <label class="field">
                    <span>Datos</span>
                    <input
                      [(ngModel)]="asBarcodeSel.content"
                      (ngModelChange)="updateEl('content', $event)"
                    />
                  </label>
                  <div class="var-chips">
                    @for (v of VARS; track v.key) {
                      <button class="var-chip" (click)="insertVar(v.key)">
                        {{ v.key }}&#125;&#125;
                      </button>
                    }
                  </div>
                  <div class="field-row">
                    <label class="field">
                      <span>Tipo</span>
                      <select
                        [ngModel]="asBarcodeSel.barcodeType"
                        (ngModelChange)="updateEl('barcodeType', $event)"
                      >
                        <option>CODE128</option>
                        <option>CODE39</option>
                        <option>EAN13</option>
                        <option>EAN8</option>
                      </select>
                    </label>
                    <label class="field">
                      <span>Alto mm</span>
                      <input
                        type="number"
                        [ngModel]="asBarcodeSel.height"
                        (ngModelChange)="updateEl('height', +$event)"
                        min="4"
                        max="50"
                      />
                    </label>
                    <label class="field">
                      <span>Estrecho</span>
                      <input
                        type="number"
                        [ngModel]="asBarcodeSel.narrow"
                        (ngModelChange)="updateEl('narrow', +$event)"
                        min="1"
                        max="4"
                      />
                    </label>
                  </div>
                  <label class="field field--check">
                    <input
                      type="checkbox"
                      [ngModel]="asBarcodeSel.showText"
                      (ngModelChange)="updateEl('showText', $event)"
                    />
                    <span>Mostrar número</span>
                  </label>
                }

                @if (selectedEl()!.type === 'qr') {
                  <label class="field">
                    <span>Datos QR</span>
                    <input
                      [(ngModel)]="asQrSel.content"
                      (ngModelChange)="updateEl('content', $event)"
                    />
                  </label>
                  <div class="var-chips">
                    @for (v of VARS; track v.key) {
                      <button class="var-chip" (click)="insertVar(v.key)">
                        {{ v.key }}&#125;&#125;
                      </button>
                    }
                  </div>
                  <label class="field">
                    <span>Módulo dots · {{ qrSizeInfo() }}mm</span>
                    <input
                      type="number"
                      [ngModel]="asQrSel.moduleSize"
                      (ngModelChange)="updateEl('moduleSize', +$event)"
                      min="2"
                      max="10"
                    />
                  </label>
                }

                @if (selectedEl()!.type === 'line') {
                  <div class="field-row">
                    <label class="field">
                      <span>Largo mm</span>
                      <input
                        type="number"
                        [ngModel]="asLineSel.width"
                        (ngModelChange)="updateEl('width', +$event)"
                        min="1"
                      />
                    </label>
                    <label class="field">
                      <span>Grosor</span>
                      <input
                        type="number"
                        [ngModel]="asLineSel.thickness"
                        (ngModelChange)="updateEl('thickness', +$event)"
                        min="1"
                        max="20"
                      />
                    </label>
                    <label class="field">
                      <span>Dir</span>
                      <select
                        [ngModel]="asLineSel.direction"
                        (ngModelChange)="updateEl('direction', $event)"
                      >
                        <option value="h">H</option>
                        <option value="v">V</option>
                      </select>
                    </label>
                  </div>
                }

                @if (selectedEl()!.type === 'rect') {
                  <div class="field-row">
                    <label class="field">
                      <span>Ancho mm</span>
                      <input
                        type="number"
                        [ngModel]="asRectSel.width"
                        (ngModelChange)="updateEl('width', +$event)"
                        min="1"
                      />
                    </label>
                    <label class="field">
                      <span>Alto mm</span>
                      <input
                        type="number"
                        [ngModel]="asRectSel.height"
                        (ngModelChange)="updateEl('height', +$event)"
                        min="1"
                      />
                    </label>
                    <label class="field">
                      <span>Borde</span>
                      <input
                        type="number"
                        [ngModel]="asRectSel.thickness"
                        (ngModelChange)="updateEl('thickness', +$event)"
                        min="1"
                        max="20"
                      />
                    </label>
                  </div>
                }

                <div class="el-foot">
                  <label class="field field--check">
                    <input
                      type="checkbox"
                      [ngModel]="selectedEl()!.visible"
                      (ngModelChange)="updateEl('visible', $event)"
                    />
                    <span>Visible</span>
                  </label>
                  <button class="del-btn" (click)="deleteSelected()">
                    🗑 Eliminar
                  </button>
                </div>
              </div>
            } @else {
              <div class="panel-section">
                <p class="empty-hint">
                  Selecciona un elemento o usa las herramientas para agregar
                  uno.
                </p>
              </div>
            }

            <div class="panel-section">
              <p class="section-label">ATAJOS</p>
              <div class="shortcuts">
                <span><kbd>T</kbd> Texto</span>
                <span><kbd>L</kbd> Línea</span>
                <span><kbd>R</kbd> Rectángulo</span>
                <span><kbd>Del</kbd> Eliminar</span>
                <span><kbd>↑↓←→</kbd> Mover 0.5mm</span>
                <span><kbd>Esc</kbd> Deselect</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <nav class="mobile-nav">
        <button class="mnav-btn" (click)="leftOpen.set(!leftOpen())">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect
              x="2"
              y="3"
              width="12"
              height="1.5"
              rx=".5"
              fill="currentColor"
            />
            <rect
              x="2"
              y="7.25"
              width="8"
              height="1.5"
              rx=".5"
              fill="currentColor"
            />
            <rect
              x="2"
              y="11.5"
              width="10"
              height="1.5"
              rx=".5"
              fill="currentColor"
            />
          </svg>
          <span>Plantilla</span>
        </button>
        <button
          class="mnav-btn"
          [class.on]="activeTool() === 'select'"
          (click)="activeTool.set('select')"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 2l5.5 12 2.2-4.5 4.5-2.2z"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linejoin="round"
            />
          </svg>
          <span>Mover</span>
        </button>
        <button class="mnav-btn" (click)="addText()">
          <b style="font-size:15px;line-height:1">T</b>
          <span>Texto</span>
        </button>
        <button class="mnav-btn" (click)="addLine()">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <line
              x1="2"
              y1="8"
              x2="14"
              y2="8"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
            />
          </svg>
          <span>Línea</span>
        </button>
        <button
          class="mnav-btn"
          [class.warn]="!!selectedId()"
          (click)="deleteSelected()"
          [disabled]="!selectedId()"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 4h10M6 4V3h4v1M4.5 4l.5 9h6l.5-9"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </svg>
          <span>Borrar</span>
        </button>
        <button
          class="mnav-btn"
          (click)="rightOpen.set(!rightOpen())"
          [class.on]="!!selectedId()"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="2.5" fill="currentColor" />
            <path
              d="M8 2v2M8 12v2M2 8h2M12 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4
              M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </svg>
          <span>Props</span>
        </button>
      </nav>
    </div>
  `,

  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }

      .ed-root {
        --bg: #f2f1ed;
        --paper: #ffffff;
        --bar: #18181b;
        --bar-txt: #e4e4e7;
        --panel: #fafaf8;
        --border: #ddddd6;
        --accent: #16a34a;
        --accent2: #15803d;
        --muted: #71717a;
        --danger: #dc2626;
        --radius: 6px;
        --shadow: 0 2px 10px rgba(0, 0, 0, 0.12);

        display: flex;
        flex-direction: column;
        height: 100dvh;
        width: 100%;
        background: var(--bg);
        font-family: 'Geist Mono', 'JetBrains Mono', 'Cascadia Code', monospace;
        font-size: 12px;
        color: #1a1a1a;
        overflow: hidden;
      }

      .ed-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 10px;
        height: 46px;
        flex-shrink: 0;
        background: var(--bar);
        border-bottom: 1px solid #000;
      }
      .bar-btn {
        display: flex;
        align-items: center;
        gap: 5px;
        background: #2a2a2e;
        border: 1px solid #3f3f46;
        color: var(--bar-txt);
        border-radius: var(--radius);
        padding: 5px 10px;
        cursor: pointer;
        font-size: 11px;
        font-family: inherit;
        white-space: nowrap;
        transition: all 0.12s;
      }
      .bar-btn:hover {
        background: #3f3f46;
      }
      .bar-btn--back {
        color: #a1a1aa;
      }
      .bar-btn--save {
        background: #14532d;
        border-color: var(--accent);
        color: #86efac;
        font-weight: 700;
      }
      .bar-btn--save:hover:not(:disabled) {
        background: var(--accent2);
      }
      .bar-btn--save:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .bar-label {
        display: none;
      }
      @media (min-width: 600px) {
        .bar-label {
          display: inline;
        }
      }

      .bar-title {
        flex: 1;
        text-align: center;
        font-size: 11px;
        color: #71717a;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .bar-tools {
        display: flex;
        align-items: center;
        gap: 2px;
        background: #27272a;
        border-radius: var(--radius);
        padding: 4px 6px;
      }
      .tool-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 26px;
        background: transparent;
        border: 1px solid transparent;
        color: #a1a1aa;
        border-radius: 4px;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.1s;
      }
      .tool-btn:hover {
        background: #3f3f46;
        color: #fff;
      }
      .tool-btn.on {
        background: #1c4a2e;
        border-color: var(--accent);
        color: #86efac;
      }
      .tool-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }
      .tool-btn--del:hover {
        color: var(--danger);
      }
      .tool-sep {
        width: 1px;
        height: 18px;
        background: #3f3f46;
        margin: 0 3px;
      }
      .bar-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .ed-body {
        display: flex;
        flex: 1;
        overflow: hidden;
        position: relative;
      }

      .ed-panel {
        width: 220px;
        min-width: 200px;
        background: var(--panel);
        overflow: hidden;
        flex-shrink: 0;
        transition:
          width 0.22s ease,
          min-width 0.22s ease;
        position: relative;
      }
      .ed-panel--left {
        border-right: 1px solid var(--border);
      }
      .ed-panel--right {
        border-left: 1px solid var(--border);
        width: 230px;
      }

      @media (max-width: 768px) {
        .ed-panel {
          position: fixed;
          top: 46px;
          bottom: 52px;
          z-index: 200;
          width: 80vw;
          min-width: 0;
          box-shadow: 4px 0 24px rgba(0, 0, 0, 0.18);
          transform: translateX(-105%);
          transition: transform 0.25s ease;
        }
        .ed-panel--left {
          left: 0;
          transform: translateX(-105%);
        }
        .ed-panel--right {
          right: 0;
          transform: translateX(105%);
          border-left: 1px solid var(--border);
        }
        .ed-panel--left.open {
          transform: translateX(0);
        }
        .ed-panel--right.open {
          transform: translateX(0);
        }
      }
      @media (min-width: 769px) {
        .panel-toggle {
          display: none;
        }
      }

      .panel-toggle {
        position: absolute;
        top: 50%;
        right: -14px;
        transform: translateY(-50%);
        width: 14px;
        height: 40px;
        background: var(--panel);
        border: 1px solid var(--border);
        border-left: none;
        border-radius: 0 4px 4px 0;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: var(--muted);
        z-index: 10;
      }
      .panel-toggle--right {
        left: -14px;
        right: auto;
        border-left: 1px solid var(--border);
        border-right: none;
        border-radius: 4px 0 0 4px;
      }

      .panel-scroll {
        height: 100%;
        overflow-y: auto;
        overflow-x: hidden;
      }
      .panel-section {
        padding: 12px 14px;
        border-bottom: 1px solid var(--border);
      }
      .section-label {
        margin: 0 0 10px;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.12em;
        color: var(--muted);
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: 3px;
        margin-bottom: 7px;
      }
      .field span {
        font-size: 10px;
        color: #52525b;
      }
      .field input,
      .field select {
        background: #fff;
        border: 1px solid var(--border);
        border-radius: 4px;
        color: #1a1a1a;
        padding: 5px 7px;
        font-size: 11px;
        font-family: inherit;
        transition: border-color 0.12s;
        width: 100%;
        box-sizing: border-box;
      }
      .field input:focus,
      .field select:focus {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.15);
      }
      .field-row {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
        gap: 6px;
      }
      .field--check {
        flex-direction: row;
        align-items: center;
        gap: 7px;
        margin-bottom: 0;
      }
      .field--check input {
        width: 14px;
        height: 14px;
        accent-color: var(--accent);
      }

      .var-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 3px;
        margin-bottom: 8px;
      }
      .var-chip {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        color: var(--accent);
        border-radius: 3px;
        padding: 2px 6px;
        font-size: 9px;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.1s;
      }
      .var-chip:hover {
        background: var(--accent);
        color: #fff;
        border-color: var(--accent);
      }

      .size-badge {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 10px;
        color: var(--accent);
        margin-top: 4px;
      }

      .layers {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .layer {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 6px 8px;
        border-radius: 5px;
        cursor: pointer;
        border: 1px solid transparent;
        transition: all 0.1s;
      }
      .layer:hover {
        background: #f0f0e8;
      }
      .layer.active {
        background: #f0fdf4;
        border-color: #bbf7d0;
      }
      .layer-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .layer-name {
        flex: 1;
        font-size: 10px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .layer-eye {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 10px;
        color: var(--muted);
        padding: 0;
      }

      .mode-pills {
        display: flex;
        gap: 4px;
      }
      .mode-pills button {
        flex: 1;
        background: #f0f0e8;
        border: 1px solid var(--border);
        color: var(--muted);
        border-radius: 5px;
        padding: 6px 4px;
        cursor: pointer;
        font-size: 10px;
        font-family: inherit;
        transition: all 0.1s;
      }
      .mode-pills button.active {
        background: #f0fdf4;
        border-color: var(--accent);
        color: var(--accent);
        font-weight: 700;
      }

      .type-pill {
        display: inline-block;
        color: #fff;
        padding: 1px 7px;
        border-radius: 3px;
        font-size: 9px;
        text-transform: uppercase;
        margin-right: 5px;
      }
      .el-foot {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 10px;
      }
      .del-btn {
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: var(--danger);
        border-radius: 5px;
        padding: 4px 10px;
        cursor: pointer;
        font-size: 10px;
        font-family: inherit;
      }
      .del-btn:hover {
        background: var(--danger);
        color: #fff;
      }
      .empty-hint {
        font-size: 11px;
        color: var(--muted);
        line-height: 1.6;
        margin: 0;
      }

      .shortcuts {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .shortcuts span {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 10px;
        color: var(--muted);
      }
      kbd {
        background: #e8e8e0;
        border: 1px solid #c8c8c0;
        border-radius: 3px;
        padding: 1px 5px;
        font-size: 9px;
        font-family: inherit;
        color: #333;
      }

      .ed-canvas {
        flex: 1;
        overflow: auto;
        background: #d8d8d0;
        background-image: radial-gradient(circle, #b8b8b0 1px, transparent 1px);
        background-size: 16px 16px;
      }
      .canvas-scroll {
        padding: 24px;
        display: inline-block;
        min-width: 100%;
      }
      .canvas-stage {
        display: inline-flex;
        flex-direction: column;
        gap: 6px;
      }
      .canvas-row {
        display: flex;
        gap: 8px;
      }

      .ruler {
        position: relative;
        background: #eeeee8;
      }
      .ruler--h {
        height: 24px;
        border-bottom: 1px solid #ccc;
        margin-left: 32px;
      }
      .ruler--v {
        width: 32px;
        border-right: 1px solid #ccc;
      }
      .ruler-corner {
        position: absolute;
        left: -32px;
        top: 0;
        width: 32px;
        height: 24px;
        background: #e4e4dc;
        border-right: 1px solid #ccc;
        border-bottom: 1px solid #ccc;
      }
      .r-tick {
        position: absolute;
      }
      .r-tick--h {
        bottom: 0;
        border-left: 1px solid #aaa;
        height: 4px;
      }
      .r-tick--h.major {
        height: 10px;
      }
      .r-tick--h.major span {
        position: absolute;
        bottom: 11px;
        left: 2px;
        font-size: 8px;
        color: #888;
        white-space: nowrap;
      }
      .r-tick--v {
        left: 0;
        border-top: 1px solid #aaa;
        width: 4px;
      }
      .r-tick--v.major {
        width: 10px;
      }
      .r-tick--v.major span {
        position: absolute;
        left: 11px;
        top: -8px;
        font-size: 8px;
        color: #888;
      }

      .canvas-info {
        font-size: 10px;
        color: #888;
        margin-top: 6px;
        margin-left: 32px;
      }

      .label-canvas {
        position: relative;
        background: white;
        flex-shrink: 0;
        cursor: default;
        box-shadow:
          0 4px 16px rgba(0, 0, 0, 0.18),
          0 0 0 1px rgba(0, 0, 0, 0.06);
        min-height: calc(100% + 8px);
      }
      .label-canvas.tool-active {
        cursor: crosshair;
      }
      .canvas-grid {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .canvas-border {
        position: absolute;
        inset: 0;
        border: 1.5px solid #999;
        pointer-events: none;
        z-index: 5;
      }
      .col-tag {
        position: absolute;
        bottom: 3px;
        right: 5px;
        font-size: 8px;
        color: #bbb;
        pointer-events: none;
        z-index: 6;
      }

      .canvas-el {
        position: absolute;
        cursor: grab;
        user-select: none;
        border: 1px solid transparent;
        border-radius: 1px;
        z-index: 2;
        transition: border-color 0.08s;
      }
      .canvas-el:hover {
        border-color: rgba(22, 163, 74, 0.4);
      }
      .canvas-el.sel {
        border-color: var(--accent);
        z-index: 10;
      }
      .canvas-el.dragging {
        cursor: grabbing;
        z-index: 20;
        opacity: 0.88;
      }

      .el-text {
        display: block;
        color: #000;
      }
      .el-barcode {
        display: flex;
        flex-direction: column;
      }
      .bc-bars {
        display: flex;
        height: 100%;
        flex: 1;
      }
      .bc-text {
        font-size: 7px;
        text-align: center;
        color: #000;
        font-family: monospace;
        margin-top: 1px;
      }

      .sel-h {
        position: absolute;
        width: 6px;
        height: 6px;
        background: #fff;
        border: 1.5px solid var(--accent);
        border-radius: 1px;
        z-index: 11;
      }
      .sel-h--tl {
        top: -3px;
        left: -3px;
      }
      .sel-h--tr {
        top: -3px;
        right: -3px;
      }
      .sel-h--bl {
        bottom: -3px;
        left: -3px;
      }
      .sel-h--br {
        bottom: -3px;
        right: -3px;
      }
      .sel-pos {
        position: absolute;
        top: -18px;
        left: 0;
        font-size: 9px;
        background: var(--accent);
        color: #fff;
        padding: 1px 5px;
        border-radius: 3px;
        white-space: nowrap;
        pointer-events: none;
        z-index: 15;
      }

      .mobile-nav {
        display: none;
      }
      @media (max-width: 768px) {
        .mobile-nav {
          display: flex;
          align-items: center;
          justify-content: space-around;
          height: 52px;
          flex-shrink: 0;
          background: var(--bar);
          border-top: 1px solid #000;
          padding: 0 4px;
        }
        .bar-tools {
          display: none;
        }
      }
      .mnav-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        background: none;
        border: none;
        color: #71717a;
        cursor: pointer;
        font-family: inherit;
        padding: 6px 8px;
        border-radius: var(--radius);
        font-size: 9px;
        transition: all 0.12s;
        min-width: 48px;
      }
      .mnav-btn span {
        font-size: 9px;
      }
      .mnav-btn:hover,
      .mnav-btn.on {
        color: #86efac;
      }
      .mnav-btn.warn {
        color: #fca5a5;
      }
      .mnav-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }

      ::-webkit-scrollbar {
        width: 5px;
        height: 5px;
      }
      ::-webkit-scrollbar-track {
        background: var(--bg);
      }
      ::-webkit-scrollbar-thumb {
        background: #c0c0b8;
        border-radius: 3px;
      }
    `,
  ],
})
export class TemplateEditorComponent implements OnInit, OnDestroy {
  @Input() template: LabelTemplate | null = null;
  @Output() saved = new EventEmitter<LabelTemplate>();
  @Output() closed = new EventEmitter<void>();
  leftOpen = signal(true);
  rightOpen = signal(true);
  private svc = inject(PrinterTemplateService);
  private cdr = inject(ChangeDetectorRef);

  readonly PX = PX_PER_MM;
  readonly DPM = DPM;
  readonly VARS = AVAILABLE_VARIABLES;

  saving = signal(false);
  selectedId = signal<string | null>(null);
  draggingId = signal<string | null>(null);
  activeTool = signal<'select' | 'text' | 'barcode' | 'qr' | 'line' | 'rect'>(
    'select',
  );
  previewMode = signal<'exhibicion' | 'venta'>('exhibicion');
  elements = signal<LabelElement[]>([]);

  meta: Omit<LabelTemplate, 'id' | 'elements'> = {
    nombre: '',
    width: 50,
    height: 30,
    gap: 3,
    cols: 1,
    copies: 1,
  };

  canvasW = computed(() => Math.round(this.meta.width * this.PX));
  canvasH = computed(() => Math.round(this.meta.height * this.PX));
  colsArr = computed(() =>
    Array.from({ length: Math.max(1, this.meta.cols) }, (_, i) => i),
  );

  selectedEl = computed(() => {
    const id = this.selectedId();
    return id ? (this.elements().find((e) => e.id === id) ?? null) : null;
  });

  elementsReversed = computed(() => [...this.elements()].reverse());

  hRulerMarks = computed(() =>
    Array.from({ length: this.meta.width + 1 }, (_, i) => i),
  );
  vRulerMarks = computed(() =>
    Array.from({ length: this.meta.height + 1 }, (_, i) => i),
  );

  textHeightInfo = computed(() => {
    const el = this.selectedEl();
    if (!el || el.type !== 'text') return '0';
    const t = el as TextElement;
    return ((FONT_DOTS[t.fontCode].h * t.scaleY) / DPM).toFixed(1);
  });

  textWidthInfo = computed(() => {
    const el = this.selectedEl();
    if (!el || el.type !== 'text') return '0';
    const t = el as TextElement;
    const text = resolveVariables(t.content, PREVIEW_VARS);
    return ((FONT_DOTS[t.fontCode].w * t.scaleX * text.length) / DPM).toFixed(
      1,
    );
  });

  qrSizeInfo = computed(() => {
    const el = this.selectedEl();
    if (!el || el.type !== 'qr') return '0';
    return qrSizeMm(el as QrElement).toFixed(1);
  });

  private drag: {
    id: string;
    startMx: number;
    startMy: number;
    startX: number;
    startY: number;
  } | null = null;

  ngOnInit(): void {
    if (this.template) {
      this.meta = {
        nombre: this.template.nombre,
        width: this.template.width,
        height: this.template.height,
        gap: this.template.gap,
        cols: this.template.cols,
        copies: this.template.copies,
      };
      this.elements.set(
        this.template.elements?.length
          ? JSON.parse(JSON.stringify(this.template.elements))
          : defaultElements(this.template.width, this.template.height),
      );
    } else {
      this.elements.set(defaultElements(this.meta.width, this.meta.height));
    }
    this.elements().forEach((el) => {
      if (el.type === 'qr') this.generateQr((el as QrElement).content);
    });
  }

  private qrCache = signal<Record<string, string>>({});

  ngOnDestroy(): void {
    this.cleanupDrag();
  }

  addText(): void {
    const el: TextElement = {
      id: newId(),
      type: 'text',
      visible: true,
      locked: false,
      x: 2,
      y: 2,
      content: 'Texto',
      fontCode: '2',
      scaleX: 1,
      scaleY: 1,
      bold: false,
    };
    this.elements.update((els) => [...els, el]);
    this.select(el.id);
    this.activeTool.set('select');
  }

  addBarcode(): void {
    const el: BarcodeElement = {
      id: newId(),
      type: 'barcode',
      visible: true,
      locked: false,
      x: 2,
      y: 5,
      content: '{{codigo}}',
      barcodeType: 'CODE128',
      height: 10,
      showText: true,
      narrow: 2,
    };
    this.elements.update((els) => [...els, el]);
    this.select(el.id);
    this.activeTool.set('select');
  }

  addQr(): void {
    const el: QrElement = {
      id: newId(),
      type: 'qr',
      visible: true,
      locked: false,
      x: 2,
      y: 5,
      content: '{{codigo}}',
      moduleSize: 4,
    };
    this.elements.update((els) => [...els, el]);
    this.generateQr(el.content);
    this.select(el.id);
    this.activeTool.set('select');
  }

  addLine(): void {
    const el: LineElement = {
      id: newId(),
      type: 'line',
      visible: true,
      locked: false,
      x: 1,
      y: 15,
      width: this.meta.width - 2,
      thickness: 2,
      direction: 'h',
    };
    this.elements.update((els) => [...els, el]);
    this.select(el.id);
    this.activeTool.set('select');
  }

  addRect(): void {
    const el: RectElement = {
      id: newId(),
      type: 'rect',
      visible: true,
      locked: false,
      x: 2,
      y: 2,
      width: 20,
      height: 10,
      thickness: 2,
    };
    this.elements.update((els) => [...els, el]);
    this.select(el.id);
    this.activeTool.set('select');
  }

  select(id: string): void {
    this.selectedId.set(id);
  }

  toggleVisible(id: string): void {
    this.elements.update((els) =>
      els.map((e) => (e.id === id ? { ...e, visible: !e.visible } : e)),
    );
  }

  deleteSelected(): void {
    const id = this.selectedId();
    if (!id) return;
    this.elements.update((els) => els.filter((e) => e.id !== id));
    this.selectedId.set(null);
  }

  updateEl(key: string, value: any): void {
    const id = this.selectedId();
    if (!id) return;
    this.elements.update((els) =>
      els.map((e) => (e.id === id ? { ...e, [key]: value } : e)),
    );
    const el = this.elements().find((e) => e.id === id);
    if (el?.type === 'qr' && key === 'content') {
      this.generateQr(value);
    }
  }

  insertVar(key: string): void {
    const id = this.selectedId();
    if (!id) return;
    const el = this.elements().find((e) => e.id === id);
    if (
      !el ||
      (el.type !== 'text' && el.type !== 'barcode' && el.type !== 'qr')
    )
      return;
    const cur = (el as any).content ?? '';
    this.updateEl('content' as any, cur + `{{${key}}}`);
  }

  onCanvasDown(event: MouseEvent, col: number): void {
    if (
      (event.target as HTMLElement).classList.contains('label-canvas') ||
      (event.target as HTMLElement).classList.contains('canvas-grid') ||
      (event.target as HTMLElement).tagName === 'rect' ||
      (event.target as HTMLElement).tagName === 'svg'
    ) {
      this.selectedId.set(null);
    }
  }

  onCanvasMove(event: MouseEvent): void {}
  onCanvasUp(event: MouseEvent): void {}

  onElDown(event: MouseEvent, id: string): void {
    event.preventDefault();
    event.stopPropagation();

    const el = this.elements().find((e) => e.id === id);
    if (!el) return;

    this.select(id);
    this.draggingId.set(id);

    this.drag = {
      id,
      startMx: event.clientX,
      startMy: event.clientY,
      startX: el.x,
      startY: el.y,
    };

    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.drag) return;
    const snap = 0.5;
    const dxMm = (e.clientX - this.drag.startMx) / this.PX;
    const dyMm = (e.clientY - this.drag.startMy) / this.PX;

    const newX = Math.max(
      0,
      Math.min(
        this.meta.width - 0.5,
        Math.round((this.drag.startX + dxMm) / snap) * snap,
      ),
    );
    const newY = Math.max(
      0,
      Math.min(
        this.meta.height - 0.5,
        Math.round((this.drag.startY + dyMm) / snap) * snap,
      ),
    );

    this.elements.update((els) =>
      els.map((e) => (e.id === this.drag!.id ? { ...e, x: newX, y: newY } : e)),
    );
    this.cdr.markForCheck();
  };

  private onMouseUp = (): void => {
    this.draggingId.set(null);
    this.drag = null;
    this.cleanupDrag();
  };

  private cleanupDrag(): void {
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }

  shouldShow(el: LabelElement): boolean {
    const content = 'content' in el ? ((el as any).content as string) : '';

    if (this.previewMode() === 'venta') {
      if (content.includes('{{local}}')) return false;
    }

    return true;
  }

  resolvedText(el: TextElement): string {
    return resolveVariables(el.content, PREVIEW_VARS);
  }

  resolvedContent(el: BarcodeElement | QrElement): string {
    return resolveVariables(el.content, PREVIEW_VARS);
  }

  textFontPx(el: TextElement): number {
    return ((FONT_DOTS[el.fontCode].h * el.scaleY) / DPM) * this.PX;
  }

  letterSpacing(el: TextElement): number {
    const charWidthPx =
      ((FONT_DOTS[el.fontCode].w * el.scaleX) / DPM) * this.PX;
    const naturalFontPx = this.textFontPx(el) * 0.6;
    return charWidthPx - naturalFontPx;
  }

  barcodeWidthPx(el: BarcodeElement): number {
    const value = this.resolvedContent(el);
    const modules = value.length * 11 + 35;
    return ((modules * el.narrow) / DPM) * this.PX;
  }

  barcodeBars(el: BarcodeElement): { w: number; dark: boolean }[] {
    const value = this.resolvedContent(el);
    const bars: { w: number; dark: boolean }[] = [];
    bars.push({ w: el.narrow * 2, dark: true });
    bars.push({ w: el.narrow, dark: false });
    bars.push({ w: el.narrow, dark: true });
    for (let i = 0; i < value.length; i++) {
      const c = value.charCodeAt(i);
      bars.push({ w: el.narrow * (1 + (c % 2)), dark: true });
      bars.push({ w: el.narrow * (1 + ((c >> 1) % 2)), dark: false });
      bars.push({ w: el.narrow * (1 + ((c >> 2) % 2)), dark: true });
      bars.push({ w: el.narrow, dark: false });
    }
    bars.push({ w: el.narrow * 2, dark: true });
    bars.push({ w: el.narrow, dark: false });
    bars.push({ w: el.narrow * 2, dark: true });
    return bars;
  }

  qrPx(el: QrElement): number {
    return qrSizeMm(el) * this.PX;
  }

  colorFor(el: LabelElement): string {
    return EL_COLORS[el.type] ?? '#aaa';
  }

  layerLabel(el: LabelElement): string {
    switch (el.type) {
      case 'text':
        return `T: ${(el as TextElement).content.substring(0, 18)}`;
      case 'barcode':
        return `▐▌ ${(el as BarcodeElement).barcodeType}`;
      case 'qr':
        return `⬜ QR: ${(el as QrElement).content.substring(0, 12)}`;
      case 'line':
        return `― Línea ${(el as LineElement).direction === 'h' ? 'H' : 'V'}`;
      case 'rect':
        return `□ Rectángulo`;
    }
  }

  asText = (el: LabelElement) => el as TextElement;
  asBarcode = (el: LabelElement) => el as BarcodeElement;
  asQr = (el: LabelElement) => el as QrElement;
  asLine = (el: LabelElement) => el as LineElement;
  asRect = (el: LabelElement) => el as RectElement;

  get asTextSel() {
    return this.selectedEl() as TextElement;
  }
  get asBarcodeSel() {
    return this.selectedEl() as BarcodeElement;
  }
  get asQrSel() {
    return this.selectedEl() as QrElement;
  }
  get asLineSel() {
    return this.selectedEl() as LineElement;
  }
  get asRectSel() {
    return this.selectedEl() as RectElement;
  }

  onSizeChange(): void {
    this.elements.update((els) =>
      els.map((e) => ({
        ...e,
        x: Math.min(e.x, this.meta.width - 0.5),
        y: Math.min(e.y, this.meta.height - 0.5),
      })),
    );
  }

  resetElements(): void {
    if (confirm('¿Resetear todos los elementos al diseño por defecto?')) {
      this.elements.set(defaultElements(this.meta.width, this.meta.height));
      this.selectedId.set(null);
    }
  }

  async save(): Promise<void> {
    if (!this.meta.nombre.trim()) {
      alert('Escribe un nombre para la plantilla.');
      return;
    }
    this.saving.set(true);
    try {
      const data: Omit<LabelTemplate, 'id'> = {
        ...this.meta,
        elements: this.elements(),
      };
      let saved: LabelTemplate;
      if (this.template?.id) {
        const updated: LabelTemplate = { ...data, id: this.template.id };
        await this.svc.updateTemplate(updated);
        saved = updated;
      } else {
        saved = await this.svc.saveTemplate(data);
      }
      this.svc.setActiveTemplate(saved);
      this.saved.emit(saved);
    } finally {
      this.saving.set(false);
    }
  }

  onClose(): void {
    this.closed.emit();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    switch (e.key) {
      case 'Escape':
        if (this.selectedId()) this.selectedId.set(null);
        else this.closed.emit();
        break;
      case 'Delete':
      case 'Backspace':
        this.deleteSelected();
        break;
      case 't':
      case 'T':
        this.addText();
        break;
      case 'l':
      case 'L':
        this.addLine();
        break;
      case 'r':
      case 'R':
        this.addRect();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.nudge(0, -0.5);
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.nudge(0, 0.5);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.nudge(-0.5, 0);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.nudge(0.5, 0);
        break;
    }
  }
  async generateQr(content: string): Promise<void> {
    const resolved = resolveVariables(content, PREVIEW_VARS);
    if (this.qrCache()[resolved]) return;

    try {
      const url = await QRCode.toDataURL(resolved, {
        width: 200,
        margin: 0,
        errorCorrectionLevel: 'M',
      });
      this.qrCache.update((cache) => ({ ...cache, [resolved]: url }));
      this.cdr.markForCheck();
    } catch (e) {
      console.error('Error generando QR:', e);
    }
  }

  getQrUrl(content: string): string {
    const resolved = resolveVariables(content, PREVIEW_VARS);
    return this.qrCache()[resolved] ?? '';
  }
  private nudge(dx: number, dy: number): void {
    const id = this.selectedId();
    if (!id) return;
    this.elements.update((els) =>
      els.map((e) =>
        e.id === id
          ? {
              ...e,
              x: Math.max(0, Math.min(this.meta.width - 0.5, e.x + dx)),
              y: Math.max(0, Math.min(this.meta.height - 0.5, e.y + dy)),
            }
          : e,
      ),
    );
  }
}
