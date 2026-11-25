import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BluetoothPrinterService } from '../../services/bluetooth-printer/bluetooth-printer.service';
import {
  LabelTemplate,
  PrinterTemplate,
  PrinterTemplateService,
} from '../../services/printer-template/printer-template.service';
import { TemplateEditorComponent } from '../template-editor-component/template-editor-component.component';

@Component({
  selector: 'app-printer-fab',
  standalone: true,
  imports: [CommonModule, FormsModule, TemplateEditorComponent],
  template: `
    <button
      class="fab"
      (click)="toggleModal()"
      [class.connected]="printer.isConnected()"
    >
      <span class="fab-icon">🖨️</span>
      @if (printer.isConnected()) {
        <span class="fab-dot"></span>
      }
    </button>

    @if (modalOpen()) {
      <div class="fab-overlay" (click)="closeModal()"></div>
      <div class="fab-modal">
        <div class="fab-header">
          <h2>Impresora de Stickers</h2>
          <button class="close-btn" (click)="closeModal()">✕</button>
        </div>

        <div class="fab-section">
          <h3>Conexión</h3>
          <div class="status-row" [class.ok]="printer.isConnected()">
            <span class="status-dot"></span>
            <span>
              @if (printer.isConnected()) {
                {{ connType === 'usb' ? '🔌' : '📶' }}
                {{ printer.deviceName() }}
              } @else {
                Sin conexión
              }
            </span>
          </div>

          @if (!printer.isConnected()) {
            <button
              class="btn-primary full"
              (click)="connectBT()"
              [disabled]="printer.isConnecting()"
            >
              {{
                printer.isConnecting() ? 'Buscando...' : '📶 Conectar Bluetooth'
              }}
            </button>
            <button
              class="btn-usb full"
              (click)="connectUSB()"
              [disabled]="printer.isConnecting()"
            >
              🔌 Conectar por Cable USB
            </button>
            <p class="hint-conn">USB requiere Chrome/Edge con HTTPS</p>
          } @else {
            <button class="btn-danger full" (click)="printer.disconnect()">
              Desconectar
            </button>
            <button
              class="btn-test full"
              (click)="imprimirPrueba()"
              [disabled]="imprimiendoPrueba()"
            >
              {{
                imprimiendoPrueba()
                  ? 'Imprimiendo...'
                  : '🧪 Prueba de impresión'
              }}
            </button>
          }
          @if (printer.error()) {
            <p class="error-text">⚠️ {{ printer.error() }}</p>
          }
        </div>

        <div class="fab-section">
          <div class="section-row">
            <h3>Plantilla activa</h3>

            <button class="btn-sm" (click)="editingTemplate.set(null)">
              + Nueva
            </button>
          </div>

          @if (templateService.activeTemplate()) {
            <div class="active-chip">
              <span>📋 {{ templateService.activeTemplate()!.nombre }}</span>
              <span class="chip-size"
                >{{ templateService.activeTemplate()!.width }}×{{
                  templateService.activeTemplate()!.height
                }}mm · {{ templateService.activeTemplate()!.cols }} col</span
              >
            </div>
          } @else {
            <p class="hint">No hay plantilla seleccionada</p>
          }
        </div>

        @if (modoNueva()) {
          <div class="fab-section form-section">
            <h3>Nueva plantilla</h3>
            <label>
              Nombre
              <input
                [(ngModel)]="nuevaPlantilla.nombre"
                placeholder="Ej: Sticker 50x30 · 2 col"
              />
            </label>
            <div class="grid-2">
              <label
                >Ancho (mm)
                <input
                  type="number"
                  [(ngModel)]="nuevaPlantilla.width"
                  min="20"
                  max="120"
                />
              </label>
              <label
                >Alto (mm)
                <input
                  type="number"
                  [(ngModel)]="nuevaPlantilla.height"
                  min="10"
                  max="200"
                />
              </label>
              <label
                >Columnas
                <input
                  type="number"
                  [(ngModel)]="nuevaPlantilla.cols"
                  min="1"
                  max="5"
                />
              </label>
              <label
                >Gap (mm)
                <input
                  type="number"
                  [(ngModel)]="nuevaPlantilla.gap"
                  min="0"
                  max="10"
                />
              </label>
              <label
                >Margen sup (mm)
                <input
                  type="number"
                  [(ngModel)]="nuevaPlantilla.marginTop"
                  min="0"
                  max="20"
                />
              </label>
              <label
                >Margen izq (mm)
                <input
                  type="number"
                  [(ngModel)]="nuevaPlantilla.marginLeft"
                  min="0"
                  max="20"
                />
              </label>
              <label
                >Copias
                <input
                  type="number"
                  [(ngModel)]="nuevaPlantilla.copies"
                  min="1"
                  max="99"
                />
              </label>
            </div>
            <button
              class="btn-primary full"
              (click)="guardarPlantilla()"
              [disabled]="guardando()"
            >
              {{ guardando() ? 'Guardando...' : '💾 Guardar plantilla' }}
            </button>
          </div>
        }

        <div class="fab-section">
          <h3>Mis plantillas</h3>

          @if (templateService.templates().length === 0) {
            <p class="hint">No hay plantillas guardadas</p>
          }
          @for (t of templateService.templates(); track t.id) {
            <div
              class="template-row"
              [class.active]="templateService.activeTemplate()?.id === t.id"
            >
              <div class="template-info" (click)="seleccionarPlantilla(t)">
                <span class="template-name">{{ t.nombre }}</span>
                <span class="template-meta"
                  >{{ t.width }}×{{ t.height }}mm · {{ t.cols }} col · fuente
                  {{ t.fontSize }}pt</span
                >
              </div>
              <button
                class="btn-edit"
                (click)="editingTemplate.set(t); $event.stopPropagation()"
              >
                ✏️
              </button>

              <button class="btn-sm" (click)="editingTemplate.set(null)">
                + Nueva
              </button>
              @if (confirmDeleteId() === t.id) {
                <div class="confirm-del">
                  <span>¿Eliminar?</span>
                  <button
                    class="btn-confirm-yes"
                    (click)="eliminarPlantilla(t.id!)"
                  >
                    Sí
                  </button>
                  <button
                    class="btn-confirm-no"
                    (click)="confirmDeleteId.set(null)"
                  >
                    No
                  </button>
                </div>
              } @else {
                <button class="btn-del" (click)="confirmDeleteId.set(t.id!)">
                  🗑
                </button>
              }
            </div>
          }
        </div>
        @if (editingTemplate() !== undefined) {
          <div class="editor-fullscreen">
            <app-template-editor
              [template]="editingTemplate() ?? null"
              (saved)="onTemplateSaved($event)"
              (closed)="editingTemplate.set(undefined)"
            />
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      .btn-test {
        background: #2a2a3e;
        color: #a78bfa;
        border: 1px solid #4c3d8a;
        border-radius: 8px;
        padding: 0.5rem 1rem;
        cursor: pointer;
        font-size: 0.85rem;
        margin-top: 6px;
        transition: background 0.15s;
      }
      .btn-test:hover:not(:disabled) {
        background: #3a3a5e;
      }
      .btn-test:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .fab {
        position: fixed;
        bottom: 70px;
        right: 24px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #1a1a2e;
        border: 2px solid #333;
        color: white;
        font-size: 24px;
        cursor: pointer;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        transition: all 0.2s;
      }
      .fab.connected {
        background: #0d3b1e;
        border-color: #34a853;
      }
      .fab:hover {
        transform: scale(1.08);
      }
      .fab-dot {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 10px;
        height: 10px;
        background: #34a853;
        border-radius: 50%;
        border: 2px solid #0d3b1e;
      }
      .fab-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9998;
        backdrop-filter: blur(2px);
      }
      .fab-modal {
        position: fixed;
        bottom: 90px;
        right: 24px;
        width: 360px;
        max-height: 80vh;
        overflow-y: auto;
        background: #0f0f1a;
        border: 1px solid #2a2a3e;
        border-radius: 16px;
        z-index: 9999;
        box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
        color: #e0e0e0;
      }
      .fab-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px 12px;
        border-bottom: 1px solid #2a2a3e;
        position: sticky;
        top: 0;
        background: #0f0f1a;
        z-index: 1;
      }
      .fab-header h2 {
        margin: 0;
        font-size: 1rem;
        color: #fff;
      }
      .close-btn {
        background: none;
        border: none;
        color: #888;
        cursor: pointer;
        font-size: 1.1rem;
      }
      .fab-section {
        padding: 14px 20px;
        border-bottom: 1px solid #1e1e2e;
      }
      .fab-section h3 {
        margin: 0 0 10px;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #666;
      }
      .section-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }
      .section-row h3 {
        margin: 0;
      }
      .status-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: #1a1a2e;
        border-radius: 8px;
        margin-bottom: 10px;
        font-size: 0.85rem;
      }
      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #555;
      }
      .status-row.ok .status-dot {
        background: #34a853;
      }
      .active-chip {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #0d2a1a;
        border: 1px solid #1a5c30;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 0.85rem;
      }
      .chip-size {
        color: #666;
        font-size: 0.75rem;
      }
      .template-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 8px;
        cursor: pointer;
        margin-bottom: 6px;
        background: #1a1a2e;
        border: 1px solid transparent;
        transition: all 0.15s;
      }
      .template-row:hover {
        border-color: #3a3a5e;
      }
      .template-row.active {
        border-color: #34a853;
        background: #0d2a1a;
      }
      .template-info {
        flex: 1;
      }
      .template-name {
        display: block;
        font-size: 0.9rem;
        color: #fff;
      }
      .template-meta {
        display: block;
        font-size: 0.72rem;
        color: #666;
        margin-top: 2px;
      }
      .btn-del {
        background: none;
        border: none;
        color: #c5221f;
        cursor: pointer;
        font-size: 1rem;
        padding: 4px;
      }
      .btn-primary {
        background: #1a73e8;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 0.5rem 1rem;
        cursor: pointer;
        font-size: 0.9rem;
      }
      .btn-danger {
        background: #c5221f;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 0.5rem 1rem;
        cursor: pointer;
        font-size: 0.9rem;
      }
      .btn-sm {
        background: #2a2a3e;
        color: #aaa;
        border: 1px solid #3a3a5e;
        border-radius: 6px;
        padding: 4px 10px;
        cursor: pointer;
        font-size: 0.78rem;
      }
      .full {
        width: 100%;
        margin-top: 8px;
      }
      .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-bottom: 8px;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 0.8rem;
        color: #aaa;
      }
      input,
      select {
        background: #1a1a2e;
        border: 1px solid #2a2a3e;
        border-radius: 6px;
        color: #e0e0e0;
        padding: 6px 8px;
        font-size: 0.85rem;
      }
      .checkbox-row {
        flex-direction: row !important;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .error-text {
        color: #f28b82;
        font-size: 0.8rem;
        margin: 6px 0 0;
      }
      .hint {
        color: #555;
        font-size: 0.8rem;
        margin: 4px 0;
      }
      .form-section {
        background: #0a0a14;
      }
      .confirm-del {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.72rem;
        color: #f28b82;
      }
      .btn-confirm-yes {
        background: #c5221f;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 2px 8px;
        cursor: pointer;
        font-size: 0.72rem;
      }
      .btn-confirm-no {
        background: #2a2a3e;
        color: #aaa;
        border: 1px solid #3a3a5e;
        border-radius: 4px;
        padding: 2px 8px;
        cursor: pointer;
        font-size: 0.72rem;
      }
      .editor-fullscreen {
        position: fixed;
        inset: 0;
        z-index: 10000;
        background: #07070f;
      }

      .btn-edit {
        background: none;
        border: none;
        color: #60a5fa;
        cursor: pointer;
        font-size: 0.85rem;
        padding: 4px;
      }
      .btn-usb {
        background: #1e3a5f;
        color: #60a5fa;
        border: 1px solid #2d5a9e;
        border-radius: 8px;
        padding: 0.5rem 1rem;
        cursor: pointer;
        font-size: 0.9rem;
        margin-top: 6px;
        width: 100%;
      }
      .btn-usb:hover:not(:disabled) {
        background: #2d5a9e;
      }
      .hint-conn {
        color: #444;
        font-size: 0.72rem;
        margin: 6px 0 0;
        text-align: center;
      }
    `,
  ],
})
export class PrinterFabComponent implements OnInit {
  printer = inject(BluetoothPrinterService);
  templateService = inject(PrinterTemplateService);
  imprimiendoPrueba = signal(false);
  editingTemplate = signal<PrinterTemplate | null | undefined>(undefined);

  modalOpen = signal(false);
  modoNueva = signal(false);
  guardando = signal(false);
  confirmDeleteId = signal<string | null>(null);
  nuevaPlantilla: Omit<PrinterTemplate, 'id'> = this.defaultNueva();

  private defaultNueva(): Omit<LabelTemplate, 'id'> {
    return {
      nombre: '',
      width: 50,
      height: 30,
      cols: 1,
      gap: 3,
      copies: 1,
      elements: [],
    };
  }

  async ngOnInit() {
    await this.templateService.loadTemplates();
  }

  get connType() {
    return this.printer.connectionType();
  }

  async connectBT() {
    await this.printer.connectBluetooth();
  }

  async connectUSB() {
    await this.printer.connectUSB();
  }

  onTemplateSaved(t: PrinterTemplate) {
    this.templateService.setActiveTemplate(t);
    this.editingTemplate.set(undefined);
  }

  async imprimirPrueba() {
    if (!this.printer.isConnected()) return;
    this.imprimiendoPrueba.set(true);
    try {
      let template = this.templateService.activeTemplate();

      if (!template?.elements?.length) {
        const { defaultElements } =
          await import('../../services/printer-template/printer-template.service');
        template = {
          nombre: 'Prueba',
          width: 50,
          height: 38,
          cols: 1,
          gap: 3,
          copies: 1,
          elements: defaultElements(50, 38),
        };
      }

      await this.printer.printLabel(template, {
        marca: 'Nike',
        referencia: 'Air Max 270 Negro',
        codigo: '732',
        talla: '43',
        local: 'LOCAL 125',
      });
    } finally {
      this.imprimiendoPrueba.set(false);
    }
  }

  toggleModal() {
    this.modalOpen.update((v) => !v);
  }
  closeModal() {
    this.modalOpen.set(false);
  }
  toggleNueva() {
    this.modoNueva.update((v) => !v);
    if (this.modoNueva()) this.nuevaPlantilla = this.defaultNueva();
  }

  seleccionarPlantilla(t: PrinterTemplate) {
    this.templateService.setActiveTemplate(t);
  }

  async guardarPlantilla() {
    if (!this.nuevaPlantilla.nombre.trim()) return;
    this.guardando.set(true);
    try {
      const saved = await this.templateService.saveTemplate(
        this.nuevaPlantilla,
      );
      this.templateService.setActiveTemplate(saved);
      this.modoNueva.set(false);
      this.nuevaPlantilla = this.defaultNueva();
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminarPlantilla(id: string) {
    await this.templateService.deleteTemplate(id);
  }
}
