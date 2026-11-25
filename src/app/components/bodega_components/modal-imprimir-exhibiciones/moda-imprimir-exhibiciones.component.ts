import { CommonModule } from '@angular/common';
import { IaSpinnerComponent } from '../../../shared/components/ia-loader/ia-spinner.component';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { exhibiciones } from '../../../pages/interfaces';
import { ExhibicionesService } from '../../../services/vendedorServices/exhibiciones/exhibiciones.service';
import {
  Local,
  LocalesService,
} from '../../../services/locales/locales.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { BluetoothPrinterService } from '../../../services/bluetooth-printer/bluetooth-printer.service';
import {
  LabelTemplate,
  LabelVariables,
  PrinterTemplateService,
} from '../../../services/printer-template/printer-template.service';
import { MieLocalCountPipe } from './local-count.pipe';
import { RouterModule } from '@angular/router';

import { IaLoaderComponent } from '../../../shared/components/ia-loader/ia-loader.component';
const FALLBACK_TEMPLATE: LabelTemplate = {
  nombre: 'Default',
  width: 50,
  height: 30,
  gap: 3,
  cols: 2,
  copies: 1,
  elements: [],
};

function extractLocalNumber(nombre: string): string {
  const match = nombre.match(/\d+/);
  return match ? match[0] : nombre.trim();
}

function exhibicionEnLocal(locales: string[], localNum: string): boolean {
  return locales.some((l) => extractLocalNumber(l) === localNum);
}

@Component({
  selector: 'app-modal-imprimir-exhibiciones',
  standalone: true,
  imports: [
    IaLoaderComponent,
    IaSpinnerComponent,
    CommonModule,
    FormsModule,
    ToastModule,
    MieLocalCountPipe,
    RouterModule,
  ],
  templateUrl: './modal-imprimir-exhibiciones.component.html',
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalImprimirExhibicionesComponent
  implements OnInit, OnDestroy, OnChanges
{
  @Input() open = false;
  @Output() closed = new EventEmitter<void>();

  todasExhibiciones: exhibiciones[] = [];
  locales: Local[] = [];
  cargando = true;

  searchTerm = '';
  searchCode = '';
  selectedLocalNum: string | null = null;

  modalElegirLocal = false;
  exhibicionParaImprimir: exhibiciones | null = null;
  localElegido: string | null = null;

  modalImprimirTodas = false;
  localTodasElegido: string | null = null;

  imprimiendo = false;
  progreso: { actual: number; total: number } | null = null;
  impresionOk = false;

  private subs = new Subscription();

  constructor(
    private exhibicionesService: ExhibicionesService,
    private localesService: LocalesService,
    public printerService: BluetoothPrinterService,
    public templateService: PrinterTemplateService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.localesService.reiniciarListener();
    this.subs.add(
      this.localesService.obtenerLocales().subscribe((ls) => {
        this.locales = ls.filter((l) => l.estado === 'Activo');
        this.cdr.markForCheck();
      }),
    );

    this.cargarExhibiciones();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      this.resetFiltros();
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private async cargarExhibiciones(): Promise<void> {
    this.cargando = true;
    this.cdr.markForCheck();
    await this.exhibicionesService.cargarTodasExhibiciones();
    this.subs.add(
      this.exhibicionesService.getExhibiciones$().subscribe((exs) => {
        this.todasExhibiciones = exs;
        this.cargando = false;
        this.cdr.markForCheck();
      }),
    );
  }

  exhibicionEnLocal(locales: string[], localNum: string): boolean {
    return locales.some((l) => extractLocalNumber(l) === localNum);
  }

  get exhibicionesFiltradas(): exhibiciones[] {
    const termMarca = this.searchTerm.trim().toLowerCase();
    const codigoExacto = this.searchCode.trim();

    return this.todasExhibiciones.filter((ex) => {
      let coincideTexto = true;

      if (codigoExacto) {
        coincideTexto = ex.zapatoId === codigoExacto;
      } else if (termMarca) {
        coincideTexto =
          ex.marca?.toLowerCase().includes(termMarca) ||
          ex.referencia?.toLowerCase().includes(termMarca) ||
          `${ex.marca} ${ex.referencia}`.toLowerCase().includes(termMarca) ||
          `${ex.referencia} ${ex.marca}`.toLowerCase().includes(termMarca);
      }

      const coincideLocal =
        !this.selectedLocalNum ||
        exhibicionEnLocal(ex.locales ?? [], this.selectedLocalNum);

      return coincideTexto && coincideLocal;
    });
  }

  get localesConExhibiciones(): Local[] {
    return this.locales.filter((l) => {
      const num = extractLocalNumber(l.nombre);
      return this.todasExhibiciones.some((ex) =>
        exhibicionEnLocal(ex.locales ?? [], num),
      );
    });
  }

  get localNumeroSeleccionado(): string {
    if (!this.selectedLocalNum) return '';
    return this.selectedLocalNum;
  }

  localesDeExhibicion(ex: exhibiciones): string {
    return (ex.locales ?? []).map(extractLocalNumber).join(', ');
  }

  extractNum = extractLocalNumber;

  resetFiltros(): void {
    this.searchTerm = '';
    this.searchCode = '';
    this.selectedLocalNum = null;
    this.imprimiendo = false;
    this.progreso = null;
    this.impresionOk = false;
    this.displayCount = 20;
  }

  cerrar(): void {
    if (this.imprimiendo) return;
    this.resetFiltros();
    this.closed.emit();
  }

  seleccionarLocal(num: string | null): void {
    this.selectedLocalNum = num === this.selectedLocalNum ? null : num;
    this.displayCount = 20;
    this.cdr.markForCheck();
  }

  abrirElegirLocal(ex: exhibiciones): void {
    if (!this.printerService.isConnected()) {
      this.messageService.add({
        severity: 'warn',
        summary: '🖨️ Sin impresora',
        detail: 'Conecta la impresora Bluetooth antes de imprimir.',
        life: 4000,
      });
      return;
    }
    this.exhibicionParaImprimir = ex;
    this.localElegido = null;
    this.impresionOk = false;
    this.modalElegirLocal = true;
    this.cdr.markForCheck();
  }

  cerrarElegirLocal(): void {
    if (this.imprimiendo) return;
    this.modalElegirLocal = false;
    this.exhibicionParaImprimir = null;
    this.localElegido = null;
    this.impresionOk = false;
    this.cdr.markForCheck();
  }

  async confirmarImprimirIndividual(): Promise<void> {
    const ex = this.exhibicionParaImprimir;
    if (!ex || !this.localElegido) return;

    this.imprimiendo = true;
    this.impresionOk = false;
    this.cdr.markForCheck();

    try {
      const template = this.buildTemplate();
      const vars: LabelVariables = {
        marca: ex.marca,
        referencia: ex.referencia,
        codigo: ex.zapatoId ?? ex.id?.toString() ?? '',
        talla: ex.talla,
        local: this.localElegido,
      };

      await this.printerService.printLabel(template, vars); // 👈 respeta copies y cols

      this.impresionOk = true;
      this.messageService.add({
        severity: 'success',
        summary: '✅ Impreso',
        detail: `${ex.marca} · ${ex.referencia} T${ex.talla} → Local ${this.localElegido}`,
        life: 3500,
      });
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: err?.message ?? 'No se pudo imprimir.',
        life: 5000,
      });
    } finally {
      this.imprimiendo = false;
      this.cdr.markForCheck();
    }
  }

  abrirImprimirTodas(): void {
    if (!this.printerService.isConnected()) {
      this.messageService.add({
        severity: 'warn',
        summary: '🖨️ Sin impresora',
        detail: 'Conecta la impresora Bluetooth antes de imprimir.',
        life: 4000,
      });
      return;
    }
    this.localTodasElegido = null;
    this.impresionOk = false;
    this.progreso = null;
    this.modalImprimirTodas = true;
    this.cdr.markForCheck();
  }

  displayCount = 20;

  cargarMas(): void {
    this.displayCount += 20;
  }

  cerrarImprimirTodas(): void {
    if (this.imprimiendo) return;
    this.modalImprimirTodas = false;
    this.localTodasElegido = null;
    this.impresionOk = false;
    this.progreso = null;
    this.cdr.markForCheck();
  }

  get exhibicionesDelLocalSeleccionado(): exhibiciones[] {
    if (!this.localTodasElegido) return [];
    return this.todasExhibiciones.filter((ex) =>
      exhibicionEnLocal(ex.locales ?? [], this.localTodasElegido!),
    );
  }

  async confirmarImprimirTodas(): Promise<void> {
    const localNum = this.localTodasElegido;
    if (!localNum) return;

    const lista = this.exhibicionesDelLocalSeleccionado;
    if (!lista.length) {
      this.messageService.add({
        severity: 'info',
        summary: 'Sin exhibiciones',
        detail: `No hay exhibiciones para el local ${localNum}.`,
      });
      return;
    }

    this.imprimiendo = true;
    this.impresionOk = false;
    this.progreso = { actual: 0, total: lista.length };
    this.cdr.markForCheck();

    const template = this.buildTemplate();
    const cols = Math.max(1, template.cols);

    try {
      for (let i = 0; i < lista.length; i += cols) {
        const fila = lista.slice(i, i + cols);

        const rowVars: LabelVariables[] = fila.map((ex) => ({
          marca: ex.marca,
          referencia: ex.referencia,
          codigo: ex.zapatoId ?? ex.id?.toString() ?? '',
          talla: ex.talla,
          local: localNum,
        }));

        const tspl = this.printerService.generateTsplMultiCol(
          template,
          rowVars,
        ); // 👈 multi-col
        await this.printerService.sendData(new TextEncoder().encode(tspl));

        this.progreso = {
          actual: Math.min(i + cols, lista.length),
          total: lista.length,
        };
        this.cdr.markForCheck();

        if (i + cols < lista.length) await this.delay(800);
      }

      this.impresionOk = true;
      this.messageService.add({
        severity: 'success',
        summary: '✅ Listo',
        detail: `${lista.length} sticker${lista.length !== 1 ? 's' : ''} enviados al local ${localNum}.`,
        life: 5000,
      });
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error de impresión',
        detail: err?.message ?? 'No se pudo completar la impresión.',
        life: 6000,
      });
    } finally {
      this.imprimiendo = false;
      this.cdr.markForCheck();
    }
  }

  private buildTemplate(): LabelTemplate {
    const base = this.templateService.activeTemplate() ?? FALLBACK_TEMPLATE;
    return {
      ...base,
      elements: base.elements.map((el) => {
        const content: string =
          'content' in el ? String((el as any).content ?? '') : '';
        return el;
      }),
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  trackById(_: number, item: exhibiciones): any {
    return item.id;
  }

  trackByLocalId(_: number, item: Local): any {
    return item.id;
  }
}
