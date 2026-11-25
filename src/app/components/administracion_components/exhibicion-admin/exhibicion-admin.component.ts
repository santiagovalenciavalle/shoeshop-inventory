import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { exhibiciones } from '../../../pages/interfaces';
import { ExhibicionesService } from '../../../services/vendedorServices/exhibiciones/exhibiciones.service';
import { LocalesService } from '../../../services/locales/locales.service';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import * as XLSX from 'xlsx';
import { IaLoaderComponent } from '../../../shared/components/ia-loader/ia-loader.component';
@Component({
  selector: 'app-exhibicion-admin',
  standalone: true,
  imports: [
    IaLoaderComponent,
    FormsModule,
    InputTextModule,
    ButtonModule,
    SelectModule,
    CommonModule,
    BadgeModule,
    MessageModule,
    ConfirmDialogModule,
    ToastModule,
    RouterModule,
    SkeletonModule,
  ],
  templateUrl: './exhibicion-admin.component.html',
  styleUrls: ['./exhibicion-admin.component.css'],
  providers: [ConfirmationService, MessageService],
})
export class ExhibicionAdminComponent implements OnInit, OnDestroy {
  productos: exhibiciones[] = [];
  productosFiltrados: exhibiciones[] = [];
  productosAgrupados: {
    zapatoId: string;
    marca: string;
    referencia: string;
    imagen?: string;
    exhibiciones: {
      talla: string;
      locales: string[];
      id: string;
      pendienteRecibir?: boolean;
      enviadoPor?: string;
      fechahoraEnviado?: string | Date;
      recibidoPor?: string;
      fechahoraRecibido?: string | Date;
    }[];
  }[] = [];

  localesActivos: { label: string; value: string }[] = [];
  filtroCodigo: string = '';
  capitalFiltrado: number = 0;
  cargando: boolean = true;
  cargandoMas: boolean = false;
  buscando: boolean = false;
  mostrarBotonTop = false;

  filtroTexto: string = '';
  filtroLocal: string = '';
  soloPendientesRecibir: boolean = false;
  tallaEditando: string | null = null;
  nuevaTalla: string = '';
  guardandoTalla: boolean = false;

  localEditando: string | null = null;
  nuevoLocal: string = '';
  guardandoLocal: boolean = false;
  localReemplazando: string | null = null;
  localActual: string = '';
  localNuevo: string = '';
  guardandoCambioLocal: boolean = false;
  private localesSub?: Subscription;
  private exhibicionesSub?: Subscription;
  mostrarConfirmarEliminarExhibicion: boolean = false;
  exhibicionIdAEliminar: string | null = null;
  mostrarConfirmarEliminarLocal: boolean = false;
  exhibicionParaEliminarLocal: any = null;
  localAEliminar: string = '';
  paginaActual = 1;
  readonly porPagina = 30;

  productoExpandido: string | number | null = null;

  toggleProducto(id: string | number) {
    this.productoExpandido = this.productoExpandido === id ? null : id;
  }

  tieneTallasPendientes(zapato: any): boolean {
    return zapato.exhibiciones?.some((e: any) => e.pendienteRecibir) ?? false;
  }
  opcionesConfirmarRecibir: { label: string; value: boolean }[] = [
    { label: 'Sí', value: true },
    { label: 'No', value: false },
  ];
  confirmarRecibirSeleccion: boolean | null = null;
  guardandoConfiguracionRecepcion: boolean = false;

  constructor(
    public exhibicionesService: ExhibicionesService,
    private localesService: LocalesService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private cd: ChangeDetectorRef,
  ) {}

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.mostrarBotonTop = window.scrollY > 300;
  }

  async ngOnInit(): Promise<void> {
    this.localesService.registrar();
    this.irArriba();
    this.cargando = true;

    const start = Date.now();

    this.exhibicionesSub = this.exhibicionesService
      .getExhibiciones$()
      .subscribe((data) => {
        this.productos = data;
        this.buscarConCarga();

        const elapsed = Date.now() - start;
        const minTime = 1500;

        setTimeout(
          () => {
            this.cargando = false;
            this.cd.detectChanges();
          },
          elapsed < minTime ? minTime - elapsed : 0,
        );
      });

    await this.exhibicionesService.cargarTodasExhibiciones();

    this.localesSub = this.localesService
      .obtenerLocales()
      .subscribe((locales) => {
        const activos = locales.filter((l) => l.estado === 'Activo');
        this.localesActivos = [
          { label: 'Todos los locales', value: '' },
          ...activos.map((l) => ({ label: l.nombre, value: l.nombre })),
        ];
        this.filtroLocal = '';
      });

    await this.cargarConfiguracionRecepcion();
  }

  get productosVisibles() {
    return this.productosAgrupados.slice(0, this.paginaActual * this.porPagina);
  }

  get hayMasProductos(): boolean {
    return this.productosAgrupados.length > this.paginaActual * this.porPagina;
  }

  verMas(): void {
    this.paginaActual++;
  }

  irArriba() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async buscarConCarga(): Promise<void> {
    const term = this.filtroTexto.toLowerCase().trim();
    const local = this.filtroLocal.trim();
    const codigo = this.filtroCodigo.toLowerCase().trim();

    this.productosFiltrados = this.filtrar(this.productos, term, local, codigo);
    this.calcularCapitalFiltrado();
    this.agruparPorZapato();
  }

  private calcularCapitalFiltrado(): void {
    this.capitalFiltrado = this.productosFiltrados.reduce(
      (acc, p) => acc + (p.precioAdquisicion ?? 0),
      0,
    );
  }

  filtrar(
    lista: exhibiciones[],
    term: string,
    local: string,
    codigo: string = '',
  ): exhibiciones[] {
    const termLower = term.toLowerCase().trim();
    const codigoLower = codigo.toLowerCase().trim();

    return lista.filter((p) => {
      const combinacion = `${p.marca} ${p.referencia}`.toLowerCase();
      const coincideTexto =
        termLower === '' ||
        p.marca.toLowerCase().includes(termLower) ||
        p.referencia.toLowerCase().includes(termLower) ||
        combinacion.includes(termLower);

      const coincideCodigo =
        codigoLower === '' ||
        (p.zapatoId && p.zapatoId.toLowerCase() === codigoLower);

      const coincideLocal = this.coincidenLocales(p.locales);

      const coincidePendienteRecibir =
        !this.soloPendientesRecibir || p.pendienteRecibir === true;

      if (codigoLower) {
        return coincideCodigo && coincideLocal && coincidePendienteRecibir;
      } else {
        return coincideTexto && coincideLocal && coincidePendienteRecibir;
      }
    });
  }

  agruparPorZapato(): void {
    this.paginaActual = 1;

    const grouped: { [key: string]: any } = {};

    this.productosFiltrados.forEach((p) => {
      const key = p.zapatoId || p.id;
      if (!grouped[key]) {
        grouped[key] = {
          zapatoId: key,
          marca: p.marca,
          referencia: p.referencia,
          imagen: p.imagen,
          exhibiciones: [],
        };
      }
      grouped[key].exhibiciones.push({
        talla: p.talla,
        locales: p.locales,
        id: p.id,
        pendienteRecibir: p.pendienteRecibir,
        enviadoPor: p.enviadoPor,
        fechahoraEnviado: p.fechahoraEnviado,
        recibidoPor: p.recibidoPor,
        fechahoraRecibido: p.fechahoraRecibido,
      });
    });

    this.productosAgrupados = Object.values(grouped).sort((a, b) => {
      const aId = isNaN(Number(a.zapatoId)) ? a.zapatoId : Number(a.zapatoId);
      const bId = isNaN(Number(b.zapatoId)) ? b.zapatoId : Number(b.zapatoId);

      if (typeof aId === 'number' && typeof bId === 'number') {
        return bId - aId;
      } else {
        return bId.toString().localeCompare(aId.toString());
      }
    });
  }

  get totalExhibicionesFiltradas(): number {
    return this.productosFiltrados.length;
  }

  isLocalMatch(locales: string[] | string): boolean {
    if (!locales || !this.filtroLocal) return false;

    const localesArray = Array.isArray(locales) ? locales : [locales];

    return localesArray.some(
      (loc) =>
        loc.toLowerCase().replace('local ', '').trim() ===
        this.filtroLocal.toLowerCase(),
    );
  }
  private coincidenLocales(exhibicionLocales: string[]): boolean {
    if (!exhibicionLocales || !this.filtroLocal) return true;

    const filtro = this.filtroLocal.replace(/[^0-9]/g, '').trim();

    return exhibicionLocales.some((loc) => {
      if (!loc) return false;

      const locNumber = String(loc)
        .replace(/[^0-9]/g, '')
        .trim();

      return locNumber === filtro;
    });
  }

  formatearFecha(valor: string | Date | any): string {
    if (!valor) return '';

    let fecha: Date;
    if (valor?.seconds) {
      fecha = new Date(valor.seconds * 1000);
    } else if (valor instanceof Date) {
      fecha = valor;
    } else if (typeof valor === 'string') {
      const parsed = new Date(valor);
      if (isNaN(parsed.getTime())) {
        return valor;
      }
      fecha = parsed;
    } else {
      return String(valor);
    }

    return fecha.toLocaleString('es-CO', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  iniciarEdicionTalla(exhibicion: any) {
    this.tallaEditando = exhibicion.id;
    this.nuevaTalla = exhibicion.talla;
  }

  async guardarTalla(exhibicion: any) {
    if (!this.nuevaTalla.trim()) return;

    this.guardandoTalla = true;

    const actualizado = {
      ...exhibicion,
      talla: this.nuevaTalla,
    };

    try {
      const ok =
        await this.exhibicionesService.actualizarExhibicion(actualizado);

      if (ok) {
        this.messageService.add({
          severity: 'success',
          summary: 'Talla actualizada',
          detail: `Nueva talla: ${this.nuevaTalla}`,
        });
      } else {
        throw new Error();
      }
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo actualizar la talla',
      });
    }

    this.guardandoTalla = false;
    this.tallaEditando = null;
  }

  cancelarEdicion() {
    this.tallaEditando = null;
    this.nuevaTalla = '';
  }

  abrirConfirmarEliminarExhibicion(id: string) {
    this.exhibicionIdAEliminar = id;
    this.mostrarConfirmarEliminarExhibicion = true;
  }

  cancelarEliminarExhibicion() {
    this.mostrarConfirmarEliminarExhibicion = false;
    this.exhibicionIdAEliminar = null;
  }

  async ejecutarEliminarExhibicion() {
    if (!this.exhibicionIdAEliminar) return;
    const id = this.exhibicionIdAEliminar;
    this.cancelarEliminarExhibicion();

    try {
      const eliminado =
        await this.exhibicionesService.eliminarExhibicionPorId(id);
      if (eliminado) {
        this.productos = this.productos.filter((p) => p.id !== id);
        await this.buscarConCarga();

        this.messageService.add({
          severity: 'success',
          summary: 'Exhibición eliminada',
          detail: 'La exhibición fue eliminada exitosamente.',
        });
      } else {
        throw new Error('No se pudo eliminar');
      }
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Hubo un problema al eliminar la exhibición.',
      });
      console.error(error);
    }
  }
  abrirConfirmarEliminarLocal(exhibicion: any, local: string) {
    this.exhibicionParaEliminarLocal = exhibicion;
    this.localAEliminar = local;
    this.mostrarConfirmarEliminarLocal = true;
  }

  cancelarEliminarLocal() {
    this.mostrarConfirmarEliminarLocal = false;
    this.exhibicionParaEliminarLocal = null;
    this.localAEliminar = '';
  }

  async ejecutarEliminarLocal() {
    if (!this.exhibicionParaEliminarLocal || !this.localAEliminar) return;

    const exhibicion = this.exhibicionParaEliminarLocal;
    const local = this.localAEliminar;
    this.cancelarEliminarLocal();

    const localesActualizados = exhibicion.locales.filter(
      (l: string) => l !== local,
    );

    try {
      const ok = await this.exhibicionesService.actualizarExhibicion({
        ...exhibicion,
        locales: localesActualizados,
      });
      if (ok) {
        this.messageService.add({
          severity: 'success',
          summary: 'Local eliminado',
          detail: `Se eliminó ${local} de la exhibición`,
        });
      } else {
        throw new Error();
      }
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo eliminar el local',
      });
    }
  }

  async onSearchChange(): Promise<void> {
    this.buscando = true;
    await this.buscarConCarga();
    this.buscando = false;
  }

  async onSearch(): Promise<void> {
    this.buscando = true;
    await this.buscarConCarga();
    this.buscando = false;
  }

  confirmarEliminarExhibicion(id: string) {
    this.confirmationService.confirm({
      message: '¿Estás seguro de eliminar esta exhibición?',
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      accept: async () => {
        try {
          const eliminado =
            await this.exhibicionesService.eliminarExhibicionPorId(id);
          if (eliminado) {
            this.exhibicionesService.reset();
            this.messageService.add({
              severity: 'success',
              summary: 'Exhibición eliminada',
              detail: 'La exhibición fue eliminada exitosamente.',
            });
          } else {
            throw new Error('No se pudo eliminar');
          }
        } catch (error) {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Hubo un problema al eliminar la exhibición.',
          });
          console.error(error);
        }
      },
    });
  }

  iniciarAgregarLocal(exhibicion: any) {
    this.localEditando = exhibicion.id;
    this.nuevoLocal = '';
  }

  cancelarAgregarLocal() {
    this.localEditando = null;
    this.nuevoLocal = '';
  }

  async guardarLocal(exhibicion: any) {
    if (!this.nuevoLocal) return;

    const localFormateado = `local ${this.nuevoLocal}`;

    const yaExiste = exhibicion.locales.some(
      (l: string) => l.toLowerCase().trim() === localFormateado,
    );

    if (yaExiste) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Local duplicado',
        detail: 'Este local ya existe en la exhibición',
      });
      return;
    }

    this.guardandoLocal = true;

    const actualizado = {
      ...exhibicion,
      locales: [...exhibicion.locales, localFormateado],
    };

    try {
      const ok =
        await this.exhibicionesService.actualizarExhibicion(actualizado);

      if (ok) {
        this.messageService.add({
          severity: 'success',
          summary: 'Local agregado',
          detail: `Se agregó ${localFormateado}`,
        });
      } else {
        throw new Error();
      }
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo agregar el local',
      });
    }

    this.guardandoLocal = false;
    this.localEditando = null;
  }

  iniciarCambioLocal(exhibicion: any, local: string) {
    this.localReemplazando = exhibicion.id;
    this.localActual = local;
    this.localNuevo = '';
  }

  cancelarCambioLocal() {
    this.localReemplazando = null;
    this.localActual = '';
    this.localNuevo = '';
  }
  async guardarCambioLocal(exhibicion: any) {
    if (!this.localNuevo) return;

    const localFormateado = `local ${this.localNuevo}`;

    this.guardandoCambioLocal = true;

    const localesActualizados = exhibicion.locales.map((l: string) =>
      l === this.localActual ? localFormateado : l,
    );

    try {
      const ok = await this.exhibicionesService.actualizarExhibicion({
        ...exhibicion,
        locales: localesActualizados,
      });

      if (ok) {
        this.messageService.add({
          severity: 'success',
          summary: 'Local cambiado',
          detail: `${this.localActual} → ${localFormateado}`,
        });
      } else {
        throw new Error();
      }
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo cambiar el local',
      });
    }

    this.guardandoCambioLocal = false;
    this.cancelarCambioLocal();
  }

  limpiarFiltros() {
    this.filtroTexto = '';
    this.filtroCodigo = '';
    this.filtroLocal = '';
    this.soloPendientesRecibir = false;

    this.onSearch();
  }

  descargarExcelExhibiciones(): void {
    if (!this.productosFiltrados.length) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin datos',
        detail: 'No hay exhibiciones para exportar',
      });
      return;
    }

    const filas = this.productosFiltrados
      .sort((a, b) => {
        const aId = isNaN(Number(a.zapatoId)) ? a.zapatoId : Number(a.zapatoId);
        const bId = isNaN(Number(b.zapatoId)) ? b.zapatoId : Number(b.zapatoId);

        if (typeof aId === 'number' && typeof bId === 'number') {
          return bId - aId;
        }
        return bId.toString().localeCompare(aId.toString());
      })
      .map((item) => ({
        Código: item.zapatoId,
        Marca: item.marca,
        Referencia: item.referencia,
        Talla: item.talla,
        Locales: item.locales.join(', '),
      }));

    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Exhibiciones');

    const anchos = Object.keys(filas[0]).map((key) => ({
      wch:
        Math.max(
          key.length,
          ...filas.map((f) => String(f[key as keyof typeof f] ?? '').length),
        ) + 2,
    }));
    hoja['!cols'] = anchos;

    const localNombre = this.filtroLocal
      ? `_${this.filtroLocal.replace(/\s+/g, '_')}`
      : '';
    const fechaFormateada = new Date()
      .toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'long',
      })
      .replace(/\s+/g, '_');

    XLSX.writeFile(libro, `exhibiciones${localNombre}_${fechaFormateada}.xlsx`);
  }

  private async cargarConfiguracionRecepcion(): Promise<void> {
    const valorActual =
      await this.exhibicionesService.obtenerConfiguracionRecepcion();
    this.confirmarRecibirSeleccion = valorActual;
    this.cd.detectChanges();
  }

  async guardarConfiguracionRecepcion(): Promise<void> {
    if (
      this.confirmarRecibirSeleccion === null ||
      this.confirmarRecibirSeleccion === undefined
    ) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Selecciona una opción',
        detail: 'Elige Sí o No antes de guardar.',
      });
      return;
    }

    this.guardandoConfiguracionRecepcion = true;

    try {
      const ok = await this.exhibicionesService.guardarConfiguracionRecepcion(
        this.confirmarRecibirSeleccion,
      );

      if (ok) {
        this.messageService.add({
          severity: 'success',
          summary: 'Configuración guardada',
          detail: `Confirmar recibir: ${this.confirmarRecibirSeleccion ? 'Sí' : 'No'}`,
        });
      } else {
        throw new Error();
      }
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo guardar la configuración.',
      });
    } finally {
      this.guardandoConfiguracionRecepcion = false;
    }
  }

  ngOnDestroy(): void {
    this.localesService.desregistrar();
    this.exhibicionesSub?.unsubscribe();
    this.localesSub?.unsubscribe();
  }
}
