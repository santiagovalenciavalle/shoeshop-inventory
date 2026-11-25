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

import {
  AuditoriaBodegaService,
  ConteoTalla,
} from '../../../services/administracion/ia/auditoria-bodega.service';
import { AuthService } from '../../../services/auth/auth.service';
import { Products } from '../../../pages/interfaces';

import { IaSpinnerComponent } from '../../../shared/components/ia-loader/ia-spinner.component';
type VistaTrabajador = 'login' | 'elegir_fila' | 'contando' | 'finalizado';

@Component({
  selector: 'app-auditoria-bodega-trabajador',
  standalone: true,
  imports: [
    IaSpinnerComponent,CommonModule, FormsModule],
  templateUrl: './auditoria-trabajador-bodega.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditoriaBodegaTrabajadorComponent implements OnDestroy {
  private service = inject(AuditoriaBodegaService);
  private auth = inject(AuthService);

  trabajadorId = signal<string>('');
  vista = signal<VistaTrabajador>('login');
  codigoInput = signal('');
  uniendose = signal(false);
  errorCodigo = signal('');

  filasDisponibles = signal<string[]>([]);
  filaActualNombre = signal<string | null>(null);
  productosFilaActual = signal<Products[]>([]);
  productoIndex = signal(0);
  cargandoFila = signal(false);

  busquedaVisible = signal(false);
  busquedaId = signal('');
  busquedaProducto = signal<Products | null>(null);
  buscando = signal(false);
  errorBusqueda = signal('');

  modalAbierto = signal(false);
  productoActual = signal<Products | null>(null);
  conteoPorTalla = signal<{ [talla: number]: number }>({});
  cantidadSimple = signal<number>(0);
  guardando = signal(false);
  conteoGuardado = signal(false);
  esEdicion = signal(false);

  confirmarFin = signal(false);
  finalizando = signal(false);
  totalContado = signal(0);

  sesion = this.service.sesionActiva;
  sesionId = this.service.sesionId;

  modoConteo = computed<'tallas' | 'cantidad'>(
    () => this.sesion()?.modoConteo ?? 'tallas',
  );

  esPrimerProducto = computed(() => this.productoIndex() === 0);
  esUltimoProducto = computed(
    () => this.productoIndex() === this.productosFilaActual().length - 1,
  );
  productoActualIndex = computed(() => this.productoIndex() + 1);
  totalProductosFila = computed(() => this.productosFilaActual().length);

  filasAuditadas = computed<string[]>(
    () => this.sesion()?.filasAuditadas ?? [],
  );

  filasEnUso = computed<{ [fila: string]: string }>(() => {
    const s = this.sesion();
    if (!s?.trabajadores) return {};
    const mapa: { [fila: string]: string } = {};
    for (const [tid, t] of Object.entries(s.trabajadores)) {
      if (tid !== this.trabajadorId() && t.filaActual) {
        mapa[t.filaActual] = t.nombre;
      }
    }
    return mapa;
  });

  filasLibres = computed(() =>
    this.filasDisponibles().filter((f) => !this.filasAuditadas().includes(f)),
  );

  tallasProducto = computed<ConteoTalla[]>(() => {
    const p = this.productoActual();
    if (!p) return [];
    return Object.entries(p.tallasDisponibles ?? {})
      .map(([t]) => ({
        talla: Number(t),
        esperado: 0,
        contado: this.conteoPorTalla()[Number(t)] ?? 0,
      }))
      .sort((a, b) => a.talla - b.talla);
  });

  conteoCompleto = computed(() => {
    if (this.modoConteo() === 'cantidad') return true;
    return this.tallasProducto().every((t) => t.contado !== null);
  });

  progresoPorcentaje = computed(() => {
    const s = this.sesion();
    if (!s?.totalProductos) return 0;
    return Math.round((this.totalContado() / s.totalProductos) * 100);
  });

  companeros = computed(() => {
    const s = this.sesion();
    if (!s?.trabajadores) return [];
    return Object.entries(s.trabajadores)
      .filter(([tid]) => tid !== this.trabajadorId())
      .map(([, t]) => t);
  });

  constructor() {
    effect(() => {
      const s = this.sesion();
      if (!s) return;
      if (s.estado === 'finalizado') {
        this.vista.set('finalizado');

        this.cerrarModal();
        this.limpiarEstadoLocal();
        this.service.limpiarSesionLocal();
      }
    });

    this.intentarRecuperarSesion();
  }

  private async intentarRecuperarSesion(): Promise<void> {
    const savedId = this.service.leerSesionLocal();
    if (!savedId) return;

    const user = this.auth.getCurrentUser();
    if (!user?.id) return;

    try {
      const sesionData = await this.service.escucharSesionYEsperar(savedId);
      if (!sesionData || sesionData.estado === 'finalizado') {
        this.service.limpiarSesionLocal();
        return;
      }

      this.trabajadorId.set(user.id);
      const filasConStock = await this.filtrarFilasConStock(
        (sesionData as any).filasDisponibles ?? [],
      );
      this.filasDisponibles.set(filasConStock);
      const miData = sesionData.trabajadores?.[user.id];
      if (miData?.filaActual) {
        this.filaActualNombre.set(miData.filaActual);
        await this.cargarProductosFila(miData.filaActual);
        this.restaurarEstadoLocal(savedId);
        this.vista.set('contando');
        this.abrirModalProducto(this.productoIndex());
      } else {
        this.restaurarEstadoLocal(savedId);
        this.vista.set('elegir_fila');
      }
    } catch (e) {
      console.warn('[Trabajador] No se pudo recuperar sesión:', e);
    }
  }

  private guardarEstadoLocal(): void {
    const id = this.sesionId();
    if (!id) return;
    localStorage.setItem(
      `auditoria_estado_${id}`,
      JSON.stringify({
        productoIndex: this.productoIndex(),
        totalContado: this.totalContado(),
        filaActualNombre: this.filaActualNombre(),
      }),
    );
  }

  private restaurarEstadoLocal(id: string): void {
    const raw = localStorage.getItem(`auditoria_estado_${id}`);
    if (!raw) return;
    try {
      const estado = JSON.parse(raw);
      if (estado.totalContado != null)
        this.totalContado.set(estado.totalContado);
      if (estado.productoIndex != null)
        this.productoIndex.set(estado.productoIndex);
      if (estado.filaActualNombre != null)
        this.filaActualNombre.set(estado.filaActualNombre);
    } catch {}
  }

  private limpiarEstadoLocal(): void {
    const id = this.sesionId();
    if (id) localStorage.removeItem(`auditoria_estado_${id}`);
  }

  async unirse(): Promise<void> {
    const codigo = this.codigoInput().trim().toUpperCase();
    if (!codigo) return;

    this.uniendose.set(true);
    this.errorCodigo.set('');

    try {
      const user = this.auth.getCurrentUser();
      const ok = await this.service.unirseComoTrabajador(
        codigo,
        user?.id ?? '',
        user?.name ?? 'Trabajador',
      );

      if (!ok) {
        this.errorCodigo.set('Código no válido o sesión finalizada.');
        this.uniendose.set(false);
        return;
      }

      const sesionData = await this.service.escucharSesionYEsperar(codigo);
      if (!sesionData) {
        this.errorCodigo.set('No se pudo obtener la sesión.');
        this.uniendose.set(false);
        return;
      }

      this.trabajadorId.set(user?.id ?? '');
      this.filasDisponibles.set((sesionData as any).filasDisponibles ?? []);

      const miData = sesionData.trabajadores?.[user?.id ?? ''];
      if (miData?.filaActual) {
        await this.cargarProductosFila(miData.filaActual);
        this.filaActualNombre.set(miData.filaActual);
        this.vista.set('contando');
      } else {
        this.vista.set('elegir_fila');
      }
    } catch (e) {
      console.error('[Trabajador] Error unirse:', e);
      this.errorCodigo.set('No se pudo conectar. Intenta de nuevo.');
    }

    this.uniendose.set(false);
  }

  async elegirFila(fila: string): Promise<void> {
    const id = this.sesionId();
    if (!id) return;

    const ok = await this.service.elegirFila(id, fila, this.trabajadorId());
    if (!ok) return;

    this.filaActualNombre.set(fila);
    await this.cargarProductosFila(fila);
    this.vista.set('contando');
    this.abrirModalProducto(0);
  }

  private async cargarProductosFila(fila: string): Promise<void> {
    this.cargandoFila.set(true);
    const id = this.sesionId();
    if (id)
      await this.service.actualizarFilaActual(id, fila, this.trabajadorId());

    const prods = await this.service.obtenerProductosPorFila(fila);
    prods.sort((a, b) => a.id - b.id);

    const filtrados = prods.filter((p) => {
      const vals = Object.values(p.tallasDisponibles ?? {});
      return vals.length === 0 || vals.some((v: any) => (v ?? 0) > 0);
    });

    this.productosFilaActual.set(filtrados);
    this.productoIndex.set(0);
    this.cargandoFila.set(false);
  }

  abrirModalProducto(index: number, edicion = false): void {
    const prods = this.productosFilaActual();
    if (index < 0 || index >= prods.length) return;

    const prod = prods[index];
    this.productoActual.set(prod);
    this.productoIndex.set(index);
    this.esEdicion.set(edicion);

    if (this.modoConteo() === 'cantidad') {
      const previo = this.sesion()?.conteos?.[prod.id] as any;
      this.cantidadSimple.set(previo?.cantidad ?? 0);
    } else {
      const previo = this.sesion()?.conteos?.[prod.id] as any;
      const init: { [t: number]: number } = {};
      Object.keys(prod.tallasDisponibles ?? {}).forEach((t) => {
        init[Number(t)] = previo?.[Number(t)] ?? 0;
      });
      this.conteoPorTalla.set(init);
    }

    this.conteoGuardado.set(false);
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalAbierto.set(false);
    this.busquedaVisible.set(false);
    this.busquedaProducto.set(null);
    this.busquedaId.set('');
    this.errorBusqueda.set('');
  }

  actualizarConteoTalla(talla: number, valor: string): void {
    const n = Math.max(0, parseInt(valor, 10) || 0);
    this.conteoPorTalla.update((c) => ({ ...c, [talla]: n }));
  }

  incrementarTalla(talla: number): void {
    this.conteoPorTalla.update((c) => ({ ...c, [talla]: (c[talla] ?? 0) + 1 }));
  }

  decrementarTalla(talla: number): void {
    this.conteoPorTalla.update((c) => ({
      ...c,
      [talla]: Math.max(0, (c[talla] ?? 0) - 1),
    }));
  }

  incrementarCantidad(): void {
    this.cantidadSimple.update((n) => n + 1);
  }
  decrementarCantidad(): void {
    this.cantidadSimple.update((n) => Math.max(0, n - 1));
  }
  actualizarCantidad(valor: string): void {
    this.cantidadSimple.set(Math.max(0, parseInt(valor, 10) || 0));
  }

  private async filtrarFilasConStock(filas: string[]): Promise<string[]> {
    const filasConStock: string[] = [];
    for (const fila of filas) {
      const prods = await this.service.obtenerProductosPorFila(fila);
      const tieneStock = prods.some((p) => {
        const stock = Object.values(p.tallasDisponibles ?? {}).reduce(
          (acc, v) => acc + (Number(v) || 0),
          0,
        );
        return stock > 0;
      });
      if (tieneStock) filasConStock.push(fila);
    }
    return filasConStock;
  }

  async guardarConteo(): Promise<void> {
    const p = this.productoActual();
    const id = this.sesionId();
    if (!p || !id) return;

    this.guardando.set(true);

    let conteo: any;
    if (this.modoConteo() === 'cantidad') {
      conteo = { cantidad: this.cantidadSimple() };
    } else {
      conteo = {};
      Object.entries(this.conteoPorTalla()).forEach(([t, v]) => {
        conteo[Number(t)] = v ?? 0;
      });
    }

    await this.service.registrarConteo(id, p.id, conteo);

    if (!this.esEdicion()) this.totalContado.update((n) => n + 1);
    this.conteoGuardado.set(true);
    this.guardando.set(false);
    this.guardarEstadoLocal();
    if (!this.esEdicion()) {
      setTimeout(() => this.avanzar(), 800);
    } else {
      setTimeout(() => this.cerrarModal(), 800);
    }
  }

  async avanzar(): Promise<void> {
    const prods = this.productosFilaActual();
    const idx = this.productoIndex();

    if (idx < prods.length - 1) {
      this.abrirModalProducto(idx + 1);
      this.guardarEstadoLocal();
    } else {
      this.cerrarModal();
      const id = this.sesionId();
      if (id) {
        await this.service.marcarFilaAuditada(id, this.filaActualNombre()!);
        await this.service.actualizarFilaActual(id, '', this.trabajadorId());
      }
      this.filaActualNombre.set(null);
      this.guardarEstadoLocal();
      this.vista.set('elegir_fila');
    }
  }

  async buscarProducto(): Promise<void> {
    const idStr = this.busquedaId().trim();
    if (!idStr) return;
    this.buscando.set(true);
    this.errorBusqueda.set('');
    this.busquedaProducto.set(null);

    const prod = await this.service.obtenerProductoPorId(Number(idStr));
    if (!prod) {
      this.errorBusqueda.set('Producto no encontrado.');
    } else {
      this.busquedaProducto.set(prod);
    }
    this.buscando.set(false);
  }

  abrirModalBusqueda(): void {
    const p = this.busquedaProducto();
    if (!p) return;

    const prods = this.productosFilaActual();
    const existe = prods.find((x) => x.id === p.id);
    if (!existe) {
      this.productosFilaActual.update((arr) => [...arr, p]);
    }

    const idx = this.productosFilaActual().findIndex((x) => x.id === p.id);
    this.busquedaVisible.set(false);
    this.busquedaProducto.set(null);
    this.busquedaId.set('');
    this.abrirModalProducto(idx);
  }

  async finalizar(): Promise<void> {
    const id = this.sesionId();
    if (!id) return;
    this.finalizando.set(true);

    try {
      const user = this.auth.getCurrentUser();
      const allProds: Products[] = [];
      for (const fila of this.filasDisponibles()) {
        const prods = await this.service.obtenerProductosPorFila(fila);
        allProds.push(...prods);
      }

      await this.service.finalizarSesion(
        id,
        user?.id ?? '',
        user?.name ?? 'Trabajador',
        allProds,
      );
      this.vista.set('finalizado');
      this.limpiarEstadoLocal();
    } catch (e) {
      console.error('[Trabajador] Error finalizar:', e);
    }

    this.finalizando.set(false);
    this.confirmarFin.set(false);
  }

  trackByTalla = (_: number, t: ConteoTalla) => t.talla;

  ngOnDestroy(): void {
    this.service.stopListening();
  }
}
