import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import {
  LocalesService,
  Local,
} from '../../../services/locales/locales.service';
import { ExhibicionesService } from '../../../services/vendedorServices/exhibiciones/exhibiciones.service';
import { AuthService } from '../../../services/auth/auth.service';
import {
  AuditoriaService,
  ResultadoAuditoria,
  SesionAuditoria,
  FiltrosHistorial,
} from '../../../services/administracion/ia/auditoria.service';

import { IaSpinnerComponent } from '../../../shared/components/ia-loader/ia-spinner.component';
import { IaLoaderComponent } from '../../../shared/components/ia-loader/ia-loader.component';
interface SesionHistorial extends SesionAuditoria {
  expandida: boolean;
  acordeonFaltantes: boolean;
  acordeonSobrantes: boolean;
  acordeonCorrectos: boolean;
}

@Component({
  selector: 'app-auditoria-admin',
  standalone: true,
  imports: [
    IaLoaderComponent,
    IaSpinnerComponent,CommonModule, FormsModule, SelectModule, ToastModule],
  templateUrl: './auditoria-admin.component.html',
  styleUrls: ['./auditoria-admin.component.css'],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditoriaAdminComponent implements OnInit, OnDestroy {
  localesActivos: { label: string; value: Local }[] = [];
  localSeleccionado: Local | null = null;
  sesion: SesionAuditoria | null = null;
  sesionId: string | null = null;
  resultado: ResultadoAuditoria | null = null;
  cargandoLocales = true;
  buscandoSesion = true;
  iniciandoSesion = false;
  copiado = false;
  descargandoExcel = false;
  descargandoPDF = false;
  acordeones: { faltantes: boolean; sobrantes: boolean; correctos: boolean } = {
    faltantes: false,
    sobrantes: false,
    correctos: false,
  };

  historialAbierto = false;
  historial: SesionHistorial[] = [];
  cargandoHistorial = false;
  historialError = '';
  historialBuscado = false;

  filtros: FiltrosHistorial & { fechaDesdeStr: string; fechaHastaStr: string } =
    {
      localNombre: '',
      vendedorNombre: '',
      fechaDesdeStr: '',
      fechaHastaStr: '',
    };

  featureCards: Array<{
    bg: string;
    color: string;
    icon: string;
    title: string;
    desc: string;
  }> = [];

  private localesSub?: Subscription;
  private sesionSub?: Subscription;

  constructor(
    private localesService: LocalesService,
    private exhibicionesService: ExhibicionesService,
    private auditoriaService: AuditoriaService,
    private authService: AuthService,
    private messageService: MessageService,
    private cd: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    this.scrollToTop();
    this.localesService.registrar();
    this.featureCards = [
      {
        bg: 'bg-blue-100 dark:bg-blue-900/40',
        color: 'text-blue-500',
        icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
        title: 'Auditoría rápida',
        desc: 'Escanea en tiempo real y obtén resultados instantáneos',
      },
      {
        bg: 'bg-emerald-100 dark:bg-emerald-900/40',
        color: 'text-emerald-500',
        icon: '<polyline points="20 6 9 17 4 12"/>',
        title: 'Precisión IA',
        desc: 'Inteligencia artificial verifica faltantes y sobrantes',
      },
      {
        bg: 'bg-amber-100 dark:bg-amber-900/40',
        color: 'text-amber-500',
        icon: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
        title: 'Reportes precisos',
        desc: 'Excel y PDF con análisis detallado por sección',
      },
    ];

    this.localesSub = this.localesService
      .obtenerLocales()
      .subscribe((locales) => {
        const activos = locales.filter((l) => l.estado === 'Activo');
        this.localesActivos = activos.map((l) => ({
          label: `Local ${l.nombre}`,
          value: l,
        }));
        this.cargandoLocales = false;
        this.cd.markForCheck();
      });

    this.sesionSub = this.auditoriaService.sesionActiva$.subscribe((sesion) => {
      this.sesion = sesion;
      this.resultado =
        sesion?.estado === 'finalizado' ? (sesion.resultado ?? null) : null;
      this.cd.markForCheck();
    });

    await this._intentarRestaurarSesion();
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private async _intentarRestaurarSesion(): Promise<void> {
    const usuario = this.authService.getCurrentUser();
    if (!usuario?.id) {
      this.buscandoSesion = false;
      this.cd.markForCheck();
      return;
    }

    try {
      const sesionId = await this.auditoriaService.buscarSesionActivaDeAdmin(
        usuario.id,
      );
      if (sesionId) {
        this.sesionId = sesionId;
        this.auditoriaService.escucharSesion(sesionId);
      }
    } catch (err) {
      console.error('No se pudo restaurar la sesión:', err);
    }

    this.buscandoSesion = false;
    this.cd.markForCheck();
  }

  toggleHistorial(): void {
    this.historialAbierto = !this.historialAbierto;
    if (this.historialAbierto && !this.historialBuscado) {
      this.buscarHistorial();
    }
    this.cd.markForCheck();
  }

  async buscarHistorial(): Promise<void> {
    this.cargandoHistorial = true;
    this.historialError = '';
    this.historial = [];
    this.cd.markForCheck();

    try {
      const filtrosLimpios: FiltrosHistorial = {
        localNombre: this.filtros.localNombre?.trim() || undefined,
        vendedorNombre: this.filtros.vendedorNombre?.trim() || undefined,
        fechaDesde: this.filtros.fechaDesdeStr
          ? new Date(this.filtros.fechaDesdeStr)
          : undefined,
        fechaHasta: this.filtros.fechaHastaStr
          ? new Date(this.filtros.fechaHastaStr)
          : undefined,
      };

      const sesiones =
        await this.auditoriaService.buscarAuditoriasPasadas(filtrosLimpios);
      this.historial = sesiones.map((s) => ({
        ...s,
        expandida: false,
        acordeonFaltantes: false,
        acordeonSobrantes: false,
        acordeonCorrectos: false,
      }));
      this.historialBuscado = true;
    } catch (err: any) {
      console.error('Error cargando historial:', err);
      this.historialError =
        'No se pudo cargar el historial. Verifica los índices de Firestore.';
    }

    this.cargandoHistorial = false;
    this.cd.markForCheck();
  }

  limpiarFiltros(): void {
    this.filtros = {
      localNombre: '',
      vendedorNombre: '',
      fechaDesdeStr: '',
      fechaHastaStr: '',
    };
    this.buscarHistorial();
  }

  unidadesSobrantesHistorial(resultado: ResultadoAuditoria): number {
    return resultado.sobrantes.reduce((acc, i) => acc + i.count, 0);
  }

  unidadesSobrantes(): number {
    return this.resultado?.sobrantes.reduce((acc, i) => acc + i.count, 0) ?? 0;
  }

  toggleSesionHistorial(sesion: SesionHistorial): void {
    sesion.expandida = !sesion.expandida;
    this.cd.markForCheck();
  }

  toggleAcordeonHistorial(
    sesion: SesionHistorial,
    key: 'acordeonFaltantes' | 'acordeonSobrantes' | 'acordeonCorrectos',
  ): void {
    sesion[key] = !sesion[key];
    this.cd.markForCheck();
  }

  async descargarExcelHistorial(sesion: SesionHistorial): Promise<void> {
    if (!sesion.resultado) return;
    await this.descargarExcel(sesion.resultado, sesion);
  }

  async descargarPDFHistorial(sesion: SesionHistorial): Promise<void> {
    if (!sesion.resultado) return;
    await this.descargarPDF(sesion.resultado, sesion);
  }

  formatFecha(fecha: any): string {
    if (!fecha) return '—';
    const d: Date = fecha?.toDate ? fecha.toDate() : new Date(fecha);
    return d.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  unicosHistorial(sesion: SesionHistorial): number {
    return Object.keys(sesion.conteo ?? {}).length;
  }

  extraerNumeroLocal(nombre: string): string {
    return nombre.replace(/[^0-9]/g, '').trim();
  }

  copiarCodigo(): void {
    if (!this.sesionId) return;
    navigator.clipboard.writeText(this.sesionId).then(() => {
      this.copiado = true;
      this.cd.markForCheck();
      setTimeout(() => {
        this.copiado = false;
        this.cd.markForCheck();
      }, 2000);
    });
  }

  async iniciarAuditoria(): Promise<void> {
    if (!this.localSeleccionado) return;
    this.iniciandoSesion = true;
    this.resultado = null;
    this.cd.markForCheck();

    try {
      const localNum = this.extraerNumeroLocal(this.localSeleccionado.nombre);
      const todas = await this.exhibicionesService.obtenerExhibicionesUnaVez();
      const exhibicionesDelLocal = todas.filter((ex) =>
        ex.locales?.some((l) => this.extraerNumeroLocal(l) === localNum),
      );

      if (exhibicionesDelLocal.length === 0) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Sin exhibiciones',
          detail: `No hay exhibiciones para Local ${localNum}`,
        });
        this.iniciandoSesion = false;
        this.cd.markForCheck();
        return;
      }

      const usuario = this.authService.getCurrentUser();
      this.sesionId = await this.auditoriaService.iniciarSesion(
        this.localSeleccionado.nombre,
        this.localSeleccionado.id ?? '',
        exhibicionesDelLocal.map((e) => ({
          zapatoId: e.zapatoId ?? '',
          marca: e.marca,
          referencia: e.referencia,
        })),
        usuario?.id,
        usuario?.name,
      );
      this.auditoriaService.escucharSesion(this.sesionId);
      this.messageService.add({
        severity: 'success',
        summary: 'Auditoría iniciada',
        detail: `Local ${localNum} — ${exhibicionesDelLocal.length} exhibiciones esperadas`,
      });
    } catch (err) {
      console.error(err);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo iniciar la auditoría',
      });
    }

    this.iniciandoSesion = false;
    this.cd.markForCheck();
  }

  get unidadesFaltantes(): number {
    return this.resultado?.faltantes.reduce((acc, i) => acc + i.count, 0) ?? 0;
  }

  get unidadesCorrectas(): number {
    return this.resultado?.ok.reduce((acc, i) => acc + i.count, 0) ?? 0;
  }

  unidadesFaltantesHistorial(resultado: ResultadoAuditoria): number {
    return resultado.faltantes.reduce((acc, i) => acc + i.count, 0);
  }

  unidadesCorrectasHistorial(resultado: ResultadoAuditoria): number {
    return resultado.ok.reduce((acc, i) => acc + i.count, 0);
  }

  async cancelarAuditoria(): Promise<void> {
    if (!this.sesionId) return;
    try {
      await this.auditoriaService.eliminarSesion(this.sesionId);
      this._resetEstado();
      this.messageService.add({
        severity: 'info',
        summary: 'Auditoría cancelada',
        detail: 'La sesión fue eliminada',
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo cancelar',
      });
    }
    this.cd.markForCheck();
  }

  async nuevaAuditoria(): Promise<void> {
    if (this.sesionId)
      await this.auditoriaService.eliminarSesion(this.sesionId);
    this._resetEstado();
    this.cd.markForCheck();
  }

  private _resetEstado(): void {
    this.sesionId = null;
    this.resultado = null;
    this.localSeleccionado = null;
    this.sesion = null;
  }

  async descargarExcel(
    resultadoParam?: ResultadoAuditoria,
    sesionParam?: SesionAuditoria,
  ): Promise<void> {
    const resultado = resultadoParam ?? this.resultado;
    const sesion = sesionParam ?? this.sesion;
    if (!resultado || this.descargandoExcel) return;
    this.descargandoExcel = true;
    this.cd.markForCheck();

    try {
      const XLSX = await import('xlsx');
      const fecha = this._fechaReporte();
      const local = `Local_${this.extraerNumeroLocal(sesion?.localNombre ?? this.localNumero)}`;

      const wb = XLSX.utils.book_new();
      const mkSheet = (data: any[][]) => {
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [
          { wch: 16 },
          { wch: 16 },
          { wch: 26 },
          { wch: 12 },
          { wch: 12 },
        ];
        return ws;
      };

      XLSX.utils.book_append_sheet(
        wb,
        mkSheet([
          ['zapatoId (código)', 'Marca', 'Referencia', 'Estado', 'Cantidad'],
          ...resultado.ok.map((i) => [
            i.zapatoId,
            i.marca,
            i.referencia,
            'Correcto',
            i.count,
          ]),
        ]),
        'Correctos',
      );

      XLSX.utils.book_append_sheet(
        wb,
        mkSheet([
          ['zapatoId (código)', 'Marca', 'Referencia', 'Estado', 'Cantidad'],
          ...resultado.sobrantes.map((i) => [
            i.zapatoId,
            '—',
            '—',
            'Sobrante',
            i.count,
          ]),
        ]),
        'Sobrantes',
      );

      XLSX.utils.book_append_sheet(
        wb,
        mkSheet([
          [
            'zapatoId (código)',
            'Marca',
            'Referencia',
            'Estado',
            'Cantidad faltante',
          ],
          ...resultado.faltantes.map((i) => [
            i.zapatoId,
            i.marca,
            i.referencia,
            'Faltante',
            i.count,
          ]),
        ]),
        'Faltantes',
      );

      XLSX.writeFile(wb, `Auditoria_${local}_${fecha}.xlsx`);
    } catch (err) {
      console.error(err);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo generar el Excel',
      });
    }

    this.descargandoExcel = false;
    this.cd.markForCheck();
  }

  async descargarPDF(
    resultadoParam?: ResultadoAuditoria,
    sesionParam?: SesionAuditoria,
  ): Promise<void> {
    const resultado = resultadoParam ?? this.resultado;
    const sesion = sesionParam ?? this.sesion;
    if (!resultado || this.descargandoPDF) return;
    this.descargandoPDF = true;
    this.cd.markForCheck();

    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      const fecha = this._fechaReporte();
      const localNombreRaw = sesion?.localNombre ?? `Local ${this.localNumero}`;
      const local = `Local ${this.extraerNumeroLocal(localNombreRaw)}`;
      const pageW = doc.internal.pageSize.getWidth();

      doc.setFillColor(15, 15, 15);
      doc.rect(0, 0, pageW, 32, 'F');
      doc.setTextColor(240, 240, 240);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Reporte de Auditoría', 14, 14);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(160, 160, 160);
      doc.text(`${local}  ·  ${fecha}`, 14, 22);

      const chips = [
        {
          label: 'Correctos',
          value: resultado.ok.reduce((a, i) => a + i.count, 0),
          color: [22, 163, 74] as [number, number, number],
        },
        {
          label: 'Faltantes',
          value: resultado.faltantes.reduce((a, i) => a + i.count, 0),
          color: [220, 38, 38] as [number, number, number],
        },
        {
          label: 'Sobrantes',
          value: resultado.sobrantes.reduce((a, i) => a + i.count, 0),
          color: [37, 99, 235] as [number, number, number],
        },
      ];
      const chipW = 38,
        chipH = 16,
        chipY = 38;
      chips.forEach((chip, i) => {
        const x = 14 + i * (chipW + 5);
        doc.setFillColor(...chip.color);
        doc.roundedRect(x, chipY, chipW, chipH, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(String(chip.value), x + chipW / 2, chipY + 9, {
          align: 'center',
        });
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(chip.label, x + chipW / 2, chipY + 14, { align: 'center' });
      });

      let startY = chipY + chipH + 12;

      if (resultado.ok.length > 0) {
        startY = this._pdfSectionTitle(
          doc,
          '✓  Correctos',
          [22, 163, 74],
          startY,
        );
        autoTable(doc, {
          startY,
          head: [
            ['zapatoId (código)', 'Marca', 'Referencia', 'Estado', 'Cantidad'],
          ],
          body: resultado.ok.map((i) => [
            i.zapatoId,
            i.marca,
            i.referencia,
            'Correcto',
            i.count,
          ]),
          styles: { fontSize: 8.5, cellPadding: 3.5 },
          headStyles: {
            fillColor: [22, 163, 74],
            textColor: 255,
            fontStyle: 'bold',
          },
          alternateRowStyles: { fillColor: [240, 253, 244] },
          columnStyles: { 3: { textColor: [22, 163, 74], fontStyle: 'bold' } },
          margin: { left: 14, right: 14 },
        });
        startY = (doc as any).lastAutoTable.finalY + 10;
      }

      if (resultado.sobrantes.length > 0) {
        if (startY > 220) {
          doc.addPage();
          startY = 20;
        }
        startY = this._pdfSectionTitle(
          doc,
          '+  Sobrantes',
          [37, 99, 235],
          startY,
        );
        autoTable(doc, {
          startY,
          head: [
            ['zapatoId (código)', 'Marca', 'Referencia', 'Estado', 'Cantidad'],
          ],
          body: resultado.sobrantes.map((i) => [
            i.zapatoId,
            '—',
            '—',
            'Sobrante',
            i.count,
          ]),
          styles: { fontSize: 8.5, cellPadding: 3.5 },
          headStyles: {
            fillColor: [37, 99, 235],
            textColor: 255,
            fontStyle: 'bold',
          },
          alternateRowStyles: { fillColor: [239, 246, 255] },
          columnStyles: { 3: { textColor: [37, 99, 235], fontStyle: 'bold' } },
          margin: { left: 14, right: 14 },
        });
        startY = (doc as any).lastAutoTable.finalY + 10;
      }

      if (resultado.faltantes.length > 0) {
        if (startY > 220) {
          doc.addPage();
          startY = 20;
        }
        startY = this._pdfSectionTitle(
          doc,
          '✗  Faltantes',
          [220, 38, 38],
          startY,
        );
        autoTable(doc, {
          startY,
          head: [
            [
              'zapatoId (código)',
              'Marca',
              'Referencia',
              'Estado',
              'Cantidad faltante',
            ],
          ],
          body: resultado.faltantes.map((i) => [
            i.zapatoId,
            i.marca,
            i.referencia,
            'Faltante',
            i.count,
          ]),
          styles: { fontSize: 8.5, cellPadding: 3.5 },
          headStyles: {
            fillColor: [220, 38, 38],
            textColor: 255,
            fontStyle: 'bold',
          },
          alternateRowStyles: { fillColor: [254, 242, 242] },
          columnStyles: { 3: { textColor: [220, 38, 38], fontStyle: 'bold' } },
          margin: { left: 14, right: 14 },
        });
      }

      const totalPages = (doc.internal as any).getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        doc.text(
          `Auditoría de Exhibición  ·  ${local}  ·  Página ${p} de ${totalPages}`,
          pageW / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'center' },
        );
      }

      doc.save(`Auditoria_${local.replace(' ', '_')}_${fecha}.pdf`);
    } catch (err) {
      console.error(err);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo generar el PDF',
      });
    }

    this.descargandoPDF = false;
    this.cd.markForCheck();
  }

  private _pdfSectionTitle(
    doc: any,
    title: string,
    color: [number, number, number],
    y: number,
  ): number {
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFillColor(...color);
    doc.rect(14, y, pageW - 28, 0.6, 'F');
    doc.setTextColor(...color);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, y + 7);
    doc.setTextColor(0, 0, 0);
    return y + 11;
  }

  private _fechaReporte(): string {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
  }

  get progreso(): number {
    if (!this.sesion?.totalEsperados) return 0;
    return Math.min(
      100,
      Math.round(
        (this.sesion.totalEscaneos / this.sesion.totalEsperados) * 100,
      ),
    );
  }

  get escaneadosUnicos(): number {
    return Object.keys(this.sesion?.conteo ?? {}).length;
  }

  get localNumero(): string {
    return this.extraerNumeroLocal(
      this.localSeleccionado?.nombre ?? this.sesion?.localNombre ?? '',
    );
  }

  toggleAcordeon(key: 'faltantes' | 'sobrantes' | 'correctos'): void {
    this.acordeones[key] = !this.acordeones[key];
    this.cd.markForCheck();
  }

  scrollTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  ngOnDestroy(): void {
    this.localesService.desregistrar();
    this.localesSub?.unsubscribe();
    this.sesionSub?.unsubscribe();
    this.auditoriaService.stopListening();
  }
}
