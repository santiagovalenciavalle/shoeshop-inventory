import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { DatePickerModule } from 'primeng/datepicker';
import { RouterModule } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { ChartModule } from 'primeng/chart';
import { SalesService } from '../../../services/vendedorServices/ventas/sales.service';
import { Venta } from '../../interfaces';
import { CatalogoService } from '../../../services/catalogo/catalogo.service';
import { SkeletonModule } from 'primeng/skeleton';
import { Subscription } from 'rxjs';
import {
  cajaDevueltaPorCambio,
  esDevueltaPorCambioConCaja,
} from '../../../services/vendedorServices/ventas/caja-devuelta.util';
interface Vendedor {
  nombre: string;
  ventasHoy: number;
  ventasTotales: number;
  cantidadVentas: number;
  totalEfectivo?: number;
  totalTransferencia?: number;
  totalSistecredito?: number;
  totalAddi?: number;
  totalBold?: number;
}

interface Local {
  nombre: string;
  ventas: number;
  hoy: number;
  ganancias: number;
  unidades: number;
  totalEfectivo?: number;
  totalTransferencia?: number;
  totalSistecredito?: number;
  totalAddi?: number;
  totalBold?: number;
}

type ModoFiltro = 'hoy' | 'dia' | 'semana' | 'mes' | 'anio';

@Component({
  selector: 'app-administration-ventas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SelectModule,
    DatePickerModule,
    ButtonModule,
    TableModule,
    CardModule,
    RouterModule,
    SkeletonModule,
    ChartModule,
  ],
  templateUrl: './administration-ventas.component.html',
  styleUrls: ['./administration-ventas.component.css'],
})
export class AdministrationVentasComponent implements OnInit, OnDestroy {
  tabs: { label: string; value: ModoFiltro }[] = [
    { label: 'Hoy', value: 'hoy' },
    { label: 'Día', value: 'dia' },
    { label: 'Semana', value: 'semana' },
    { label: 'Mes', value: 'mes' },
    { label: 'Año', value: 'anio' },
  ];
  modoFiltro: ModoFiltro = 'hoy';
  loading: boolean = true;

  fechaDia: Date = new Date();
  fechaSemana: Date = new Date();
  fechaMes: Date = new Date();
  fechaAnio: Date = new Date();

  ventas: Venta[] = [];
  /** Ventas anuladas por un cambio posterior cuyo dinero sigue en poder del vendedor. */
  private devueltasCaja: Venta[] = [];

  totalVentas = 0;
  totalUnidades = 0;
  ventasHoy = 0;
  gananciasTotales = 0;
  gananciasPropias = 0;
  ventasPropias = 0;
  ventasOtroLocal = 0;
  totalEfectivo = 0;
  totalTransferencia = 0;
  totalSistecredito = 0;
  totalAddi = 0;
  totalBold = 0;
  gananciaOtrosLocales = 0;
  locales: Local[] = [];
  ventasVendedores: Vendedor[] = [];

  aniosDisponibles: { label: string; value: Date }[] = [];

  private ventasSub!: Subscription;
  localesChartData: any[] = [];
  vendedoresChartDataCached: any = null;

  constructor(
    private salesService: SalesService,
    private catalogoService: CatalogoService,
    private cdRef: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.catalogoService.registrar();
    this.scrollToTop();
    this.generarAniosDisponibles();
    this.consultarFirebase();
  }

  ngOnDestroy(): void {
    this.catalogoService.desregistrar();
    this.ventasSub?.unsubscribe();
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private generarAniosDisponibles(): void {
    const anioActual = new Date().getFullYear();
    for (let i = 0; i < 5; i++) {
      const anio = anioActual - i;
      this.aniosDisponibles.push({
        label: String(anio),
        value: new Date(anio, 0, 1),
      });
    }
  }

  seleccionarModo(modo: ModoFiltro): void {
    this.modoFiltro = modo;
    this.consultarFirebase();
  }

  onFechaDiaChange(fecha: Date | null): void {
    if (!fecha) return;
    this.fechaDia = fecha;
    this.modoFiltro = 'dia';
    this.consultarFirebase();
  }

  getVendedoresChartData() {
    return {
      labels: this.ventasVendedores.map((v) => v.nombre),
      datasets: [
        {
          label: 'Ventas Totales',
          data: this.ventasVendedores.map((v) => v.ventasTotales),
          backgroundColor: '#b8962e',
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    };
  }

  vendedoresChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => '$ ' + ctx.raw.toLocaleString('es-CO'),
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { size: 10 },
          color: '#a1a1aa',
        },
      },
      y: {
        grid: { color: 'rgba(161,161,170,0.1)' },
        ticks: {
          font: { size: 10 },
          color: '#a1a1aa',
          callback: (val: any) => '$ ' + Number(val).toLocaleString('es-CO'),
        },
      },
    },
  };

  getChartData(local: Local) {
    return {
      labels: ['Efectivo', 'Transferencia', 'Sistecrédito', 'Addi'],
      datasets: [
        {
          data: [
            local.totalEfectivo || 0,
            local.totalTransferencia || 0,
            local.totalSistecredito || 0,
            local.totalAddi || 0,
            local.totalBold || 0,
          ],
          backgroundColor: [
            '#b8962e',
            '#3b82f6',
            '#10b981',
            '#8b5cf6',
            '#0ea5e9',
          ],
          borderWidth: 0,
        },
      ],
    };
  }

  chartOptions = {
    plugins: {
      legend: { display: false },
    },
    cutout: '65%',
  };

  onFechaSemanaChange(fecha: Date | null): void {
    if (!fecha) return;
    this.fechaSemana = fecha;
    this.modoFiltro = 'semana';
    this.consultarFirebase();
  }

  onFechaMesChange(fecha: Date | null): void {
    if (!fecha) return;
    this.fechaMes = fecha;
    this.modoFiltro = 'mes';
    this.consultarFirebase();
  }

  onFechaAnioChange(fecha: Date | null): void {
    if (!fecha) return;
    this.fechaAnio = fecha;
    this.modoFiltro = 'anio';
    this.consultarFirebase();
  }

  limpiarFiltros(): void {
    this.modoFiltro = 'hoy';
    this.fechaDia = new Date();
    this.fechaSemana = new Date();
    this.fechaMes = new Date();
    this.fechaAnio = new Date();
    this.consultarFirebase();
  }

  private consultarFirebase(): void {
    this.ventasSub?.unsubscribe();

    const inicio = performance.now();
    this.loading = true;
    this.ventas = [];
    this.locales = [];
    this.ventasVendedores = [];
    this.cdRef.detectChanges();

    let obs$;

    switch (this.modoFiltro) {
      case 'hoy':
        obs$ = this.salesService.getVentasPorDia$(new Date());
        break;
      case 'dia':
        obs$ = this.salesService.getVentasPorDia$(this.fechaDia);
        break;
      case 'semana': {
        const { domingo, sabado } = this.getSemana(this.fechaSemana);
        obs$ = this.salesService.getVentasPorSemana$(domingo, sabado);
        break;
      }
      case 'mes':
        obs$ = this.salesService.getVentasPorMes$(this.fechaMes);
        break;
      case 'anio':
        obs$ = this.salesService.getVentasPorAnio$(
          this.fechaAnio.getFullYear(),
        );
        break;
    }

    this.ventasSub = obs$.subscribe({
      next: async (ventas) => {
        const elapsed = performance.now() - inicio;
        const espera = Math.max(0, 1000 - elapsed);

        setTimeout(async () => {
          this.devueltasCaja = ventas
            .filter((v) => esDevueltaPorCambioConCaja(v))
            .map((v) => ({
              ...v,
              fechaVenta: this.convertirFecha(v.fechaVenta),
            }));

          this.ventas = ventas
            .filter(
              (v) =>
                v.tipoVenta !== 'Devuelto por cambio' &&
                v.tipoVenta !== 'Devuelto por bono',
            )
            .map((v) => ({
              ...v,
              fechaVenta: this.convertirFecha(v.fechaVenta),
            }));

          await this.calcularTotales();
          await this.agruparPorLocales();
          this.agruparPorVendedor();

          this.loading = false;
          this.cdRef.detectChanges();
        }, espera);
      },
      error: (err) => {
        console.error('Error al cargar ventas:', err);
        this.loading = false;
        this.cdRef.detectChanges();
      },
    });
  }

  getSemana(fecha: Date): { domingo: Date; sabado: Date } {
    const dia = fecha.getDay();
    const domingo = new Date(fecha);
    domingo.setDate(fecha.getDate() - dia);
    domingo.setHours(0, 0, 0, 0);
    const sabado = new Date(domingo);
    sabado.setDate(domingo.getDate() + 6);
    sabado.setHours(23, 59, 59, 999);
    return { domingo, sabado };
  }

  get labelPeriodo(): string {
    switch (this.modoFiltro) {
      case 'hoy':
        return new Date().toLocaleDateString('es-CO', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        });
      case 'dia':
        return this.fechaDia.toLocaleDateString('es-CO', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      case 'semana': {
        const { domingo, sabado } = this.getSemana(this.fechaSemana);
        return `${domingo.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} — ${sabado.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      }
      case 'mes':
        return this.fechaMes.toLocaleDateString('es-CO', {
          month: 'long',
          year: 'numeric',
        });
      case 'anio':
        return String(this.fechaAnio.getFullYear());
    }
  }

  get textoPeriodo(): string {
    switch (this.modoFiltro) {
      case 'hoy':
        return 'de hoy';
      case 'dia':
        return 'del día seleccionado';
      case 'semana':
        return 'de la semana';
      case 'mes':
        return 'del mes';
      case 'anio':
        return 'del año';
    }
  }

  private async calcularTotales(): Promise<void> {
    const hoy = this.normalizarFecha(new Date());

    this.totalVentas = 0;
    this.totalUnidades = 0;
    this.ventasHoy = 0;
    this.gananciasTotales = 0;
    this.gananciasPropias = 0;
    this.ventasPropias = 0;
    this.ventasOtroLocal = 0;
    this.totalEfectivo = 0;
    this.totalTransferencia = 0;
    this.totalSistecredito = 0;
    this.totalAddi = 0;
    this.totalBold = 0;
    this.gananciaOtrosLocales = 0;
    await Promise.all(
      this.ventas.map(async (venta) => {
        const fecha = this.convertirFecha(venta.fechaVenta);
        if (isNaN(fecha.getTime())) return;

        if (venta.tipoVenta === 'Cambio' && !venta.esMismoDia) {
          this.totalVentas += Number(venta.excedente || 0);
          this.ventasPropias += Number(venta.excedente || 0);
          this.totalEfectivo += this.sumarExcedentePorMetodo(venta, 'efectivo');
          this.totalTransferencia += this.sumarExcedentePorMetodo(
            venta,
            'transferencia',
          );
          this.totalSistecredito += this.sumarExcedentePorMetodo(
            venta,
            'sistecredito',
          );
          this.totalAddi += this.sumarExcedentePorMetodo(venta, 'addi');
          this.totalBold += this.sumarExcedentePorMetodo(venta, 'bold');
          return;
        }

        const monto = this.obtenerMontoParaVenta(venta);
        const ganancia = await this.calcularGanancia(venta, monto);

        this.totalVentas += monto;

        if ((venta.tipoVenta || '').trim().toLowerCase() !== 'otro-local') {
          this.gananciasPropias += ganancia;
          this.ventasPropias += monto;
        } else {
          this.ventasOtroLocal += monto;
        }

        if (venta.tipoVenta === 'otro-local') {
          const precioCompra = Number(venta.precioCompra) || 0;
          this.gananciaOtrosLocales += monto - precioCompra;
        }

        if (this.esMismaFecha(fecha, hoy)) this.ventasHoy += monto;

        this.totalEfectivo += this.sumarMetodoPago(venta, 'efectivo');
        this.totalTransferencia += this.sumarMetodoPago(venta, 'transferencia');
        this.totalSistecredito += this.sumarMetodoPago(venta, 'sistecredito');
        this.totalAddi += this.sumarMetodoPago(venta, 'addi');
        this.totalBold += this.sumarMetodoPago(venta, 'bold');

        if (this.cuentaComoUnidad(venta)) this.totalUnidades++;
      }),
    );

    // Dinero de ventas anuladas por un cambio posterior: el vendedor ya lo recibió,
    // así que cuenta en la caja del día en que se vendió (no en unidades ni ganancias).
    for (const venta of this.devueltasCaja) {
      const caja = cajaDevueltaPorCambio(venta);
      this.totalVentas += caja.total;
      this.ventasPropias += caja.total;
      this.totalEfectivo += caja.efectivo;
      this.totalTransferencia += caja.transferencia;
      this.totalSistecredito += caja.sistecredito;
      this.totalAddi += caja.addi;
      this.totalBold += caja.bold;
      if (this.esMismaFecha(this.convertirFecha(venta.fechaVenta), hoy))
        this.ventasHoy += caja.total;
    }

    // Ganancias = propias (sin otro-local) + ganancia de otros locales
    this.gananciasTotales = this.gananciasPropias + this.gananciaOtrosLocales;
  }

  localesSegmentos: { pct: number; x: number; y: number; color: string }[][] =
    [];

  private readonly CIRC = 2 * Math.PI * 38; // ≈ 238.76

  private prepararChartsLocales(): void {
    this.localesChartData = this.locales.map((local) => ({
      labels: ['Efectivo', 'Transferencia', 'Sistecrédito', 'Addi'],
      datasets: [
        {
          data: [
            local.totalEfectivo || 0,
            local.totalTransferencia || 0,
            local.totalSistecredito || 0,
            local.totalAddi || 0,
            local.totalBold || 0,
          ],
          backgroundColor: [
            '#b8962e',
            '#3b82f6',
            '#10b981',
            '#8b5cf6',
            '#0ea5e9',
          ],
          borderWidth: 0,
        },
      ],
    }));

    this.localesSegmentos = this.locales.map((local) =>
      this.calcularSegmentos(local),
    );
  }

  private calcularSegmentos(
    local: Local,
  ): { pct: number; x: number; y: number; color: string }[] {
    const total = local.ventas;
    if (!total) return [];

    const valores = [
      { valor: local.totalEfectivo || 0, color: '#b8962e' },
      { valor: local.totalTransferencia || 0, color: '#3b82f6' },
      { valor: local.totalSistecredito || 0, color: '#10b981' },
      { valor: local.totalAddi || 0, color: '#8b5cf6' },
      { valor: local.totalBold || 0, color: '#0ea5e9' },
    ];

    const R = 55,
      CX = 60,
      CY = 60;
    let anguloAcum = -90;

    return valores.map(({ valor, color }) => {
      const pct = Math.round((valor / total) * 100);
      const angSegmento = (valor / total) * 360;
      const angMedio = anguloAcum + angSegmento / 2;
      const rad = (angMedio * Math.PI) / 180;
      const x = CX + R * Math.cos(rad);
      const y = CY + R * Math.sin(rad);
      anguloAcum += angSegmento;
      return { pct, x, y, color };
    });
  }

  // Helpers puros para el SVG — reciben números, no objetos Local
  donutDash(valor: number, total: number): string {
    if (!total) return `0 ${this.CIRC}`;
    return `${(valor / total) * this.CIRC} ${this.CIRC}`;
  }

  donutOffset(acumulado: number, total: number): string {
    if (!total) return '0';
    return String(-((acumulado / total) * this.CIRC));
  }

  private async agruparPorLocales(): Promise<void> {
    const mapa = new Map<string, Local>();
    const hoy = this.normalizarFecha(new Date());

    await Promise.all(
      this.ventas.map(async (venta) => {
        const fecha = this.convertirFecha(venta.fechaVenta);
        if (isNaN(fecha.getTime())) return;

        const nombreLocal = venta.local || 'Sin Local';

        if (!mapa.has(nombreLocal)) {
          mapa.set(nombreLocal, {
            nombre: nombreLocal,
            ventas: 0,
            hoy: 0,
            ganancias: 0,
            unidades: 0,
            totalEfectivo: 0,
            totalTransferencia: 0,
            totalSistecredito: 0,
            totalAddi: 0,
            totalBold: 0,
          });
        }

        const data = mapa.get(nombreLocal)!;

        if (venta.tipoVenta === 'Cambio' && !venta.esMismoDia) {
          data.ventas += Number(venta.excedente || 0);
          data.totalEfectivo! += this.sumarExcedentePorMetodo(
            venta,
            'efectivo',
          );
          data.totalTransferencia! += this.sumarExcedentePorMetodo(
            venta,
            'transferencia',
          );
          data.totalSistecredito! += this.sumarExcedentePorMetodo(
            venta,
            'sistecredito',
          );
          data.totalAddi! += this.sumarExcedentePorMetodo(venta, 'addi');
          data.totalBold! += this.sumarExcedentePorMetodo(venta, 'bold');
          return;
        }

        const monto = this.obtenerMontoParaVenta(venta);
        const ganancia = await this.calcularGanancia(venta, monto);

        data.ventas += monto;
        data.ganancias += ganancia;
        if (this.cuentaComoUnidad(venta)) data.unidades++;
        if (this.esMismaFecha(fecha, hoy)) data.hoy += monto;

        data.totalEfectivo! += this.sumarMetodoPago(venta, 'efectivo');
        data.totalTransferencia! += this.sumarMetodoPago(
          venta,
          'transferencia',
        );
        data.totalSistecredito! += this.sumarMetodoPago(venta, 'sistecredito');
        data.totalAddi! += this.sumarMetodoPago(venta, 'addi');
        data.totalBold! += this.sumarMetodoPago(venta, 'bold');
      }),
    );

    for (const venta of this.devueltasCaja) {
      const nombreLocal = venta.local || 'Sin Local';
      if (!mapa.has(nombreLocal)) {
        mapa.set(nombreLocal, {
          nombre: nombreLocal,
          ventas: 0,
          hoy: 0,
          ganancias: 0,
          unidades: 0,
          totalEfectivo: 0,
          totalTransferencia: 0,
          totalSistecredito: 0,
          totalAddi: 0,
          totalBold: 0,
        });
      }
      const data = mapa.get(nombreLocal)!;
      const caja = cajaDevueltaPorCambio(venta);
      data.ventas += caja.total;
      if (this.esMismaFecha(this.convertirFecha(venta.fechaVenta), hoy))
        data.hoy += caja.total;
      data.totalEfectivo! += caja.efectivo;
      data.totalTransferencia! += caja.transferencia;
      data.totalSistecredito! += caja.sistecredito;
      data.totalAddi! += caja.addi;
      data.totalBold! += caja.bold;
    }

    this.locales = Array.from(mapa.values());
    this.prepararChartsLocales();
  }

  private agruparPorVendedor(): void {
    const mapa = new Map<string, Vendedor>();
    const hoy = this.normalizarFecha(new Date());

    for (const venta of this.ventas) {
      const fecha = this.convertirFecha(venta.fechaVenta);
      if (isNaN(fecha.getTime())) continue;

      const vendedorRaw = venta.vendedor || 'Sin Vendedor';
      const key = vendedorRaw.trim().toLowerCase();

      if (!mapa.has(key)) {
        mapa.set(key, {
          nombre: vendedorRaw,
          ventasHoy: 0,
          ventasTotales: 0,
          cantidadVentas: 0,
          totalEfectivo: 0,
          totalTransferencia: 0,
          totalSistecredito: 0,
          totalAddi: 0,
          totalBold: 0,
        });
      }

      const data = mapa.get(key)!;

      if (venta.tipoVenta === 'Cambio' && !venta.esMismoDia) {
        data.ventasTotales += Number(venta.excedente || 0);
        data.totalEfectivo! += this.sumarExcedentePorMetodo(venta, 'efectivo');
        data.totalTransferencia! += this.sumarExcedentePorMetodo(
          venta,
          'transferencia',
        );
        data.totalSistecredito! += this.sumarExcedentePorMetodo(
          venta,
          'sistecredito',
        );
        data.totalAddi! += this.sumarExcedentePorMetodo(venta, 'addi');
        data.totalBold! += this.sumarExcedentePorMetodo(venta, 'bold');
        continue;
      }

      const monto = this.obtenerMontoParaVenta(venta);
      data.ventasTotales += monto;
      if (this.cuentaComoUnidad(venta)) data.cantidadVentas++;
      if (this.esMismaFecha(fecha, hoy)) data.ventasHoy += monto;

      data.totalEfectivo! += this.sumarMetodoPago(venta, 'efectivo');
      data.totalTransferencia! += this.sumarMetodoPago(venta, 'transferencia');
      data.totalSistecredito! += this.sumarMetodoPago(venta, 'sistecredito');
      data.totalAddi! += this.sumarMetodoPago(venta, 'addi');
      data.totalBold! += this.sumarMetodoPago(venta, 'bold');
    }

    for (const venta of this.devueltasCaja) {
      const vendedorRaw = venta.vendedor || 'Sin Vendedor';
      const key = vendedorRaw.trim().toLowerCase();
      if (!mapa.has(key)) {
        mapa.set(key, {
          nombre: vendedorRaw,
          ventasHoy: 0,
          ventasTotales: 0,
          cantidadVentas: 0,
          totalEfectivo: 0,
          totalTransferencia: 0,
          totalSistecredito: 0,
          totalAddi: 0,
          totalBold: 0,
        });
      }
      const data = mapa.get(key)!;
      const caja = cajaDevueltaPorCambio(venta);
      data.ventasTotales += caja.total;
      if (this.esMismaFecha(this.convertirFecha(venta.fechaVenta), hoy))
        data.ventasHoy += caja.total;
      data.totalEfectivo! += caja.efectivo;
      data.totalTransferencia! += caja.transferencia;
      data.totalSistecredito! += caja.sistecredito;
      data.totalAddi! += caja.addi;
      data.totalBold! += caja.bold;
    }

    this.ventasVendedores = Array.from(mapa.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }),
    );
    this.prepararChartVendedores();
  }

  private prepararChartVendedores(): void {
    this.vendedoresChartDataCached = {
      labels: this.ventasVendedores.map((v) => v.nombre),
      datasets: [
        {
          label: 'Ventas Totales',
          data: this.ventasVendedores.map((v) => v.ventasTotales),
          backgroundColor: '#b8962e',
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    };
  }

  private async calcularGanancia(venta: Venta, monto: number): Promise<number> {
    if (venta.tipoVenta === 'Bono') return 0;
    if (venta.tipoVenta === 'Cambio' && !venta.esMismoDia) return 0;
    const precioAdquisicion =
      await this.catalogoService.getPrecioAdquisicionPorId(venta.zapatoId);
    return precioAdquisicion != null ? monto - precioAdquisicion : 0;
  }

  private obtenerMontoParaVenta(venta: Venta): number {
    if (venta.tipoVenta === 'Cambio') {
      return venta.esMismoDia ? venta.precio : 0;
    }
    if (venta.tipoVenta === 'Bono') return Number(venta.excedente) || 0;
    return venta.precio;
  }

  private sumarMetodoPago(venta: Venta, metodo: string): number {
    let total = 0;
    const principal = venta.precioMetodoPrincipal ?? venta.precio;

    if (venta.metodoPago === metodo) total += principal;
    if (venta.segundoMetodo?.metodo === metodo)
      total += venta.segundoMetodo.precio;
    total += this.sumarExcedentePorMetodo(venta, metodo);

    return total;
  }

  private sumarExcedentePorMetodo(venta: Venta, metodo: string): number {
    if (
      venta.tipoVenta === 'Cambio' &&
      venta.excedente &&
      venta.metodoExcedente === metodo
    ) {
      return Number(venta.excedente) || 0;
    }
    return 0;
  }

  private cuentaComoUnidad(venta: Venta): boolean {
    if (venta.tipoVenta === 'Cambio' && !venta.esMismoDia) return false;
    if (venta.tipoVenta === 'Bono') return false;
    return true;
  }

  private convertirFecha(fecha: any): Date {
    if (!fecha) return new Date('Invalid Date');
    if (typeof fecha.toDate === 'function') return fecha.toDate();
    return new Date(fecha);
  }

  private esMismaFecha(f1: Date, f2: Date): boolean {
    return (
      this.normalizarFecha(f1).getTime() === this.normalizarFecha(f2).getTime()
    );
  }

  private normalizarFecha(fecha: Date): Date {
    const f = new Date(fecha);
    f.setHours(0, 0, 0, 0);
    return f;
  }
}
