import { Component, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  DEFAULT_LABEL_CONFIG,
  LabelConfig,
} from '../../services/printer-template/printer-template.service';

@Component({
  selector: 'app-label-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="label-config">
      <h3>⚙️ Configuración de Etiqueta</h3>

      <div class="grid-2">
        <label>
          Ancho (mm)
          <input type="number" [(ngModel)]="config.width" min="20" max="120" />
        </label>
        <label>
          Alto (mm)
          <input type="number" [(ngModel)]="config.height" min="10" max="200" />
        </label>
        <label>
          Columnas
          <input type="number" [(ngModel)]="config.cols" min="1" max="5" />
        </label>
        <label>
          Margen superior (mm)
          <input
            type="number"
            [(ngModel)]="config.marginTop"
            min="0"
            max="20"
          />
        </label>
        <label>
          Margen izquierdo (mm)
          <input
            type="number"
            [(ngModel)]="config.marginLeft"
            min="0"
            max="20"
          />
        </label>
        <label>
          Separación gap (mm)
          <input type="number" [(ngModel)]="config.gap" min="0" max="10" />
        </label>
        <label>
          Tamaño fuente (pt)
          <input
            type="number"
            [(ngModel)]="config.fontSize"
            min="8"
            max="32"
            step="2"
          />
        </label>
        <label>
          Copias
          <input type="number" [(ngModel)]="config.copies" min="1" max="99" />
        </label>
        <label>
          Rotación
          <select [(ngModel)]="config.rotation">
            <option [ngValue]="0">0°</option>
            <option [ngValue]="90">90°</option>
            <option [ngValue]="180">180°</option>
            <option [ngValue]="270">270°</option>
          </select>
        </label>
        <label>
          Alineación
          <select [(ngModel)]="config.align">
            <option value="left">Izquierda</option>
            <option value="center">Centro</option>
            <option value="right">Derecha</option>
          </select>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" [(ngModel)]="config.bold" />
          Negrita
        </label>
      </div>

      <div class="preview-container">
        <p class="preview-title">Vista previa:</p>

        <div class="cols-preview">
          @for (col of colsArray; track col) {
            <div
              class="label-preview"
              [style.width.px]="config.width * 2"
              [style.height.px]="config.height * 2"
            >
              <div
                class="label-content"
                [style.font-size.px]="config.fontSize * 0.8"
                [style.font-weight]="config.bold ? 'bold' : 'normal'"
                [style.text-align]="config.align"
                [style.transform]="'rotate(' + config.rotation + 'deg)'"
                [style.padding.px]="config.marginLeft"
              >
                <div *ngFor="let line of previewLines">{{ line }}</div>
              </div>
            </div>
          }
        </div>

        <p class="preview-size">
          {{ config.width }} × {{ config.height }} mm
          @if (config.cols > 1) {
            · {{ config.cols }} columnas (papel
            {{ config.width * config.cols }} mm)
          }
        </p>
      </div>

      <button (click)="applyConfig()">Aplicar configuración</button>
    </div>
  `,
  styles: [
    `
      .label-config {
        padding: 1rem;
        border-top: 1px solid #eee;
        margin-top: 1rem;
      }
      h3 {
        margin: 0 0 1rem;
        font-size: 1rem;
        color: #333;
      }
      .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 0.85rem;
        color: #444;
      }
      input[type='number'],
      select {
        padding: 0.4rem;
        border: 1px solid #ccc;
        border-radius: 6px;
        font-size: 0.9rem;
      }
      .checkbox-label {
        flex-direction: row;
        align-items: center;
        gap: 8px;
        padding-top: 1.2rem;
      }
      .checkbox-label input {
        width: 16px;
        height: 16px;
        cursor: pointer;
      }
      .preview-container {
        margin: 1.2rem 0;
      }
      .preview-title {
        margin: 0 0 6px;
        font-size: 0.85rem;
        color: #666;
      }
      .preview-size {
        margin: 4px 0 0;
        font-size: 0.75rem;
        color: #999;
      }
      .label-preview {
        border: 2px dashed #bbb;
        display: flex;
        align-items: center;
        justify-content: center;
        background: white;
        border-radius: 4px;
        max-width: 100%;
        overflow: hidden;
        transition:
          width 0.2s,
          height 0.2s;
      }
      .label-preview span {
        display: block;
        transition: all 0.2s;
        word-break: break-word;
      }
      button {
        background: #1a73e8;
        color: white;
        border: none;
        padding: 0.6rem 1.2rem;
        border-radius: 8px;
        cursor: pointer;
        width: 100%;
        font-size: 0.95rem;
      }
      button:hover {
        background: #1558b0;
      }
      .cols-preview {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
      }

      .label-preview {
        border: 2px dashed #bbb;
        background: white;
        border-radius: 4px;
        overflow: hidden;
        transition:
          width 0.2s,
          height 0.2s;
        flex-shrink: 0;
      }

      .label-content {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        padding-top: 4px;
        box-sizing: border-box;
        word-break: break-word;
        overflow: hidden;
      }
    `,
  ],
})
export class LabelConfigComponent {
  configChanged = output<LabelConfig>();
  config: LabelConfig = { ...DEFAULT_LABEL_CONFIG };

  previewLines = ['Producto: Ejemplo', 'Precio: $10.000', 'Cód: 001'];

  get colsArray(): number[] {
    return Array.from({ length: this.config.cols }, (_, i) => i);
  }

  applyConfig() {
    this.configChanged.emit({ ...this.config });
  }
}
