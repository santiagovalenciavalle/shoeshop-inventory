import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { LabelConfigComponent } from '../label-config/label-config.component';
import { BluetoothPrinterService } from '../../services/bluetooth-printer/bluetooth-printer.service';
import {
  DEFAULT_LABEL_CONFIG,
  LabelConfig,
  LabelTemplate,
  LabelVariables,
  PrinterTemplateService,
} from '../../services/printer-template/printer-template.service';

@Component({
  selector: 'app-printer-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, LabelConfigComponent],
  template: `
    <div class="printer-panel">
      <div class="status-bar" [class.connected]="printer.isConnected()">
        <span class="dot"></span>
        <span>{{
          printer.isConnected() ? '🖨️ ' + printer.deviceName() : 'Sin conexión'
        }}</span>
      </div>

      <div class="actions">
        @if (!printer.isConnected()) {
          <button
            class="btn-primary"
            (click)="connect()"
            [disabled]="printer.isConnecting()"
          >
            {{
              printer.isConnecting() ? 'Conectando...' : '🔗 Conectar impresora'
            }}
          </button>
        } @else {
          <button class="btn-danger" (click)="printer.disconnect()">
            Desconectar
          </button>
        }
      </div>

      @if (printer.error()) {
        <div class="error-box">⚠️ {{ printer.error() }}</div>
      }

      <div class="print-area">
        <label>Contenido de la etiqueta:</label>
        <textarea
          [(ngModel)]="labelText"
          rows="4"
          placeholder="Escribe el texto de la etiqueta..."
        ></textarea>
        <span class="hint">Cada línea = una línea en la etiqueta</span>
      </div>

      <app-label-config (configChanged)="onConfigChange($event)" />

      <button
        class="btn-print"
        (click)="print()"
        [disabled]="!printer.isConnected() || isPrinting()"
      >
        {{ isPrinting() ? '⏳ Imprimiendo...' : '🖨️ Imprimir etiqueta' }}
      </button>

      @if (printSuccess()) {
        <div class="success-box">✅ Impresión enviada correctamente</div>
      }

      @if (printError()) {
        <div class="error-box">❌ {{ printError() }}</div>
      }
    </div>
  `,
  styles: [
    `
      .printer-panel {
        max-width: 500px;
        margin: 0 auto;
        padding: 1rem;
        font-family: sans-serif;
      }
      .status-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        background: #f0f0f0;
        margin-bottom: 1rem;
      }
      .status-bar.connected {
        background: #e6f4ea;
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #ccc;
      }
      .connected .dot {
        background: #34a853;
      }
      .actions {
        margin-bottom: 1rem;
      }
      .btn-primary,
      .btn-danger,
      .btn-print {
        padding: 0.6rem 1.2rem;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 1rem;
        width: 100%;
      }
      .btn-primary {
        background: #1a73e8;
        color: white;
      }
      .btn-danger {
        background: #d93025;
        color: white;
      }
      .btn-print {
        background: #188038;
        color: white;
        margin-top: 1rem;
        font-size: 1.1rem;
        padding: 0.8rem;
      }
      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      textarea {
        width: 100%;
        box-sizing: border-box;
        padding: 0.5rem;
        border-radius: 6px;
        border: 1px solid #ccc;
      }
      label {
        display: block;
        margin-bottom: 4px;
        font-weight: 500;
      }
      .hint {
        display: block;
        font-size: 0.78rem;
        color: #888;
        margin-top: 4px;
      }
      .print-area {
        margin-bottom: 1rem;
      }
      .error-box {
        background: #fce8e6;
        color: #c5221f;
        padding: 0.6rem;
        border-radius: 6px;
        margin: 0.5rem 0;
      }
      .success-box {
        background: #e6f4ea;
        color: #137333;
        padding: 0.6rem;
        border-radius: 6px;
        margin-top: 0.5rem;
      }
    `,
  ],
})
export class PrinterPanelComponent {
  printer = inject(BluetoothPrinterService);

  labelConfig = signal<LabelConfig>({ ...DEFAULT_LABEL_CONFIG });
  isPrinting = signal(false);
  printSuccess = signal(false);
  printError = signal<string | null>(null);

  async connect() {
    await this.printer.connectBluetooth();
  }

  onConfigChange(config: LabelConfig) {
    this.labelConfig.set(config);
  }

  templateService = inject(PrinterTemplateService);
  labelText = signal('');

  async print() {
    this.isPrinting.set(true);
    this.printSuccess.set(false);
    this.printError.set(null);

    try {
      const template: LabelTemplate = this.templateService.activeTemplate() ?? {
        nombre: 'Default',
        width: 50,
        height: 30,
        gap: 3,
        cols: 1,
        copies: 1,
        elements: [],
      };

      const vars: LabelVariables = {
        marca: 'Ejemplo',
        codigo: '001',
      };

      await this.printer.printLabel(template, vars);
      this.printSuccess.set(true);
      setTimeout(() => this.printSuccess.set(false), 3000);
    } catch (err: any) {
      this.printError.set(err.message ?? 'Error desconocido');
      setTimeout(() => this.printError.set(null), 5000);
    } finally {
      this.isPrinting.set(false);
    }
  }
}
