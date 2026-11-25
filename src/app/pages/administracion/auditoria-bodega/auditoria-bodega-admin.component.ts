import {
  Component,
  OnDestroy,
  inject,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import {
  AuditoriaBodegaService,
  SesionBodega,
  ReporteBodega,
  ItemReporte,
} from '../../../services/administracion/ia/auditoria-bodega.service';
import { AuthService } from '../../../services/auth/auth.service';
import { Products } from '../../../pages/interfaces';

import { IaSpinnerComponent } from '../../../shared/components/ia-loader/ia-spinner.component';
type VistaAdmin = 'inicio' | 'esperando' | 'en_progreso' | 'resultado';

@Component({
  selector: 'app-auditoria-bodega-admin',
  standalone: true,
  imports: [
    IaSpinnerComponent,CommonModule, FormsModule, ToastModule],
  providers: [MessageService],
  templateUrl: './auditoria-bodega-admin.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditoriaBodegaAdminComponent implements OnDestroy {
  private service = inject(AuditoriaBodegaService);
  private auth = inject(AuthService);
  private messageService = inject(MessageService);

  vista = signal<VistaAdmin>('inicio');
  filas = signal<string[]>([]);
  cargandoFilas = signal(true);
  iniciando = signal(false);
  copiado = signal(false);
  reporte = signal<ReporteBodega | null>(null);
  productosCompletos = signal<Products[]>([]);
  descargandoExcel = signal(false);
  descargandoPDF = signal(false);
  acordeon = signal<'correctos' | 'faltantes' | 'sobrantes' | null>(null);
  historialAbierto = signal(false);
  historial = signal<(SesionBodega & { id: string })[]>([]);
  cargandoHistorial = signal(false);
  modalModoVisible = signal(false);
  modoConteoElegido = signal<'tallas' | 'cantidad'>('tallas');
  cargandoInicial = signal(true);
  sesionHistorialExpandida = signal<string | null>(null);
  reportesHistorial = signal<Map<string, ReporteBodega>>(new Map());
  cargandoReporteHistorial = signal<string[]>([]);
  acordeonHistorial = signal<
    Map<string, 'correctos' | 'faltantes' | 'sobrantes' | null>
  >(new Map());
  descargandoExcelHistorial = signal<string | null>(null);
  descargandoPDFHistorial = signal<string | null>(null);

  sesion = this.service.sesionActiva;
  sesionId = this.service.sesionId;
  filtroLocal: string = '';
  soloPendientesRecibir: boolean = false;
  progresoGeneral = computed(() => {
    const s = this.sesion();
    if (!s?.totalProductos) return 0;
    return Math.round((s.productosContados / s.totalProductos) * 100);
  });

  filasAuditadasCount = computed(
    () => this.sesion()?.filasAuditadas?.length ?? 0,
  );

  trabajadoresActivos = computed(() => {
    const s = this.sesion();
    if (!s?.trabajadores) return [];
    return Object.entries(s.trabajadores).map(([id, t]) => ({ id, ...t }));
  });

  detalleFilas = computed(() => {
    const s = this.sesion();
    const filas = this.filas();
    const conteos: any = s?.conteos ?? {};
    const auditadas: string[] = s?.filasAuditadas ?? [];
    const trabajadores = s?.trabajadores ?? {};

    return filas
      .map((fila) => {
        const enUso = Object.entries(trabajadores).find(
          ([, t]: any) => t.filaActual === fila,
        );
        const completada = auditadas.includes(fila);

        const prodsFilaContados = this.productosCompletos().filter((p) => {
          if (String(p.fila).trim() !== fila) return false;
          if (conteos[p.id] === undefined) return false;
          const stock = Object.values(p.tallasDisponibles ?? {}).reduce(
            (acc, v) => acc + (Number(v) || 0),
            0,
          );
          return stock > 0;
        }).length;

        const prodsFilaTotal = this.productosCompletos().filter((p) => {
          if (String(p.fila).trim() !== fila) return false;
          const stock = Object.values(p.tallasDisponibles ?? {}).reduce(
            (acc, v) => acc + (Number(v) || 0),
            0,
          );
          return stock > 0;
        }).length;

        return {
          fila,
          completada,
          enUsoPor: enUso ? (enUso[1] as any).nombre : null,
          contados: prodsFilaContados,
          total: prodsFilaTotal,
        };
      })
      .filter((detalle) => detalle.total > 0);
  });

  totalEsperado = computed(() => {
    const r = this.reporte();
    if (!r) return 0;
    return [...r.correctos, ...r.faltantes, ...r.sobrantes].reduce(
      (acc, i) => acc + i.esperado,
      0,
    );
  });

  totalContadoGlobal = computed(() => {
    const r = this.reporte();
    if (!r) return 0;
    return [...r.correctos, ...r.faltantes, ...r.sobrantes].reduce(
      (acc, i) => acc + i.contado,
      0,
    );
  });

  totalDiferencia = computed(
    () => this.totalContadoGlobal() - this.totalEsperado(),
  );

  totalUnidadesFaltantes = computed(
    () =>
      this.reporte()?.faltantes.reduce(
        (acc, i) => acc + Math.abs(i.diferencia),
        0,
      ) ?? 0,
  );

  totalUnidadesSobrantes = computed(
    () =>
      this.reporte()?.sobrantes.reduce((acc, i) => acc + i.diferencia, 0) ?? 0,
  );

  porcentajeContado = computed(() => {
    const esp = this.totalEsperado();
    if (!esp) return 0;
    return Math.min(100, Math.round((this.totalContadoGlobal() / esp) * 100));
  });

  objectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }

  objectEntries(obj: any): [string, any][] {
    return obj ? Object.entries(obj) : [];
  }

  constructor() {
    effect(() => {
      const s = this.sesion();
      if (!s) return;
      if (s.estado === 'esperando' && this.vista() === 'inicio') {
        this.vista.set('esperando');
      } else if (s.estado === 'en_progreso') {
        this.vista.set('en_progreso');
      } else if (s.estado === 'finalizado') {
        this.vista.set('resultado');
        this.calcularReporte();
      }
    });

    this.inicializarAsync();
  }

  private async inicializarAsync(): Promise<void> {
    this.cargandoInicial.set(true);
    try {
      const localId = this.service.leerSesionLocal();
      let activeId: string | null = localId;

      if (!activeId) {
        activeId = await this.service.buscarCualquierSesionActiva();
      }

      if (activeId) {
        const sesionData = await this.service.escucharSesionYEsperar(activeId);
        if (sesionData && sesionData.estado !== 'finalizado') {
          await this.cargarProductosCompletos();
        } else if (!sesionData) {
          this.service.limpiarSesionLocal();
        }
      }

      const filas = await this.service.obtenerFilasOrdenadas();
      this.filas.set(filas);
    } catch (err) {
      console.error('[Admin] Error init:', err);
    }
    this.cargandoFilas.set(false);
    this.cargandoInicial.set(false);
  }

  private async cargarProductosCompletos(): Promise<void> {
    const filas = await this.service.obtenerFilasOrdenadas();
    const todos: Products[] = [];
    for (const fila of filas) {
      const prods = await this.service.obtenerProductosPorFila(fila);
      todos.push(...prods);
    }
    this.productosCompletos.set(todos);
  }

  mostrarModalModo(): void {
    this.modalModoVisible.set(true);
  }

  async iniciarConModo(): Promise<void> {
    this.modalModoVisible.set(false);
    await this.iniciarAuditoria(this.modoConteoElegido());
  }

  async iniciarAuditoria(
    modoConteo: 'tallas' | 'cantidad' = 'tallas',
  ): Promise<void> {
    const user = this.auth.getCurrentUser();
    const existente = await this.service.buscarCualquierSesionActiva();
    if (existente) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sesión activa',
        detail: 'Ya tienes una auditoría en progreso.',
      });
      return;
    }

    this.iniciando.set(true);
    try {
      const filas = this.filas();
      const todosProductos: Products[] = [];
      for (const fila of filas) {
        const prods = await this.service.obtenerProductosPorFila(fila);
        todosProductos.push(...prods);
      }
      this.productosCompletos.set(todosProductos);

      const productosConStock = todosProductos.filter((p) => {
        const stock = Object.values(p.tallasDisponibles ?? {}).reduce(
          (acc, v) => acc + (Number(v) || 0),
          0,
        );
        return stock > 0;
      });

      const id = await this.service.iniciarSesion(
        user?.id ?? '',
        user?.name ?? 'Admin',
        filas,
        productosConStock.length,
        modoConteo,
      );

      this.service.escucharSesion(id);
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo iniciar la auditoría',
      });
    }
    this.iniciando.set(false);
  }

  async toggleSesionHistorial(sesionId: string): Promise<void> {
    if (this.sesionHistorialExpandida() === sesionId) {
      this.sesionHistorialExpandida.set(null);
      return;
    }
    this.sesionHistorialExpandida.set(sesionId);

    // Ya fue calculado antes, no volver a cargar
    if (this.reportesHistorial().has(sesionId)) return;

    // Marcar como cargando
    this.cargandoReporteHistorial.update((arr) => [...arr, sesionId]);
    try {
      const sesion = await this.service.obtenerSesionPorId(sesionId);
      if (!sesion?.conteos) return;

      // Necesitamos los productos — los cargamos si no están en memoria
      let productos = this.productosCompletos();
      if (productos.length === 0) {
        await this.cargarProductosCompletos();
        productos = this.productosCompletos();
      }

      const reporte = this.service.calcularReporte(
        productos,
        sesion.conteos,
        sesion.modoConteo ?? 'tallas',
      );
      this.reportesHistorial.update((m) => new Map(m).set(sesionId, reporte));
      this.acordeonHistorial.update((m) => new Map(m).set(sesionId, null));
    } catch (err) {
      console.error('[Historial reporte] ERROR:', err);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo cargar el reporte',
      });
    }
    this.cargandoReporteHistorial.update((arr) =>
      arr.filter((id) => id !== sesionId),
    );
  }

  esCargandoReporte(sesionId: string): boolean {
    return this.cargandoReporteHistorial().includes(sesionId);
  }

  toggleAcordeonHistorial(
    sesionId: string,
    key: 'correctos' | 'faltantes' | 'sobrantes',
  ): void {
    this.acordeonHistorial.update((m) => {
      const current = m.get(sesionId);
      return new Map(m).set(sesionId, current === key ? null : key);
    });
  }

  obtenerReporteHistorial(sesionId: string): ReporteBodega | undefined {
    return this.reportesHistorial().get(sesionId);
  }

  reporteHistorialTotal(r: ReporteBodega, campo: 'esperado' | 'contado') {
    return [...r.correctos, ...r.faltantes, ...r.sobrantes].reduce(
      (acc, i) => acc + i[campo],
      0,
    );
  }

  async descargarExcelHistorial(
    s: SesionBodega & { id: string },
  ): Promise<void> {
    const r = this.reportesHistorial().get(s.id!);
    if (!r || this.descargandoExcelHistorial() === s.id) return;
    this.descargandoExcelHistorial.set(s.id!);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const fecha = s.fechaFin
        ? this.formatFechaArchivo(s.fechaFin)
        : this.fechaReporte();
      const modoTallas = (s.modoConteo ?? 'tallas') === 'tallas';

      const mkSheet = (data: any[][]) => {
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = modoTallas
          ? [
              { wch: 8 },
              { wch: 10 },
              { wch: 18 },
              { wch: 22 },
              { wch: 8 },
              { wch: 12 },
              { wch: 12 },
              { wch: 30 },
            ]
          : [
              { wch: 8 },
              { wch: 10 },
              { wch: 18 },
              { wch: 22 },
              { wch: 12 },
              { wch: 10 },
              { wch: 12 },
            ];
        return ws;
      };

      const headerTallas = [
        'Fila',
        'ID Zapato',
        'Marca',
        'Referencia',
        'Total Esp.',
        'Total Cont.',
        'Diferencia',
        'Detalle tallas',
      ];
      const headerCantidad = [
        'Fila',
        'ID Zapato',
        'Marca',
        'Referencia',
        'Esperado',
        'Contado',
        'Diferencia',
      ];

      const toRowTallas = (i: ItemReporte) => {
        const detalle = (i.tallasDetalle ?? [])
          .map(
            (t) =>
              `T${t.talla}: ${t.contado}/${t.esperado}(${t.diferencia > 0 ? '+' : ''}${t.diferencia})`,
          )
          .join(' | ');
        return [
          i.fila,
          i.zapatoId,
          i.marca,
          i.referencia,
          i.esperado,
          i.contado,
          i.diferencia,
          detalle,
        ];
      };
      const toRowCantidad = (i: ItemReporte) => [
        i.fila,
        i.zapatoId,
        i.marca,
        i.referencia,
        i.esperado,
        i.contado,
        i.diferencia,
      ];

      const toRow = modoTallas ? toRowTallas : toRowCantidad;
      const header = modoTallas ? headerTallas : headerCantidad;

      XLSX.utils.book_append_sheet(
        wb,
        mkSheet([header, ...r.correctos.map(toRow)]),
        'Correctos',
      );
      XLSX.utils.book_append_sheet(
        wb,
        mkSheet([header, ...r.faltantes.map(toRow)]),
        'Faltantes',
      );
      XLSX.utils.book_append_sheet(
        wb,
        mkSheet([header, ...r.sobrantes.map(toRow)]),
        'Sobrantes',
      );
      XLSX.writeFile(wb, `Auditoria_${fecha}.xlsx`);
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo generar el Excel',
      });
    }
    this.descargandoExcelHistorial.set(null);
  }

  async descargarPDFHistorial(s: SesionBodega & { id: string }): Promise<void> {
    const r = this.reportesHistorial().get(s.id!);
    if (!r || this.descargandoPDFHistorial() === s.id) return;
    this.descargandoPDFHistorial.set(s.id!);
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      const fecha = s.fechaFin
        ? this.formatFechaArchivo(s.fechaFin)
        : this.fechaReporte();
      const pageW = doc.internal.pageSize.getWidth();
      const modoTallas = (s.modoConteo ?? 'tallas') === 'tallas';

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, 34, 'F');
      doc.setTextColor(248, 250, 252);
      doc.setFontSize(17);
      doc.setFont('helvetica', 'bold');
      doc.text('Auditoría de Bodega', 14, 14);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `${s.finalizadoPorNombre ?? ''}  ·  ${this.formatFecha(s.fechaFin)}  ·  ${modoTallas ? 'Por tallas' : 'Por cantidad'}`,
        14,
        24,
      );

      const chips = [
        {
          label: 'Correctos',
          val: r.correctos.length,
          color: [22, 163, 74] as [number, number, number],
        },
        {
          label: 'Faltantes',
          val: r.faltantes.length,
          color: [220, 38, 38] as [number, number, number],
        },
        {
          label: 'Sobrantes',
          val: r.sobrantes.length,
          color: [99, 102, 241] as [number, number, number],
        },
      ];
      chips.forEach((c, i) => {
        const x = 14 + i * 44;
        doc.setFillColor(...c.color);
        doc.roundedRect(x, 40, 40, 16, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(String(c.val), x + 20, 49, { align: 'center' });
        doc.setFontSize(7);
        doc.text(c.label, x + 20, 54, { align: 'center' });
      });

      let y = 64;
      const tabla = (
        title: string,
        color: [number, number, number],
        rows: ItemReporte[],
      ) => {
        if (!rows.length) return;
        if (y > 220) {
          doc.addPage();
          y = 20;
        }
        doc.setFillColor(...color);
        doc.rect(14, y, pageW - 28, 0.5, 'F');
        doc.setTextColor(...color);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 14, y + 7);
        y += 11;
        const head = modoTallas
          ? [
              [
                'Fila',
                'ID',
                'Marca',
                'Referencia',
                'Esp.',
                'Cont.',
                'Dif.',
                'Tallas',
              ],
            ]
          : [
              [
                'Fila',
                'ID',
                'Marca',
                'Referencia',
                'Esperado',
                'Contado',
                'Dif.',
              ],
            ];
        const body = rows.map((i) => {
          if (modoTallas) {
            const detalle = (i.tallasDetalle ?? [])
              .map((t) => `T${t.talla}: ${t.contado}/${t.esperado}`)
              .join('\n');
            return [
              i.fila,
              i.zapatoId,
              i.marca,
              i.referencia,
              i.esperado,
              i.contado,
              i.diferencia > 0 ? `+${i.diferencia}` : i.diferencia,
              detalle,
            ];
          }
          return [
            i.fila,
            i.zapatoId,
            i.marca,
            i.referencia,
            i.esperado,
            i.contado,
            i.diferencia > 0 ? `+${i.diferencia}` : i.diferencia,
          ];
        });
        autoTable(doc, {
          startY: y,
          head,
          body,
          styles: { fontSize: 7, cellPadding: 2 },
          columnStyles: modoTallas ? { 7: { cellWidth: 35, fontSize: 6 } } : {},
          headStyles: { fillColor: color, textColor: 255, fontStyle: 'bold' },
          margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      };

      tabla('Correctos', [22, 163, 74], r.correctos);
      tabla('Faltantes', [220, 38, 38], r.faltantes);
      tabla('Sobrantes', [99, 102, 241], r.sobrantes);

      const total = (doc.internal as any).getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Auditoría de Bodega  ·  ${fecha}  ·  Página ${p} de ${total}`,
          pageW / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'center' },
        );
      }
      doc.save(`Auditoria_${fecha}.pdf`);
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo generar el PDF',
      });
    }
    this.descargandoPDFHistorial.set(null);
  }

  private formatFechaArchivo(ts: any): string {
    const d: Date = ts?.toDate ? ts.toDate() : new Date(ts);
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
  }

  diferenciaHistorial(r: ReporteBodega): number {
    return (
      this.reporteHistorialTotal(r, 'contado') -
      this.reporteHistorialTotal(r, 'esperado')
    );
  }

  async cancelarAuditoria(): Promise<void> {
    const id = this.sesionId();
    if (!id) return;
    await this.service.eliminarSesion(id);
    this.vista.set('inicio');
    this.reporte.set(null);
    this.productosCompletos.set([]);
  }

  async nuevaAuditoria(): Promise<void> {
    const id = this.sesionId();
    if (id) await this.service.eliminarSesion(id);
    this.reporte.set(null);
    this.productosCompletos.set([]);
    this.vista.set('inicio');
  }

  copiarCodigo(): void {
    const id = this.sesionId();
    if (!id) return;
    navigator.clipboard.writeText(id).then(() => {
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2000);
    });
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private calcularReporte(): void {
    const s = this.sesion();
    if (!s?.conteos) return;
    const r = this.service.calcularReporte(
      this.productosCompletos(),
      s.conteos,
      s.modoConteo ?? 'tallas',
    );
    this.reporte.set(r);
  }

  toggleAcordeon(key: 'correctos' | 'faltantes' | 'sobrantes'): void {
    this.acordeon.update((v) => (v === key ? null : key));
  }

  toggleHistorial(): void {
    this.historialAbierto.update((v) => !v);
    if (this.historialAbierto() && this.historial().length === 0)
      this.cargarHistorial();
  }

  async cargarHistorial(): Promise<void> {
    this.cargandoHistorial.set(true);
    try {
      const h = await this.service.obtenerHistorial();
      this.historial.set(h);
    } catch (err) {
      console.error('[Historial] ERROR completo:', err);
      console.error('[Historial] mensaje:', (err as any)?.message);
      console.error('[Historial] código:', (err as any)?.code);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo cargar el historial',
      });
    }
    this.cargandoHistorial.set(false);
  }

  formatFecha(ts: any): string {
    if (!ts) return '—';
    const d: Date = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async descargarExcel(): Promise<void> {
    const r = this.reporte();
    if (!r || this.descargandoExcel()) return;
    this.descargandoExcel.set(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const fecha = this.fechaReporte();
      const modoTallas = (this.sesion()?.modoConteo ?? 'tallas') === 'tallas';

      const mkSheet = (data: any[][]) => {
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = modoTallas
          ? [
              { wch: 8 },
              { wch: 10 },
              { wch: 18 },
              { wch: 22 },
              { wch: 8 },
              { wch: 12 },
              { wch: 12 },
              { wch: 12 },
              { wch: 30 },
            ]
          : [
              { wch: 8 },
              { wch: 10 },
              { wch: 18 },
              { wch: 22 },
              { wch: 12 },
              { wch: 10 },
              { wch: 12 },
            ];
        return ws;
      };

      const headerTallas = [
        'Fila',
        'ID Zapato',
        'Marca',
        'Referencia',
        'Total Esp.',
        'Total Cont.',
        'Diferencia',
        'Detalle tallas',
      ];
      const headerCantidad = [
        'Fila',
        'ID Zapato',
        'Marca',
        'Referencia',
        'Esperado',
        'Contado',
        'Diferencia',
      ];

      const toRowTallas = (i: ItemReporte) => {
        const detalle = (i.tallasDetalle ?? [])
          .map(
            (t) =>
              `T${t.talla}: ${t.contado}/${t.esperado}(${t.diferencia > 0 ? '+' : ''}${t.diferencia})`,
          )
          .join(' | ');
        return [
          i.fila,
          i.zapatoId,
          i.marca,
          i.referencia,
          i.esperado,
          i.contado,
          i.diferencia,
          detalle,
        ];
      };

      const toRowCantidad = (i: ItemReporte) => [
        i.fila,
        i.zapatoId,
        i.marca,
        i.referencia,
        i.esperado,
        i.contado,
        i.diferencia,
      ];

      const toRow = modoTallas ? toRowTallas : toRowCantidad;
      const header = modoTallas ? headerTallas : headerCantidad;

      XLSX.utils.book_append_sheet(
        wb,
        mkSheet([header, ...r.correctos.map(toRow)]),
        'Correctos',
      );
      XLSX.utils.book_append_sheet(
        wb,
        mkSheet([header, ...r.faltantes.map(toRow)]),
        'Faltantes',
      );
      XLSX.utils.book_append_sheet(
        wb,
        mkSheet([header, ...r.sobrantes.map(toRow)]),
        'Sobrantes',
      );
      XLSX.writeFile(wb, `Auditoria_Bodega_${fecha}.xlsx`);
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo generar el Excel',
      });
    }
    this.descargandoExcel.set(false);
  }

  async descargarPDF(): Promise<void> {
    const r = this.reporte();
    if (!r || this.descargandoPDF()) return;
    this.descargandoPDF.set(true);
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      const fecha = this.fechaReporte();
      const pageW = doc.internal.pageSize.getWidth();
      const modoTallas = (this.sesion()?.modoConteo ?? 'tallas') === 'tallas';

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, 34, 'F');
      doc.setTextColor(248, 250, 252);
      doc.setFontSize(17);
      doc.setFont('helvetica', 'bold');
      doc.text('Auditoría de Bodega', 14, 14);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `${this.sesion()?.finalizadoPorNombre ?? ''}  ·  ${fecha}  ·  ${modoTallas ? 'Por tallas' : 'Por cantidad'}`,
        14,
        24,
      );

      const chips = [
        {
          label: 'Correctos',
          val: r.correctos.length,
          color: [22, 163, 74] as [number, number, number],
        },
        {
          label: 'Faltantes',
          val: r.faltantes.length,
          color: [220, 38, 38] as [number, number, number],
        },
        {
          label: 'Sobrantes',
          val: r.sobrantes.length,
          color: [99, 102, 241] as [number, number, number],
        },
      ];
      chips.forEach((c, i) => {
        const x = 14 + i * 44;
        doc.setFillColor(...c.color);
        doc.roundedRect(x, 40, 40, 16, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(String(c.val), x + 20, 49, { align: 'center' });
        doc.setFontSize(7);
        doc.text(c.label, x + 20, 54, { align: 'center' });
      });

      let y = 64;
      const tabla = (
        title: string,
        color: [number, number, number],
        rows: ItemReporte[],
      ) => {
        if (!rows.length) return;
        if (y > 220) {
          doc.addPage();
          y = 20;
        }
        doc.setFillColor(...color);
        doc.rect(14, y, pageW - 28, 0.5, 'F');
        doc.setTextColor(...color);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 14, y + 7);
        y += 11;
        const head = modoTallas
          ? [
              [
                'Fila',
                'ID',
                'Marca',
                'Referencia',
                'Esp.',
                'Cont.',
                'Dif.',
                'Tallas',
              ],
            ]
          : [
              [
                'Fila',
                'ID',
                'Marca',
                'Referencia',
                'Esperado',
                'Contado',
                'Dif.',
              ],
            ];

        const body = rows.map((i) => {
          if (modoTallas) {
            const detalle = (i.tallasDetalle ?? [])
              .map((t) => `T${t.talla}: ${t.contado}/${t.esperado}`)
              .join('\n');
            return [
              i.fila,
              i.zapatoId,
              i.marca,
              i.referencia,
              i.esperado,
              i.contado,
              i.diferencia > 0 ? `+${i.diferencia}` : i.diferencia,
              detalle,
            ];
          }
          return [
            i.fila,
            i.zapatoId,
            i.marca,
            i.referencia,
            i.esperado,
            i.contado,
            i.diferencia > 0 ? `+${i.diferencia}` : i.diferencia,
          ];
        });

        autoTable(doc, {
          startY: y,
          head,
          body,
          styles: { fontSize: 7, cellPadding: 2 },
          columnStyles: modoTallas ? { 7: { cellWidth: 35, fontSize: 6 } } : {},
          headStyles: { fillColor: color, textColor: 255, fontStyle: 'bold' },
          margin: { left: 14, right: 14 },
        });

        y = (doc as any).lastAutoTable.finalY + 10;
      };

      tabla('Correctos', [22, 163, 74], r.correctos);
      tabla('Faltantes', [220, 38, 38], r.faltantes);
      tabla('Sobrantes', [99, 102, 241], r.sobrantes);

      const total = (doc.internal as any).getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Auditoría de Bodega  ·  ${fecha}  ·  Página ${p} de ${total}`,
          pageW / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'center' },
        );
      }
      doc.save(`Auditoria_Bodega_${fecha}.pdf`);
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo generar el PDF',
      });
    }
    this.descargandoPDF.set(false);
  }

  private fechaReporte(): string {
    const n = new Date();
    return [
      n.getFullYear(),
      String(n.getMonth() + 1).padStart(2, '0'),
      String(n.getDate()).padStart(2, '0'),
    ].join('-');
  }

  ngOnDestroy(): void {
    this.service.stopListening();
  }
}
