import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { exhibiciones, Prestamo, Products } from '../interfaces';
import { AuthService } from '../../services/auth/auth.service';
import { SalesService } from '../../services/vendedorServices/ventas/sales.service';
import { CatalogoService } from '../../services/catalogo/catalogo.service';
import { AlertasIaService } from '../../services/administracion/ia/alertas-ia.service';
import {
  AdminPremier,
  ReporteManualService,
} from '../../services/administracion/ia/reporte-manual.service';
import { PrestamosService } from '../../services/vendedorServices/prestamos/prestamos.service';
import { LocalesService } from '../../services/locales/locales.service';

import { AlertasPanelComponent } from './ia/alertas-panel.component';
import { OtherSitesComponent } from '../../components/administracion_components/other-sites/other-sites.component';
import { LoadingSkeletonComponent } from './skeleton-component/loading-skeleton.component';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { ExhibicionesService } from '../../services/vendedorServices/exhibiciones/exhibiciones.service';
import { ReposicionModalComponent } from './reposicion/reposicion-modal.component';
import { IaSpinnerComponent } from '../../shared/components/ia-loader/ia-spinner.component';
import {
  NovedadesModalComponent,
  NovedadesService,
} from './novedades/novedades-modal.component';
import { ReposicionModalService } from '../../services/administracion/reposicion/reposicion-modal.service';

const CHART_X0 = 40;
const CHART_X1 = 690;
const CHART_Y0 = 10;
const CHART_Y1 = 170;
const CHART_W = CHART_X1 - CHART_X0;
const CHART_H = CHART_Y1 - CHART_Y0;

const VENDEDOR_COLORS = [
  '#f59e0b',
  '#8b5cf6',
  '#10b981',
  '#3b82f6',
  '#ef4444',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

export interface VendedorPrestamo {
  nombre: string;
  total: number;
  activos: number;
  vendidos: number;
  devueltos: number;
  pct: number;
}

export interface SemanaData {
  valor: number;
  pct: number;
}

export interface ChartPoint {
  x: number;
  y: number;
  value: number;
  mes: string;
}

@Component({
  selector: 'app-administracion',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AlertasPanelComponent,
    NovedadesModalComponent,
    IaSpinnerComponent,
    OtherSitesComponent,
    LoadingSkeletonComponent,
    ReposicionModalComponent,
  ],
  templateUrl: './administracion.component.html',
  styleUrl: './administracion.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdministracionComponent implements OnInit, OnDestroy {
  userName = '';
  capitalExhibiciones: number | undefined = undefined;

  totalProductos: number | undefined = undefined;
  capital: number | undefined = undefined;
  totalZapatos: number | undefined = undefined;
  totalTrabajadores: number | undefined = undefined;
  totalLocales: number | undefined = undefined;
  ventasMesActual: number | undefined = undefined;

  /** Fecha que se muestra en el encabezado. */
  hoy = new Date();
  /** Total vendido el mes anterior (del resumen anual); `null` si no hay dato para comparar. */
  ventasMesAnterior: number | null = null;

  /**
   * Variación REAL frente al mes anterior. Como el mes en curso está incompleto, se compara el
   * promedio de ventas por día (lo vendido / días transcurridos) contra el promedio diario del
   * mes anterior. Así no sale siempre negativo a principio de mes.
   */
  get ritmoVsMesAnterior(): number | null {
    const actual = this.ventasMesActual;
    const anterior = this.ventasMesAnterior;
    if (actual === undefined || !anterior || anterior <= 0) return null;
    const hoy = new Date();
    const diasTranscurridos = hoy.getDate();
    const diasMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate();
    const ritmoActual = actual / diasTranscurridos;
    const ritmoAnterior = anterior / diasMesAnterior;
    return Math.round(((ritmoActual - ritmoAnterior) / ritmoAnterior) * 1000) / 10;
  }

  get nombreMesAnterior(): string {
    const hoy = new Date();
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    return d.toLocaleDateString('es-CO', { month: 'long' });
  }
  totalVentasMes: number | undefined = undefined;

  mesLabels = [
    'ENE',
    'FEB',
    'MAR',
    'ABR',
    'MAY',
    'JUN',
    'JUL',
    'AGO',
    'SEP',
    'OCT',
    'NOV',
    'DIC',
  ];
  yAxisLabels: string[] = [];
  chartPoints: ChartPoint[] = [];
  ventasPorMes: number[] = new Array(12).fill(0);
  anioSeleccionado = new Date().getFullYear();
  aniosDisponibles: number[] = [];
  totalVentasAnio = 0;

  tooltipVisible = false;
  tooltipX = 0;
  tooltipY = 0;
  tooltipText = '';

  isLoading = true;
  dataLoaded = false;

  private loadedSections = {
    productos: false,
    ventas: false,
    prestamos: false,
    locales: false,
    exhibiciones: false,
  };

  semanaData: SemanaData[] = [];

  prestamosPorVendedor: VendedorPrestamo[] = [];
  filtroPrestamoEstado: 'todos' | 'prestado' | 'vendido' = 'todos';
  vendedorColors = VENDEDOR_COLORS;
  totalPrestamos = 0;
  totalPrestamosActivos = 0;
  totalPrestamosVendidos = 0;
  totalPrestamosVencidos = 0;
  porcentajePrestamosAlDia = 0;

  resumenIATexto = 'Analizando datos del negocio...';
  consejoDia =
    'Agrupa los modelos en liquidación cerca de la caja para aumentar el ticket promedio un 12%.';

  mostrarModal = false;
  cargandoAdmins = false;
  enviandoReporte = false;
  reporteEnviado = false;
  errorReporte = false;
  admins: AdminPremier[] = [];

  private subs = new Subscription();

  constructor(
    private authService: AuthService,
    private salesService: SalesService,
    private catalogoService: CatalogoService,
    private alertasService: AlertasIaService,
    private reporteService: ReporteManualService,
    private prestamosService: PrestamosService,
    private localesService: LocalesService,
    private exhibicionesService: ExhibicionesService,
    private cdRef: ChangeDetectorRef,
    private el: ElementRef,
    private supabase: SupabaseService,
    public reposicionModalService: ReposicionModalService,
    public novedadesService: NovedadesService,
  ) {}

  async ngOnInit(): Promise<void> {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.isLoading = true;
    this.dataLoaded = false;
    this.getNameByAuth();
    this.salesService.initVentas();
    this.catalogoService.registrar();
    this.prestamosService.registrar();
    this.localesService.registrar();

    try {
      this.subs.add(
        this.salesService
          .getVentasPorMes$(new Date())
          .subscribe((ventasMesActual) => {
            this.construirSemanaBars(ventasMesActual);
            this.ventasMesActual = this.sumarVentas(ventasMesActual);
            this.totalVentasMes = ventasMesActual.length;
            this.cargarDatosGrafica(this.anioSeleccionado);
            this.loadedSections.ventas = true;
            this.checkAllDataLoaded();
            this.cdRef.markForCheck();
          }),
      );

      this.exhibicionesService
        .obtenerCapitalTotalExhibiciones()
        .then((total) => {
          this.capitalExhibiciones = total;
          this.loadedSections.exhibiciones = true;
          this.checkAllDataLoaded();
          this.cdRef.markForCheck();
        });
      await this.exhibicionesService.cargarTodasExhibiciones();

      this.prestamosService.reiniciarListener();
      this.subs.add(
        this.prestamosService.getPrestamos$().subscribe((prestamos) => {
          this.construirPrestamosPorVendedor(prestamos);
          this.loadedSections.prestamos = true;
          this.checkAllDataLoaded();
          this.cdRef.markForCheck();
        }),
      );

      this.localesService.reiniciarListener();
      this.subs.add(
        this.localesService.obtenerLocales().subscribe((locales) => {
          this.totalLocales = locales.length;
          this.totalTrabajadores = locales.filter(
            (l) => l.estado === 'Activo',
          ).length;
          this.loadedSections.locales = true;
          this.checkAllDataLoaded();
          this.cdRef.markForCheck();
        }),
      );

      Promise.all([
        this.catalogoService.obtenerCantidadProductos(),
        this.catalogoService.obtenerStockTotalAgregado(),
        this.catalogoService.obtenerCapitalTotalAgregado(),
      ]).then(([totalProductos, totalZapatos, capital]) => {
        this.totalProductos = totalProductos;
        this.totalZapatos = totalZapatos;
        this.capital = capital;
        this.loadedSections.productos = true;
        this.checkAllDataLoaded();
        this.cdRef.markForCheck();
      });

      this.alertasService.verificarAlertasDelDia(this.userName);
      this.cdRef.markForCheck();
      setTimeout(() => {
        if (!this.dataLoaded) {
          console.warn('Timeout de seguridad: forzando cierre del loader');
          this.isLoading = false;
          this.dataLoaded = true;
          this.cdRef.markForCheck();
        }
      }, 10000);
    } catch (error) {
      console.error('Error inicializando:', error);
      this.isLoading = false;
      this.cdRef.markForCheck();
    }
  }

  private checkAllDataLoaded(): void {
    const allLoaded = Object.values(this.loadedSections).every((v) => v);
    if (allLoaded && !this.dataLoaded) {
      this.dataLoaded = true;
      this.isLoading = false;
      this.cdRef.markForCheck();
    }
  }

  private sumarVentas(ventas: any[]): number {
    return ventas
      .filter(
        (v) =>
          v.tipoVenta !== 'Devuelto por cambio' &&
          v.tipoVenta !== 'Devuelto por bono',
      )
      .reduce(
        (acc, v) =>
          acc +
          (v.tipoVenta === 'Cambio' && !v.esMismoDia
            ? Number(v.excedente || 0)
            : (v.precio ?? 0)),
        0,
      );
  }

  tooltipIndexActivo: number | null = null;

  toggleTooltip(idx: number, event: MouseEvent): void {
    event.stopPropagation();
    if (this.tooltipVisible && this.tooltipIndexActivo === idx) {
      this.hideTooltip();
      return;
    }
    this.tooltipIndexActivo = idx;
    this.showTooltip(idx, event);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.hideTooltip();
  }

  private cargarDatosGrafica(anio: number): void {
    const esAnioActual = anio === new Date().getFullYear();
    const mesActual = new Date().getMonth();

    this.subs.add(
      this.salesService.getResumenAnual$(anio).subscribe((resumen) => {
        const porMes = new Array(12).fill(0);
        for (let m = 0; m < 12; m++) {
          if (esAnioActual && m === mesActual) continue;
          porMes[m] = resumen?.[m]?.total ?? 0;
        }
        if (esAnioActual) porMes[mesActual] = this.ventasMesActual ?? 0;
        // Base para la variación del mes: el total del mes anterior (enero no tiene con qué comparar aquí)
        if (esAnioActual) {
          this.ventasMesAnterior =
            mesActual > 0 ? Number(resumen?.[mesActual - 1]?.total ?? 0) : null;
        }

        this.ventasPorMes = porMes;
        this.totalVentasAnio = porMes.reduce((a, b) => a + b, 0);
        this.buildChartPoints();
        this.buildYAxis();
        this.cdRef.markForCheck();
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.catalogoService.desregistrar();
    this.prestamosService.desregistrar();
    this.localesService.desregistrar();
    sessionStorage.removeItem('hasReloaded');
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(_: MouseEvent): void {}

  getNameByAuth(): void {
    this.userName = this.authService.getCurrentUser()?.name ?? '';
  }

  getInitials(name: string): string {
    if (!name) return 'A';
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  }

  private calcularCapital(productos: Products[]): void {
    this.capital = productos.reduce(
      (acc, p) => acc + (p.precioAdquisicion ?? 0) * (p.stock ?? 0),
      0,
    );
  }

  private construirChartVentas(ventas: any[]): void {
    const years = new Set<number>();
    ventas.forEach((v) => {
      const d =
        v.fechaVenta instanceof Date ? v.fechaVenta : v.fechaVenta?.toDate?.();
      if (d) years.add(d.getFullYear());
    });
    const currentYear = new Date().getFullYear();
    years.add(currentYear);
    this.aniosDisponibles = Array.from(years).sort((a, b) => b - a);
    if (!this.aniosDisponibles.includes(this.anioSeleccionado)) {
      this.anioSeleccionado = this.aniosDisponibles[0];
    }

    const porMes = new Array(12).fill(0);
    const currentMes = new Date().getMonth();

    ventas.forEach((v) => {
      const d =
        v.fechaVenta instanceof Date ? v.fechaVenta : v.fechaVenta?.toDate?.();
      if (!d) return;
      if (d.getFullYear() !== this.anioSeleccionado) return;

      if (
        v.tipoVenta === 'Devuelto por cambio' ||
        v.tipoVenta === 'Devuelto por bono'
      )
        return;

      if (v.tipoVenta === 'Cambio' && !v.esMismoDia) {
        porMes[d.getMonth()] += Number(v.excedente || 0);
        return;
      }

      porMes[d.getMonth()] += v.precio ?? 0;
    });

    this.ventasPorMes = porMes;
    this.totalVentasAnio = porMes.reduce((a, b) => a + b, 0);
    this.ventasMesActual = porMes[currentMes];

    this.totalVentasMes = ventas.filter((v) => {
      const d =
        v.fechaVenta instanceof Date ? v.fechaVenta : v.fechaVenta?.toDate?.();
      return (
        d &&
        d.getFullYear() === currentYear &&
        d.getMonth() === currentMes &&
        v.tipoVenta !== 'Devuelto por cambio' &&
        v.tipoVenta !== 'Devuelto por bono' &&
        !(v.tipoVenta === 'Cambio' && !v.esMismoDia)
      );
    }).length;

    this.buildChartPoints();
    this.buildYAxis();
  }

  private buildChartPoints(): void {
    const max = Math.max(...this.ventasPorMes, 1);
    this.chartPoints = this.ventasPorMes.map((val, i) => ({
      x: CHART_X0 + (i * CHART_W) / 11,
      y: CHART_Y1 - (val / max) * CHART_H,
      value: val,
      mes: this.mesLabels[i],
    }));
  }

  private buildYAxis(): void {
    const max = Math.max(...this.ventasPorMes, 1);
    this.yAxisLabels = [0, 1, 2, 3].map((i) => {
      const val = (max / 3) * i;
      if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
      if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
      return `$${val.toFixed(0)}`;
    });
  }

  getLinePath(): string {
    if (!this.chartPoints.length) return '';
    return this.chartPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
      .join(' ');
  }

  getAreaPath(): string {
    if (!this.chartPoints.length) return '';
    const line = this.chartPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
      .join(' ');
    const last = this.chartPoints[this.chartPoints.length - 1];
    const first = this.chartPoints[0];
    return `${line} L${last.x},${CHART_Y1} L${first.x},${CHART_Y1} Z`;
  }

  seleccionarAnio(year: number): void {
    this.anioSeleccionado = year;
    this.subs.add(
      this.salesService.getVentas$().subscribe((ventas) => {
        this.construirChartVentas(ventas);
        this.cdRef.markForCheck();
      }),
    );
  }

  showTooltip(idx: number, event: MouseEvent): void {
    const p = this.chartPoints[idx];
    const container = (event.target as SVGElement).closest(
      '.relative',
    ) as HTMLElement;
    const rect = container?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const svgEl = (event.target as SVGElement).closest('svg') as SVGSVGElement;
    const svgRect = svgEl?.getBoundingClientRect() ?? {
      left: 0,
      top: 0,
      width: 700,
      height: 220,
    };
    const scaleX = svgRect.width / 700;
    const scaleY = svgRect.height / 200;

    this.tooltipX = p.x * scaleX + (svgRect.left - rect.left) - 40;
    this.tooltipY = p.y * scaleY + (svgRect.top - rect.top) - 36;
    this.tooltipText = `${p.mes}: ${p.value.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}`;
    this.tooltipVisible = true;
  }

  hideTooltip(): void {
    this.tooltipVisible = false;
    this.tooltipIndexActivo = null;
  }

  private construirSemanaBars(ventas: any[]): void {
    const now = new Date();
    const year = now.getFullYear();
    const mes = now.getMonth();
    const daysInMonth = new Date(year, mes + 1, 0).getDate();

    const semanas = [
      { ini: 1, fin: 7 },
      { ini: 8, fin: 14 },
      { ini: 15, fin: 21 },
      { ini: 22, fin: daysInMonth },
    ];

    const sums = semanas.map((s) =>
      ventas
        .filter((v) => {
          const d =
            v.fechaVenta instanceof Date
              ? v.fechaVenta
              : v.fechaVenta?.toDate?.();
          if (!d) return false;
          return (
            d.getFullYear() === year &&
            d.getMonth() === mes &&
            d.getDate() >= s.ini &&
            d.getDate() <= s.fin &&
            v.tipoVenta !== 'Devuelto por cambio' &&
            v.tipoVenta !== 'Devuelto por bono'
          );
        })
        .reduce((acc, v) => {
          if (v.tipoVenta === 'Cambio' && !v.esMismoDia) {
            return acc + Number(v.excedente || 0);
          }
          return acc + (v.precio ?? 0);
        }, 0),
    );

    const maxSem = Math.max(...sums, 1);
    this.semanaData = sums.map((v) => ({ valor: v, pct: (v / maxSem) * 100 }));
  }

  private construirPrestamosPorVendedor(prestamos: Prestamo[]): void {
    this.totalPrestamos = prestamos.length;
    this.totalPrestamosActivos = prestamos.filter(
      (p) => p.estado === 'prestado',
    ).length;
    this.totalPrestamosVendidos = prestamos.filter(
      (p) => p.estado === 'vendido',
    ).length;
    this.totalPrestamosVencidos = 0;
    this.porcentajePrestamosAlDia = this.totalPrestamos
      ? Math.round(
          ((this.totalPrestamos - this.totalPrestamosVencidos) /
            this.totalPrestamos) *
            100,
        )
      : 100;

    const mapa = new Map<
      string,
      { total: number; activos: number; vendidos: number; devueltos: number }
    >();
    prestamos.forEach((p) => {
      const nombre = p.vendedor ?? p.localPrestado ?? 'Sin asignar';
      if (!mapa.has(nombre)) {
        mapa.set(nombre, { total: 0, activos: 0, vendidos: 0, devueltos: 0 });
      }
      const entry = mapa.get(nombre)!;
      entry.total++;
      if (p.estado === 'prestado') entry.activos++;
      if (p.estado === 'vendido') entry.vendidos++;
      if (p.estado === 'devuelto') entry.devueltos++;
    });

    const maxTotal = Math.max(
      ...Array.from(mapa.values()).map((v) => v.total),
      1,
    );
    this.prestamosPorVendedor = Array.from(mapa.entries())
      .map(([nombre, data]) => ({
        nombre,
        ...data,
        pct: (data.total / maxTotal) * 100,
      }))
      .sort((a, b) => b.total - a.total);

    this.construirResumenIA();
  }

  get prestamosPorVendedorFiltrado(): VendedorPrestamo[] {
    if (this.filtroPrestamoEstado === 'todos') return this.prestamosPorVendedor;
    if (this.filtroPrestamoEstado === 'prestado') {
      return this.prestamosPorVendedor
        .filter((v) => v.activos > 0)
        .map((v) => ({ ...v, total: v.activos, pct: 0 }))
        .map((v, _, arr) => {
          const mx = Math.max(...arr.map((x) => x.total), 1);
          return { ...v, pct: (v.total / mx) * 100 };
        });
    }
    return this.prestamosPorVendedor
      .filter((v) => v.vendidos > 0)
      .map((v) => ({ ...v, total: v.vendidos, pct: 0 }))
      .map((v, _, arr) => {
        const mx = Math.max(...arr.map((x) => x.total), 1);
        return { ...v, pct: (v.total / mx) * 100 };
      });
  }

  private construirResumenIA(): void {
    if (this.totalPrestamosActivos > 10) {
      this.resumenIATexto = `Hay **${this.totalPrestamosActivos}** préstamos activos...`;
    } else if ((this.totalProductos ?? 0) > 0) {
      this.resumenIATexto = `El inventario cuenta con **${this.totalProductos}** referencias. Capital invertido: **${(this.capital ?? 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}**.`;
    } else {
      this.resumenIATexto =
        'Sistema funcionando con normalidad. Sin alertas críticas activas hoy.';
    }
  }
  async abrirModal(): Promise<void> {
    this.mostrarModal = true;
    this.reporteEnviado = false;
    this.errorReporte = false;
    this.enviandoReporte = false;
    this.cargandoAdmins = true;
    this.admins = [];
    this.cdRef.markForCheck();

    try {
      this.admins = await this.reporteService.obtenerAdminsPremier();
    } catch {
      this.errorReporte = true;
    } finally {
      this.cargandoAdmins = false;
      this.cdRef.markForCheck();
    }
  }

  cerrarModal(): void {
    if (this.enviandoReporte) return;
    this.mostrarModal = false;
    this.cdRef.markForCheck();
  }

  toggleAdmin(admin: AdminPremier): void {
    admin.seleccionado = !admin.seleccionado;
    this.cdRef.markForCheck();
  }

  get adminsSeleccionados(): AdminPremier[] {
    return this.admins.filter((a) => a.seleccionado);
  }

  async enviarReporte(): Promise<void> {
    const seleccionados = this.adminsSeleccionados;
    if (!seleccionados.length) return;

    this.enviandoReporte = true;
    this.cdRef.markForCheck();

    try {
      const emails = seleccionados.map((a) => a.emailReporte);
      await this.reporteService.enviarReporte(emails);
      this.reporteEnviado = true;
      this.errorReporte = false;
      setTimeout(() => {
        this.mostrarModal = false;
        this.cdRef.markForCheck();
      }, 3000);
    } catch {
      this.errorReporte = true;
      this.reporteEnviado = false;
    } finally {
      this.enviandoReporte = false;
      this.cdRef.markForCheck();
    }
  }
}
