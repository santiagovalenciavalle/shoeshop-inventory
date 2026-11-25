import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  firstValueFrom,
  map,
  Observable,
  shareReplay,
  take,
} from 'rxjs';
import { UsuarioService } from '../../../services/administracion/usuarios/usuario.service';
import { PagosConfig, User, Venta } from '../../../pages/interfaces';
import { CommonModule } from '@angular/common';
import { SalesService } from '../../../services/vendedorServices/ventas/sales.service';
import { FormsModule } from '@angular/forms';
import { EmployeePaymentsService } from '../../../services/administracion/employeePayments/employee-payments.service';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { RouterModule } from '@angular/router';
import {
  NominaGuardadoService,
  NominaEmpleado,
  NominaGuardadaConId,
} from '../../../services/administracion/nomina/nomina-guardado.service';
import { Timestamp } from '@angular/fire/firestore';
import { GastosService } from '../../../services/administracion/gastos/gastos.service';

import { IaSpinnerComponent } from '../../../shared/components/ia-loader/ia-spinner.component';
type TipoPago = 'bodega' | 'vendedor' | 'patinador' | 'comision';

@Component({
  selector: 'app-nomina',
  imports: [
    IaSpinnerComponent,CommonModule, FormsModule, RouterModule, ToastModule],
  templateUrl: './nomina.component.html',
  styleUrl: './nomina.component.css',
  providers: [MessageService],
})
export class NominaComponent implements OnInit {
  bodegueros$!: Observable<User[]>;
  vendedores$!: Observable<User[]>;
  patinadores$!: Observable<User[]>;
  diasPorUsuario$ = new BehaviorSubject<Record<string, number>>({});
  ventasPorVendedor$!: Observable<Map<string, number>>;
  totalNomina$!: Observable<{ base: number; comision: number; total: number }>;

  diasPorUsuario: Record<string, number> = {};
  mediosDiasPorUsuario: Record<string, number> = {};
  comisionActivaPorUsuario: Record<string, boolean> = {};

  pagoDiarioBodega = 0;
  pagoDiarioVendedor = 0;
  pagoDiarioPatinador = 0;
  comisionPorZapato = 0;
  diasTrabajados = 0;

  editarBodega = false;
  editarVendedor = false;
  editarPatinador = false;
  editarComision = false;

  fechaInicioSemana!: Date;
  fechaFinSemana!: Date;

  loadingPagos = true;
  loadingUsuarios = true;
  loadingVentas = true;
  loadingGuardarPagos = false;
  loadingGuardarNomina = false;

  mostrarModalExportar = false;
  nominaGuardadaId: string | null = null;
  nominaGuardadaData: any = null;

  logoUrl = '/logo.svg';

  vistaActual: 'formulario' | 'historial' = 'formulario';
  nominasHistorial: NominaGuardadaConId[] = [];
  loadingHistorial = false;
  nominaHistorialSeleccionada: NominaGuardadaConId | null = null;
  mostrarConfirmarEliminarNomina = false;
  nominaAEliminar: NominaGuardadaConId | null = null;
  eliminandoNomina = false;
  private nominasCargadas = false;
  semanaHistorialOffset = 0;
  nominaHistorialActual: NominaGuardadaConId | null = null;
  private semanaCache = new Map<string, NominaGuardadaConId | null>();

  constructor(
    private usuarioService: UsuarioService,
    private salesService: SalesService,
    private pagosService: EmployeePaymentsService,
    private nominaService: NominaGuardadoService,
    private messageService: MessageService,
    private gastosService: GastosService,
    private cdr: ChangeDetectorRef,
  ) {}

  get pagosGlobales() {
    return [
      {
        label: 'Pago Diario Bodega',
        value: this.pagoDiarioBodega,
        editar: this.editarBodega,
        tipo: 'bodega' as TipoPago,
      },
      {
        label: 'Pago Diario Vendedor',
        value: this.pagoDiarioVendedor,
        editar: this.editarVendedor,
        tipo: 'vendedor' as TipoPago,
      },
      {
        label: 'Pago Diario Patinador',
        value: this.pagoDiarioPatinador,
        editar: this.editarPatinador,
        tipo: 'patinador' as TipoPago,
      },
      {
        label: 'Comisión por Zapato',
        value: this.comisionPorZapato,
        editar: this.editarComision,
        tipo: 'comision' as TipoPago,
      },
    ];
  }

  ngOnInit(): void {
    this.scrollToTop();
    this.calcularRangoSemana();

    this.loadingUsuarios = this.loadingVentas = this.loadingPagos = true;

    this.usuarioService.initUsuarios();
    this.salesService.initVentas();

    this.pagosService.pagos$
      .pipe(
        filter(
          (v) =>
            v.pagoDiarioBodega !== 0 ||
            v.pagoDiarioVendedor !== 0 ||
            v.pagoDiarioPatinador !== 0 ||
            v.comisionPorZapato !== 0,
        ),
        take(1),
      )
      .subscribe((v: PagosConfig) => {
        this.pagoDiarioBodega = v.pagoDiarioBodega;
        this.pagoDiarioVendedor = v.pagoDiarioVendedor;
        this.pagoDiarioPatinador = v.pagoDiarioPatinador;
        this.comisionPorZapato = v.comisionPorZapato;
        this.loadingPagos = false;
        this.cdr.detectChanges();
      });

    const usuariosActivos$ = this.usuarioService.usuarios$.pipe(
      map((users) =>
        users.filter((u) => u.active?.value && u.role !== 'admin'),
      ),
      shareReplay(1),
    );

    usuariosActivos$.pipe(take(1)).subscribe((users) => {
      const diasInit: Record<string, number> = {};
      const mediosDiasInit: Record<string, number> = {};
      const comisionInit: Record<string, boolean> = {};
      users.forEach((u) => {
        diasInit[u.id || ''] = this.diasTrabajados;
        mediosDiasInit[u.id || ''] = 0;
        comisionInit[u.id || ''] = true;
      });
      this.diasPorUsuario = { ...diasInit };
      this.mediosDiasPorUsuario = { ...mediosDiasInit };
      this.comisionActivaPorUsuario = { ...comisionInit };
      this.diasPorUsuario$.next({ ...diasInit });
      this.loadingUsuarios = false;
      this.cdr.detectChanges();
    });

    this.bodegueros$ = usuariosActivos$.pipe(
      map((u) => u.filter((x) => x.role === 'bodega')),
      shareReplay(1),
    );
    this.patinadores$ = usuariosActivos$.pipe(
      map((u) => u.filter((x) => x.role === 'patinador')),
    );

    this.ventasPorVendedor$ = this.salesService
      .getVentasSemana(new Date())
      .pipe(
        map((ventas: Venta[]) => {
          const m = new Map<string, number>();
          ventas.forEach((v) => {
            if (!v.vendedorId) return;
            if (v.tipoVenta === 'Cambio' && !v.esMismoDia) return;
            m.set(v.vendedorId, (m.get(v.vendedorId) || 0) + 1);
          });
          return m;
        }),
        shareReplay(1),
      );

    this.ventasPorVendedor$.pipe(take(1)).subscribe(() => {
      this.loadingVentas = false;
      this.cdr.detectChanges();
    });

    this.vendedores$ = combineLatest([
      usuariosActivos$.pipe(map((u) => u.filter((x) => x.role === 'vendedor'))),
      this.ventasPorVendedor$,
    ]).pipe(
      map(([vendedores, mapV]) =>
        vendedores.filter((v) => (mapV.get(v.id) || 0) > 0),
      ),
      shareReplay(1),
    );

    this.totalNomina$ = combineLatest([
      this.bodegueros$,
      this.vendedores$,
      this.patinadores$,
      this.ventasPorVendedor$,
      this.diasPorUsuario$,
    ]).pipe(
      map(([bodegueros, vendedores, patinadores, mapV, dias]) => {
        let base = 0,
          comision = 0;
        bodegueros.forEach((u) => {
          const diasCompletos = dias[u.id || ''] || 0;
          const mediosDias = this.mediosDiasPorUsuario[u.id || ''] || 0;
          const totalDias = diasCompletos + mediosDias * 0.5;
          base += this.pagoDiarioBodega * totalDias;
        });
        patinadores.forEach((u) => {
          const diasCompletos = dias[u.id || ''] || 0;
          const mediosDias = this.mediosDiasPorUsuario[u.id || ''] || 0;
          const totalDias = diasCompletos + mediosDias * 0.5;
          base += this.pagoDiarioPatinador * totalDias;
        });
        vendedores.forEach((u) => {
          const diasCompletos = dias[u.id || ''] || 0;
          const mediosDias = this.mediosDiasPorUsuario[u.id || ''] || 0;
          const totalDias = diasCompletos + mediosDias * 0.5;
          base += this.pagoDiarioVendedor * totalDias;
          if (this.comisionActivaPorUsuario[u.id || '']) {
            comision += (mapV.get(u.id) || 0) * this.comisionPorZapato;
          }
        });
        return { base, comision, total: base + comision };
      }),
    );
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  actualizarDias(id: string, dias: number) {
    this.diasPorUsuario[id] = dias;
    this.diasPorUsuario$.next({ ...this.diasPorUsuario });
  }

  actualizarMediosDias(id: string, mediosDias: number) {
    this.mediosDiasPorUsuario[id] = mediosDias;
    this.cdr.detectChanges();
  }

  actualizarComision(id: string, activo: boolean) {
    this.comisionActivaPorUsuario[id] = activo;
    this.cdr.detectChanges();
  }

  activarEdicion(tipo: TipoPago) {
    if (tipo === 'bodega') this.editarBodega = true;
    if (tipo === 'vendedor') this.editarVendedor = true;
    if (tipo === 'patinador') this.editarPatinador = true;
    if (tipo === 'comision') this.editarComision = true;
  }

  async guardarEdicion() {
    try {
      this.loadingGuardarPagos = true;
      await this.pagosService
        .guardarPagos({
          pagoDiarioBodega: this.pagoDiarioBodega,
          pagoDiarioVendedor: this.pagoDiarioVendedor,
          pagoDiarioPatinador: this.pagoDiarioPatinador,
          comisionPorZapato: this.comisionPorZapato,
        })
        .toPromise();
      this.editarBodega =
        this.editarVendedor =
        this.editarPatinador =
        this.editarComision =
          false;
      this.messageService.add({
        severity: 'success',
        summary: 'Actualización exitosa',
        detail: 'Pagos actualizados',
        life: 3000,
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudieron guardar los cambios',
        life: 4000,
      });
    } finally {
      this.loadingGuardarPagos = false;
    }
  }

  private calcularRangoSemana(): void {
    const hoy = new Date();
    const dom = new Date(hoy);
    dom.setDate(hoy.getDate() - hoy.getDay());
    dom.setHours(0, 0, 0, 0);
    const sab = new Date(dom);
    sab.setDate(dom.getDate() + 6);
    this.fechaInicioSemana = dom;
    this.fechaFinSemana = sab;
  }

  formatearFecha(fecha: Date): string {
    return fecha.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
    });
  }

  formatearTimestamp(ts: Timestamp): string {
    if (!ts?.toDate) return '';
    return ts.toDate().toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  contarEmpleados(): number {
    let count = 0;
    combineLatest([this.usuarioService.usuarios$, this.ventasPorVendedor$])
      .pipe(take(1))
      .subscribe(([usuarios, ventasMap]) => {
        count = usuarios.filter((u) => {
          if (!u.active?.value || u.role === 'admin') return false;
          if (u.role === 'vendedor' && (ventasMap.get(u.id) || 0) === 0)
            return false;
          return true;
        }).length;
      });
    return count;
  }

  calcularTotalEmpleado(id: string, tipo: string): number {
    const diasCompletos = this.diasPorUsuario[id] || 0;
    const mediosDias = this.mediosDiasPorUsuario[id] || 0;
    const totalDias = diasCompletos + mediosDias * 0.5;

    if (tipo === 'bodega') {
      return this.pagoDiarioBodega * totalDias;
    } else if (tipo === 'patinador') {
      return this.pagoDiarioPatinador * totalDias;
    }
    return 0;
  }

  calcularTotalVendedor(id: string, zapatosVendidos: number): number {
    const diasCompletos = this.diasPorUsuario[id] || 0;
    const mediosDias = this.mediosDiasPorUsuario[id] || 0;
    const totalDias = diasCompletos + mediosDias * 0.5;

    const base = this.pagoDiarioVendedor * totalDias;
    const comision = this.comisionActivaPorUsuario[id]
      ? zapatosVendidos * this.comisionPorZapato
      : 0;

    return base + comision;
  }

  private async construirDatosNomina() {
    const [bodegueros, vendedores, patinadores, ventasMap] = await Promise.all([
      firstValueFrom(this.bodegueros$),
      firstValueFrom(this.vendedores$),
      firstValueFrom(this.patinadores$),
      firstValueFrom(this.ventasPorVendedor$),
    ]);

    const empleados: NominaEmpleado[] = [];
    let totalBase = 0,
      totalComision = 0;

    (bodegueros || []).forEach((u) => {
      const diasCompletos = this.diasPorUsuario[u.id || ''] || 0;
      const mediosDias = this.mediosDiasPorUsuario[u.id || ''] || 0;
      const totalDias = diasCompletos + mediosDias * 0.5;
      const base = this.pagoDiarioBodega * totalDias;
      totalBase += base;
      empleados.push({
        id: u.id || '',
        nombre: u.name,
        rol: 'bodega',
        diasTrabajados: diasCompletos,
        mediosDias: mediosDias,
        pagoDiario: this.pagoDiarioBodega,
        base,
        total: base,
      });
    });

    (patinadores || []).forEach((u) => {
      const diasCompletos = this.diasPorUsuario[u.id || ''] || 0;
      const mediosDias = this.mediosDiasPorUsuario[u.id || ''] || 0;
      const totalDias = diasCompletos + mediosDias * 0.5;
      const base = this.pagoDiarioPatinador * totalDias;
      totalBase += base;
      empleados.push({
        id: u.id || '',
        nombre: u.name,
        rol: 'patinador',
        diasTrabajados: diasCompletos,
        mediosDias: mediosDias,
        pagoDiario: this.pagoDiarioPatinador,
        base,
        total: base,
      });
    });

    (vendedores || []).forEach((u) => {
      const diasCompletos = this.diasPorUsuario[u.id || ''] || 0;
      const mediosDias = this.mediosDiasPorUsuario[u.id || ''] || 0;
      const totalDias = diasCompletos + mediosDias * 0.5;
      const zapatos = ventasMap?.get(u.id) || 0;
      const base = this.pagoDiarioVendedor * totalDias;
      const comision = this.comisionActivaPorUsuario[u.id || '']
        ? zapatos * this.comisionPorZapato
        : 0;
      totalBase += base;
      totalComision += comision;
      empleados.push({
        id: u.id || '',
        nombre: u.name,
        rol: 'vendedor',
        diasTrabajados: diasCompletos,
        mediosDias: mediosDias,
        pagoDiario: this.pagoDiarioVendedor,
        base,
        zapatosVendidos: zapatos,
        comisionPorZapato: this.comisionPorZapato,
        comisionTotal: comision,
        comisionActiva: this.comisionActivaPorUsuario[u.id || ''] ?? true,
        total: base + comision,
      });
    });

    const semana = `${this.formatearFecha(this.fechaInicioSemana)} – ${this.formatearFecha(this.fechaFinSemana)}`;

    return {
      categoria: 'nomina' as const,
      semana,
      fechaInicio: Timestamp.fromDate(this.fechaInicioSemana),
      fechaFin: Timestamp.fromDate(this.fechaFinSemana),
      empleados,
      config: {
        pagoDiarioBodega: this.pagoDiarioBodega,
        pagoDiarioVendedor: this.pagoDiarioVendedor,
        pagoDiarioPatinador: this.pagoDiarioPatinador,
        comisionPorZapato: this.comisionPorZapato,
      },
      totales: {
        base: totalBase,
        comisiones: totalComision,
        total: totalBase + totalComision,
        totalEmpleados: empleados.length,
      },
    };
  }

  confirmarEliminarNomina(nom: NominaGuardadaConId): void {
    this.nominaAEliminar = nom;
    this.mostrarConfirmarEliminarNomina = true;
    this.cdr.detectChanges();
  }

  cancelarEliminarNomina(): void {
    this.nominaAEliminar = null;
    this.mostrarConfirmarEliminarNomina = false;
    this.cdr.detectChanges();
  }

  async eliminarNomina(): Promise<void> {
    if (!this.nominaAEliminar?.docId) return;
    this.eliminandoNomina = true;
    this.cdr.detectChanges();
    try {
      await this.nominaService.eliminarNomina(this.nominaAEliminar.docId);

      this.semanaCache.clear();
      this.nominaHistorialActual = null;
      this.nominaAEliminar = null;
      this.mostrarConfirmarEliminarNomina = false;

      this.messageService.add({
        severity: 'success',
        summary: 'Nómina eliminada',
        detail: 'La nómina fue eliminada correctamente',
        life: 3000,
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo eliminar la nómina',
        life: 4000,
      });
    } finally {
      this.eliminandoNomina = false;
      this.cdr.detectChanges();
    }
  }

  async abrirModalExportar(): Promise<void> {
    try {
      this.loadingGuardarNomina = true;
      this.cdr.detectChanges();

      const data = await this.construirDatosNomina();

      const id = await this.nominaService.guardarNomina(data);
      this.nominaGuardadaId = id;
      this.nominaGuardadaData = data;

      const hoy = new Date();
      const fechaStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
      console.warn('dataaaaaaaa', data);
      await this.gastosService.agregar({
        nombre: `Nómina Semanal ${data.semana}`,
        categoria: 'nomina',
        monto: data.totales.total,
        fecha: fechaStr,
        nota: `${data.totales.totalEmpleados} empleados · Base: $${data.totales.base.toLocaleString('es-CO')} · Comisiones: $${data.totales.comisiones.toLocaleString('es-CO')}`,
      });

      this.semanaCache.clear();
      this.mostrarModalExportar = true;

      this.messageService.add({
        severity: 'success',
        summary: '¡Nómina guardada!',
        detail: `Semana ${data.semana} registrada · Gasto creado automáticamente`,
        life: 4000,
      });
    } catch (e) {
      console.error('Error al guardar nómina:', e);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo guardar la nómina',
        life: 4000,
      });
    } finally {
      this.loadingGuardarNomina = false;
      this.cdr.detectChanges();
    }
  }
  cerrarModalExportar() {
    this.mostrarModalExportar = false;
  }

  async abrirHistorial(): Promise<void> {
    this.vistaActual = 'historial';
    this.semanaHistorialOffset = 0;
    await this.cargarNominaSemana(0);
  }

  private semanaKey(offset: number): string {
    const base = new Date(this.fechaInicioSemana);
    base.setDate(base.getDate() - offset * 7);
    return base.toISOString().split('T')[0];
  }

  async cargarNominaSemana(offset: number): Promise<void> {
    const key = this.semanaKey(offset);
    if (this.semanaCache.has(key)) {
      this.nominaHistorialActual = this.semanaCache.get(key) ?? null;
      this.cdr.detectChanges();
      return;
    }

    this.loadingHistorial = true;
    this.nominaHistorialActual = null;
    this.cdr.detectChanges();

    try {
      const base = new Date(this.fechaInicioSemana);
      base.setDate(base.getDate() - offset * 7);
      const fin = new Date(base);
      fin.setDate(base.getDate() + 6);

      const resultado = await this.nominaService.obtenerNominaPorSemana(
        base,
        fin,
      );
      this.semanaCache.set(key, resultado ?? null);
      this.nominaHistorialActual = resultado ?? null;
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo cargar la nómina de esa semana',
        life: 4000,
      });
    } finally {
      this.loadingHistorial = false;
      this.cdr.detectChanges();
    }
  }

  async irSemanaAnterior(): Promise<void> {
    this.semanaHistorialOffset++;
    await this.cargarNominaSemana(this.semanaHistorialOffset);
  }

  async irSemanaSiguiente(): Promise<void> {
    if (this.semanaHistorialOffset === 0) return;
    this.semanaHistorialOffset--;
    await this.cargarNominaSemana(this.semanaHistorialOffset);
  }

  get labelSemanaHistorial(): string {
    const base = new Date(this.fechaInicioSemana);
    base.setDate(base.getDate() - this.semanaHistorialOffset * 7);
    const fin = new Date(base);
    fin.setDate(base.getDate() + 6);
    return `${this.formatearFecha(base)} – ${this.formatearFecha(fin)}`;
  }

  seleccionarNominaHistorial(nom: NominaGuardadaConId) {
    this.nominaHistorialSeleccionada = nom;
    this.cdr.detectChanges();
  }

  cerrarDetalleHistorial() {
    this.nominaHistorialSeleccionada = null;
    this.cdr.detectChanges();
  }

  exportarPDFGeneralDesdeHistorial() {
    if (!this.nominaHistorialSeleccionada) return;
    const backup = this.nominaGuardadaData;
    const backupId = this.nominaGuardadaId;
    this.nominaGuardadaData = this.nominaHistorialSeleccionada;
    this.nominaGuardadaId = this.nominaHistorialSeleccionada.docId;
    this.exportarPDFGeneral();
    this.nominaGuardadaData = backup;
    this.nominaGuardadaId = backupId;
  }

  descargarPDFDesdeHistorial(emp: NominaEmpleado) {
    if (!this.nominaHistorialSeleccionada) return;
    const backup = this.nominaGuardadaData;
    const backupId = this.nominaGuardadaId;
    this.nominaGuardadaData = this.nominaHistorialSeleccionada;
    this.nominaGuardadaId = this.nominaHistorialSeleccionada.docId;
    this.exportarPDFTrabajador(emp);
    this.nominaGuardadaData = backup;
    this.nominaGuardadaId = backupId;
  }

  trabajadorSeleccionado: NominaEmpleado | null = null;
  mostrarSelectorTrabajador = false;

  abrirSelectorTrabajador() {
    this.mostrarSelectorTrabajador = true;
  }
  cerrarSelectorTrabajador() {
    this.mostrarSelectorTrabajador = false;
    this.trabajadorSeleccionado = null;
  }
  seleccionarYDescargar(e: NominaEmpleado) {
    this.exportarPDFTrabajador(e);
    this.cerrarSelectorTrabajador();
  }

  private cop(n: number): string {
    return n.toLocaleString('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    });
  }

  badgeRol(rol: string): string {
    const map: Record<string, string> = {
      bodega: '#6366f1',
      vendedor: '#f59e0b',
      patinador: '#10b981',
    };
    return map[rol] || '#888';
  }

  rolLabel(rol: string): string {
    const map: Record<string, string> = {
      bodega: 'Bodeguero',
      vendedor: 'Vendedor',
      patinador: 'Patinador',
    };
    return map[rol] || rol;
  }

  private estilosBasePDF(): string {
    return `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
      *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
      html, body {
        font-family: 'Inter', sans-serif;
        background: #09090e !important;
        color: #e4e4ef;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      @page { size: A4 portrait; margin: 0; }
      @media print {
        html, body { background: #09090e !important; }
        .no-print { display: none !important; }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
      }
    `;
  }

  private watermarkSVG(): string {
    const robotSVG = `
      <svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24'
           fill='none' stroke='rgba(201,168,76,0.6)' stroke-width='1.4'
           stroke-linecap='round' stroke-linejoin='round'>
        <line x1='12' y1='2' x2='12' y2='5'/>
        <circle cx='12' cy='2' r='1' fill='rgba(201,168,76,0.6)' stroke='none'/>
        <rect x='3' y='5' width='18' height='12' rx='3'/>
        <rect x='7.5' y='9' width='2.5' height='2.5' rx='0.8' fill='rgba(201,168,76,0.7)' stroke='none'/>
        <rect x='14' y='9' width='2.5' height='2.5' rx='0.8' fill='rgba(201,168,76,0.7)' stroke='none'/>
        <line x1='9' y1='13.5' x2='15' y2='13.5' stroke-width='1.2'/>
        <line x1='8' y1='17' x2='8' y2='21'/>
        <line x1='16' y1='17' x2='16' y2='21'/>
        <line x1='6' y1='21' x2='10' y2='21'/>
        <line x1='14' y1='21' x2='18' y2='21'/>
      </svg>`;
    return `
    <div style="position:fixed;bottom:24px;left:0;right:0;display:flex;align-items:center;
                justify-content:center;gap:10px;z-index:0;pointer-events:none;opacity:.22;">
      ${robotSVG}
      <span style="font-size:9px;font-weight:600;letter-spacing:.28em;text-transform:uppercase;color:#c9a84c;">
        Monitoreado por la Inteligencia Artificial de ShoeShop
      </span>
      ${robotSVG}
    </div>`;
  }

  private headerPDF(semana: string, titulo: string): string {
    return `
    <div style="background:linear-gradient(135deg,#0d0d18 0%,#120e1f 60%,#0a0f1a 100%);
                padding:44px 48px 38px;position:relative;overflow:hidden;
                border-bottom:1px solid rgba(201,168,76,.18);">
      <div style="position:absolute;top:-80px;right:-60px;width:320px;height:320px;
                  background:radial-gradient(circle,rgba(201,168,76,.13) 0%,transparent 65%);
                  border-radius:50%;pointer-events:none;"></div>
      <div style="position:relative;z-index:1;display:flex;justify-content:space-between;
                  align-items:flex-start;flex-wrap:wrap;gap:20px;">
        <div>
          <div style="display:flex;align-items:center;gap:9px;margin-bottom:14px;">
            <div style="width:5px;height:5px;border-radius:50%;background:#c9a84c;
                        box-shadow:0 0 8px #c9a84c;"></div>
            <span style="font-size:9px;font-weight:700;letter-spacing:.32em;
                         text-transform:uppercase;color:#7a5e22;">
              ShoeShop &nbsp;·&nbsp; Sistema de Nómina
            </span>
          </div>
          <h1 style="font-size:30px;font-weight:900;color:#ffffff;letter-spacing:-.5px;line-height:1.1;">
            ${titulo}
          </h1>
          <div style="height:2px;width:72px;background:linear-gradient(90deg,#c9a84c,#e8c97a,#c9a84c);
                      border-radius:2px;margin-top:14px;"></div>
        </div>
        <div>
          <div style="background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.22);
                      border-radius:14px;padding:14px 22px;display:inline-block;">
            <p style="font-size:8px;color:#7a5e22;text-transform:uppercase;
                      letter-spacing:.25em;margin-bottom:5px;">Semana</p>
            <p style="font-size:16px;font-weight:700;color:#e8c97a;">${semana}</p>
          </div>
        </div>
      </div>
    </div>
    <div style="height:1px;background:linear-gradient(90deg,transparent,#c9a84c 30%,#e8c97a 70%,transparent);opacity:.35;"></div>`;
  }

  exportarPDFGeneral() {
    if (!this.nominaGuardadaData) return;
    const d = this.nominaGuardadaData;
    const w = window.open('', '_blank');
    if (!w) return;

    const porRol = (rol: string): NominaEmpleado[] =>
      d.empleados.filter((e: NominaEmpleado) => e.rol === rol);

    const seccionHTML = (
      titulo: string,
      accentColor: string,
      empleados: NominaEmpleado[],
    ): string => {
      if (!empleados.length) return '';
      const esVendedor = titulo.toLowerCase().includes('vendedor');
      return `
      <div style="margin:0 40px 32px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <div style="width:3px;height:18px;border-radius:2px;background:${accentColor};"></div>
          <span style="font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:${accentColor};">
            ${titulo}
          </span>
          <span style="margin-left:6px;font-size:9px;color:rgba(255,255,255,.2);">
            ${empleados.length} empleado${empleados.length !== 1 ? 's' : ''}
          </span>
        </div>
        <table style="width:100%;border-collapse:collapse;background:rgba(255,255,255,.02);
                      border:1px solid rgba(255,255,255,.06);border-radius:14px;overflow:hidden;">
          <thead>
            <tr style="background:rgba(255,255,255,.045);">
              <th style="padding:11px 16px;text-align:left;font-size:8.5px;font-weight:700;
                         letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.28);
                         border-bottom:1px solid rgba(255,255,255,.07);">Nombre</th>
              <th style="padding:11px 16px;text-align:center;font-size:8.5px;font-weight:700;
                         letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.28);
                         border-bottom:1px solid rgba(255,255,255,.07);">Días</th>
              <th style="padding:11px 16px;text-align:right;font-size:8.5px;font-weight:700;
                         letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.28);
                         border-bottom:1px solid rgba(255,255,255,.07);">Base</th>
              ${
                esVendedor
                  ? `
              <th style="padding:11px 16px;text-align:center;font-size:8.5px;font-weight:700;
                         letter-spacing:.18em;text-transform:uppercase;color:rgba(245,158,11,.5);
                         border-bottom:1px solid rgba(255,255,255,.07);">Zapatos</th>
              <th style="padding:11px 16px;text-align:right;font-size:8.5px;font-weight:700;
                         letter-spacing:.18em;text-transform:uppercase;color:rgba(16,185,129,.5);
                         border-bottom:1px solid rgba(255,255,255,.07);">Comisión</th>`
                  : ''
              }
              <th style="padding:11px 16px;text-align:right;font-size:8.5px;font-weight:700;
                         letter-spacing:.18em;text-transform:uppercase;color:${accentColor};
                         border-bottom:1px solid rgba(255,255,255,.07);">Total</th>
            </tr>
          </thead>
          <tbody>
            ${empleados
              .map(
                (e: NominaEmpleado, i: number) => `
            <tr style="background:${i % 2 === 0 ? 'rgba(255,255,255,.018)' : 'transparent'};
                       border-bottom:1px solid rgba(255,255,255,.04);">
              <td style="padding:13px 16px;font-size:12px;font-weight:600;color:#e4e4ef;">${e.nombre}</td>
              <td style="padding:13px 16px;text-align:center;font-size:12px;color:rgba(255,255,255,.45);">${e.diasTrabajados}${e.mediosDias && e.mediosDias > 0 ? ` + ${e.mediosDias}½` : ''}</td>
              <td style="padding:13px 16px;text-align:right;font-size:12px;color:rgba(255,255,255,.55);">${this.cop(e.base)}</td>
              ${
                e.rol === 'vendedor'
                  ? `
              <td style="padding:13px 16px;text-align:center;font-size:13px;color:#f59e0b;font-weight:700;">${e.zapatosVendidos ?? 0}</td>
              <td style="padding:13px 16px;text-align:right;font-size:12px;color:#10b981;font-weight:600;">${this.cop(e.comisionTotal ?? 0)}</td>`
                  : ''
              }
              <td style="padding:13px 16px;text-align:right;font-size:13px;font-weight:800;color:#ffffff;">${this.cop(e.total)}</td>
            </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>`;
    };

    w.document
      .write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Nómina ${d.semana}</title><style>${this.estilosBasePDF()}</style></head><body>
${this.headerPDF(d.semana, 'Nómina Semanal Completa')}
<div style="padding:32px 0 16px;">
  ${seccionHTML('Bodegueros', '#6366f1', porRol('bodega'))}
  ${seccionHTML('Vendedores', '#c9a84c', porRol('vendedor'))}
  ${seccionHTML('Patinadores', '#10b981', porRol('patinador'))}
</div>
<div style="margin:8px 40px 56px;">
  <div style="background:linear-gradient(135deg,rgba(201,168,76,.1),rgba(201,168,76,.03));
              border:1px solid rgba(201,168,76,.22);border-radius:18px;padding:28px 32px;">
    <p style="font-size:8.5px;font-weight:700;letter-spacing:.28em;text-transform:uppercase;
              color:#7a5e22;margin-bottom:20px;">Resumen Total</p>
    <div style="display:flex;gap:48px;flex-wrap:wrap;align-items:flex-end;">
      <div>
        <p style="font-size:9px;color:rgba(255,255,255,.3);letter-spacing:.15em;text-transform:uppercase;margin-bottom:6px;">Salario Base</p>
        <p style="font-size:20px;font-weight:700;color:#e4e4ef;">${this.cop(d.totales.base)}</p>
      </div>
      <div>
        <p style="font-size:9px;color:rgba(255,255,255,.3);letter-spacing:.15em;text-transform:uppercase;margin-bottom:6px;">Comisiones</p>
        <p style="font-size:20px;font-weight:700;color:#10b981;">${this.cop(d.totales.comisiones)}</p>
      </div>
      <div style="flex:1;border-left:1px solid rgba(201,168,76,.2);padding-left:48px;min-width:220px;">
        <p style="font-size:9px;color:rgba(255,255,255,.3);letter-spacing:.15em;text-transform:uppercase;margin-bottom:6px;">
          Total Nómina · ${d.totales.totalEmpleados} empleados
        </p>
        <p style="font-size:34px;font-weight:900;color:#e8c97a;letter-spacing:-1px;">${this.cop(d.totales.total)}</p>
      </div>
    </div>
  </div>
</div>
${this.watermarkSVG()}
<script>window.onload=()=>{window.print();}<\/script>
</body></html>`);
    w.document.close();
  }

  exportarPDFTrabajador(empleado: NominaEmpleado) {
    if (!this.nominaGuardadaData) return;
    const d = this.nominaGuardadaData;
    const accentColor = this.badgeRol(empleado.rol);
    const w = window.open('', '_blank');
    if (!w) return;
    const esVendedor = empleado.rol === 'vendedor';

    w.document
      .write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>${empleado.nombre} – Nómina ${d.semana}</title><style>${this.estilosBasePDF()}</style></head><body>
${this.headerPDF(d.semana, 'Comprobante de Pago')}
<div style="padding:40px 48px 56px;">
  <div style="display:flex;align-items:center;gap:20px;margin-bottom:36px;">
    <div style="width:56px;height:56px;border-radius:16px;background:${accentColor}18;
                border:1px solid ${accentColor}40;display:flex;align-items:center;
                justify-content:center;font-size:22px;font-weight:900;color:${accentColor};flex-shrink:0;">
      ${empleado.nombre.charAt(0).toUpperCase()}
    </div>
    <div>
      <h2 style="font-size:24px;font-weight:900;color:#ffffff;letter-spacing:-.4px;line-height:1.1;">${empleado.nombre}</h2>
      <span style="display:inline-block;margin-top:6px;padding:3px 12px;border-radius:8px;
                   font-size:9px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;
                   background:${accentColor}18;color:${accentColor};border:1px solid ${accentColor}38;">
        ${this.rolLabel(empleado.rol)}
      </span>
    </div>
  </div>
  <div style="height:1px;background:rgba(255,255,255,.07);margin-bottom:28px;"></div>
  <div style="display:grid;grid-template-columns:repeat(${esVendedor ? 4 : 3},1fr);gap:12px;margin-bottom:24px;">
    <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:20px 18px;">
      <p style="font-size:8.5px;color:rgba(255,255,255,.28);letter-spacing:.2em;text-transform:uppercase;margin-bottom:10px;">Días Trabajados</p>
      <p style="font-size:32px;font-weight:300;color:#ffffff;line-height:1;">${empleado.diasTrabajados}${empleado.mediosDias && empleado.mediosDias > 0 ? ` + ${empleado.mediosDias}½` : ''}</p>
    </div>
    <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:20px 18px;">
      <p style="font-size:8.5px;color:rgba(255,255,255,.28);letter-spacing:.2em;text-transform:uppercase;margin-bottom:10px;">Pago Diario</p>
      <p style="font-size:18px;font-weight:600;color:rgba(255,255,255,.65);line-height:1;">${this.cop(empleado.pagoDiario)}</p>
    </div>
    <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:20px 18px;">
      <p style="font-size:8.5px;color:rgba(255,255,255,.28);letter-spacing:.2em;text-transform:uppercase;margin-bottom:10px;">Salario Base</p>
      <p style="font-size:18px;font-weight:600;color:rgba(255,255,255,.65);line-height:1;">${this.cop(empleado.base)}</p>
    </div>
    ${
      esVendedor
        ? `
    <div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.22);border-radius:14px;padding:20px 18px;">
      <p style="font-size:8.5px;color:rgba(245,158,11,.55);letter-spacing:.2em;text-transform:uppercase;margin-bottom:10px;">Zapatos Vendidos</p>
      <p style="font-size:32px;font-weight:800;color:#f59e0b;line-height:1;">${empleado.zapatosVendidos ?? 0}</p>
    </div>`
        : ''
    }
  </div>
  ${
    esVendedor
      ? `
  <div style="background:rgba(16,185,129,.05);border:1px solid rgba(16,185,129,.18);border-radius:14px;
              padding:20px 24px;margin-bottom:24px;display:flex;align-items:center;
              justify-content:space-between;flex-wrap:wrap;gap:12px;">
    <div>
      <p style="font-size:8.5px;color:rgba(16,185,129,.6);letter-spacing:.22em;text-transform:uppercase;margin-bottom:8px;">Detalle de Comisiones</p>
      <p style="font-size:13px;color:rgba(255,255,255,.45);">
        <span style="color:rgba(255,255,255,.65);font-weight:600;">${empleado.zapatosVendidos ?? 0}</span> zapatos ×
        <span style="color:rgba(255,255,255,.65);font-weight:600;">${this.cop(empleado.comisionPorZapato ?? 0)}</span> / zapato
      </p>
    </div>
    <p style="font-size:22px;font-weight:800;color:#10b981;">${this.cop(empleado.comisionTotal ?? 0)}</p>
  </div>`
      : ''
  }
  <div style="background:linear-gradient(135deg,rgba(201,168,76,.12),rgba(201,168,76,.04));
              border:1px solid rgba(201,168,76,.28);border-radius:18px;padding:30px 32px;
              display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:20px;">
    <div>
      <p style="font-size:8.5px;color:#7a5e22;letter-spacing:.28em;text-transform:uppercase;margin-bottom:8px;">Total a Pagar</p>
      <p style="font-size:40px;font-weight:900;color:#e8c97a;letter-spacing:-1.5px;line-height:1;">${this.cop(empleado.total)}</p>
    </div>
    <div style="text-align:right;">
      <p style="font-size:10px;color:rgba(255,255,255,.2);letter-spacing:.12em;margin-bottom:4px;">${d.semana}</p>
      <p style="font-size:9px;color:rgba(255,255,255,.15);letter-spacing:.1em;font-weight:500;">
        ID: ${this.nominaGuardadaId?.slice(-8).toUpperCase() ?? '——'}
      </p>
    </div>
  </div>
</div>
${this.watermarkSVG()}
<script>window.onload=()=>{window.print();}<\/script>
</body></html>`);
    w.document.close();
  }
}
