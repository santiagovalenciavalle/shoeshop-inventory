import { Injectable, inject, signal, Injector } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from '@angular/fire/firestore';
import { Products } from '../../../pages/interfaces';

import { enContexto } from '../../../shared/utils/firestore-contexto';
export interface ConteoTalla {
  talla: number;
  esperado: number;
  contado: number | null;
}

export interface ProductoConteo {
  productoId: number;
  marca: string;
  referencia: string;
  imagen: string;
  fila: string;
  tallas: ConteoTalla[];
  completado: boolean;
}

export interface SesionBodega {
  id?: string;
  adminId: string;
  adminNombre: string;
  trabajadorId?: string;
  trabajadorNombre?: string;
  modoConteo: 'tallas' | 'cantidad';
  estado: 'esperando' | 'en_progreso' | 'finalizado';
  filaActual: string | null;
  filasAuditadas: string[];
  filasDisponibles?: string[];
  fechaInicio: Timestamp | null;
  fechaFin?: Timestamp | null;
  totalProductos: number;
  productosContados: number;
  finalizadoPor?: string;
  finalizadoPorNombre?: string;
  trabajadores?: {
    [trabajadorId: string]: {
      nombre: string;
      filas: string[];
      filaActual: string | null;
    };
  };
  conteos: {
    [productoId: number]: { [talla: number]: number } | { cantidad: number };
  };
}

export interface ItemReporte {
  productoId: number;
  zapatoId: number;
  marca: string;
  referencia: string;
  fila: string;
  talla: number;
  tallasDetalle?: {
    talla: number;
    esperado: number;
    contado: number;
    diferencia: number;
  }[];
  esperado: number;
  contado: number;
  diferencia: number;
  estado: 'correcto' | 'faltante' | 'sobrante';
}

export interface ReporteBodega {
  correctos: ItemReporte[];
  faltantes: ItemReporte[];
  sobrantes: ItemReporte[];
  totalProductosRevisados: number;
}

const SESSION_KEY = 'auditoria_bodega_sesion_id';

@Injectable({ providedIn: 'root' })
export class AuditoriaBodegaService {
  private readonly _inj = inject(Injector);

  readonly COL = 'auditorias_bodega';
  readonly PRODUCTOS_COL = 'productos';

  readonly firestore = inject(Firestore);

  sesionActiva = signal<SesionBodega | null>(null);
  sesionId = signal<string | null>(null);

  private unsubscribeSesion: (() => void) | null = null;

  guardarSesionLocal(id: string): void {
    try {
      localStorage.setItem(SESSION_KEY, id);
    } catch {}
  }

  leerSesionLocal(): string | null {
    try {
      return localStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  }

  limpiarSesionLocal(): void {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {}
  }

  private generarCodigo(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length)),
    ).join('');
  }

  async obtenerFilasOrdenadas(): Promise<string[]> {
    const snap = await getDocs(collection(this.firestore, this.PRODUCTOS_COL));
    const filasSet = new Set<string>();
    snap.docs.forEach((d) => {
      const fila = d.data()['fila'];
      if (fila != null && String(fila).trim() !== '') {
        filasSet.add(String(fila).trim());
      }
    });
    const filas = Array.from(filasSet);
    const numericas = filas
      .filter((f) => /^\d+$/.test(f))
      .sort((a, b) => Number(a) - Number(b));
    const alfanumericas = filas.filter((f) => !/^\d+$/.test(f)).sort();
    return [...numericas, ...alfanumericas];
  }

  async obtenerProductosPorFila(fila: string): Promise<Products[]> {
    const q = query(
      collection(this.firestore, this.PRODUCTOS_COL),
      where('fila', '==', fila),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: Number(d.id),
      ...(d.data() as Omit<Products, 'id'>),
    }));
  }

  async obtenerProductoPorId(id: number): Promise<Products | null> {
    const ref = doc(this.firestore, this.PRODUCTOS_COL, String(id));
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: Number(snap.id), ...(snap.data() as Omit<Products, 'id'>) };
  }

  async iniciarSesion(
    adminId: string,
    adminNombre: string,
    filas: string[],
    totalProductos: number,
    modoConteo: 'tallas' | 'cantidad',
  ): Promise<string> {
    const codigo = this.generarCodigo();
    const sesion = {
      adminId,
      adminNombre,
      modoConteo,
      estado: 'esperando',
      filaActual: null,
      filasDisponibles: filas,
      filasAuditadas: [],
      fechaInicio: null,
      totalProductos,
      productosContados: 0,
      conteos: {},
      trabajadores: {},
    };
    await setDoc(doc(this.firestore, this.COL, codigo), sesion);
    this.guardarSesionLocal(codigo);
    return codigo;
  }

  escucharSesion(id: string): void {
    if (this.unsubscribeSesion) {
      this.unsubscribeSesion();
      this.unsubscribeSesion = null;
    }
    this.sesionId.set(id);
    const ref = doc(this.firestore, this.COL, id);
    this.unsubscribeSesion = enContexto(this._inj, () => onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        this.sesionActiva.set({ id: snap.id, ...snap.data() } as SesionBodega);
      } else {
        this.sesionActiva.set(null);
        this.sesionId.set(null);
        this.limpiarSesionLocal();
      }
    }));
  }

  async escucharSesionYEsperar(id: string): Promise<SesionBodega | null> {
    this.escucharSesion(id);
    const snap = await getDoc(doc(this.firestore, this.COL, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as SesionBodega;
  }

  async buscarCualquierSesionActiva(): Promise<string | null> {
    const q = query(
      collection(this.firestore, this.COL),
      where('estado', 'in', ['esperando', 'en_progreso']),
    );
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0].id;
  }
  async unirseComoTrabajador(
    sesionId: string,
    trabajadorId: string,
    trabajadorNombre: string,
  ): Promise<boolean> {
    const ref = doc(this.firestore, this.COL, sesionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const data = snap.data() as any;
    if (data.estado === 'finalizado') return false;

    const trabajadores = { ...(data.trabajadores ?? {}) };

    if (trabajadores[trabajadorId]) {
      if (data.estado === 'esperando') {
        await updateDoc(ref, {
          estado: 'en_progreso',
          fechaInicio: serverTimestamp(),
        });
      }
      this.guardarSesionLocal(sesionId);
      return true;
    }

    trabajadores[trabajadorId] = {
      nombre: trabajadorNombre,
      filas: [],
      filaActual: null,
    };
    const updates: any = { trabajadores, trabajadorNombre };
    if (data.estado === 'esperando') {
      updates.estado = 'en_progreso';
      updates.fechaInicio = serverTimestamp();
    }
    await updateDoc(ref, updates);
    this.guardarSesionLocal(sesionId);
    return true;
  }

  async elegirFila(
    sesionId: string,
    fila: string,
    trabajadorId: string,
  ): Promise<boolean> {
    const ref = doc(this.firestore, this.COL, sesionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const data = snap.data() as any;
    const trabajadores = { ...(data.trabajadores ?? {}) };
    const filasAuditadas: string[] = data.filasAuditadas ?? [];

    const filaEnUso = Object.entries(trabajadores).some(
      ([tid, t]: any) => tid !== trabajadorId && t.filaActual === fila,
    );
    if (filaEnUso || filasAuditadas.includes(fila)) return false;

    trabajadores[trabajadorId] = {
      ...(trabajadores[trabajadorId] ?? { nombre: '', filas: [] }),
      filaActual: fila,
      filas: [...new Set([...(trabajadores[trabajadorId]?.filas ?? []), fila])],
    };

    await updateDoc(ref, {
      trabajadores,
      filaActual: fila,
      [`trabajadores.${trabajadorId}.filaActual`]: fila,
    });
    return true;
  }

  async registrarConteo(
    sesionId: string,
    productoId: number,
    conteoTallas: { [talla: number]: number } | { cantidad: number },
  ): Promise<void> {
    const ref = doc(this.firestore, this.COL, sesionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data() as SesionBodega;
    const conteosActuales: any = { ...(data.conteos ?? {}) };
    conteosActuales[productoId] = conteoTallas;
    const productosContados = Object.keys(conteosActuales).length;
    await updateDoc(ref, { conteos: conteosActuales, productosContados });
  }

  async actualizarFilaActual(
    sesionId: string,
    fila: string,
    trabajadorId?: string,
  ): Promise<void> {
    const ref = doc(this.firestore, this.COL, sesionId);
    const updates: any = { filaActual: fila || null };
    if (trabajadorId) {
      updates[`trabajadores.${trabajadorId}.filaActual`] = fila || null;
    }
    await updateDoc(ref, updates);
  }

  async marcarFilaAuditada(sesionId: string, fila: string): Promise<void> {
    const ref = doc(this.firestore, this.COL, sesionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data() as SesionBodega;
    const filasAuditadas = [...(data.filasAuditadas ?? [])];
    if (!filasAuditadas.includes(fila)) filasAuditadas.push(fila);
    await updateDoc(ref, { filasAuditadas });
  }

  async finalizarSesion(
    sesionId: string,
    trabajadorId: string,
    trabajadorNombre: string,
    todosProductos?: Products[],
  ): Promise<void> {
    const ref = doc(this.firestore, this.COL, sesionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data() as any;
    const conteosActuales: any = { ...(data.conteos ?? {}) };
    const modoConteo: 'tallas' | 'cantidad' = data.modoConteo ?? 'tallas';

    if (todosProductos) {
      for (const p of todosProductos) {
        // Solo rellenar si tiene stock > 0 en bodega
        const stockTotal = Object.values(p.tallasDisponibles ?? {}).reduce(
          (acc, v) => acc + (Number(v) || 0),
          0,
        );
        if (stockTotal === 0) continue;

        // Si ya fue contado, no sobreescribir
        if (conteosActuales[p.id] !== undefined) continue;

        // Rellenar con 0 porque tiene stock pero no fue contado
        if (modoConteo === 'cantidad') {
          conteosActuales[p.id] = { cantidad: 0 };
        } else {
          const tallas: any = {};
          for (const t of Object.keys(p.tallasDisponibles ?? {})) {
            tallas[Number(t)] = 0;
          }
          conteosActuales[p.id] = tallas;
        }
      }
    }

    await updateDoc(ref, {
      estado: 'finalizado',
      fechaFin: serverTimestamp(),
      finalizadoPor: trabajadorId,
      finalizadoPorNombre: trabajadorNombre,
      conteos: conteosActuales,
      productosContados: Object.keys(conteosActuales).length,
    });
    this.limpiarSesionLocal();
  }
  async eliminarSesion(sesionId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, this.COL, sesionId));
    this.sesionActiva.set(null);
    this.sesionId.set(null);
    this.limpiarSesionLocal();
  }

  async obtenerHistorial(): Promise<(SesionBodega & { id: string })[]> {
    try {
      const q = query(
        collection(this.firestore, this.COL),
        where('estado', '==', 'finalizado'),
        orderBy('fechaFin', 'desc'),
      );
      const snap = await getDocs(q);
      console.log('[Historial] docs encontrados:', snap.size);
      return snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as (SesionBodega & { id: string })[];
    } catch (err) {
      console.error('[Historial servicio] ERROR:', err);
      throw err;
    }
  }

  calcularReporte(
    productos: Products[],
    conteos: { [productoId: number]: any },
    modoConteo: 'tallas' | 'cantidad' = 'tallas',
  ): ReporteBodega {
    const reporte: ReporteBodega = {
      correctos: [],
      faltantes: [],
      sobrantes: [],
      totalProductosRevisados: 0,
    };

    // Normalizar claves a número para evitar mismatch string/number de Firestore
    const conteoNormalizado: { [id: number]: any } = {};
    for (const [k, v] of Object.entries(conteos ?? {})) {
      conteoNormalizado[Number(k)] = v;
    }

    for (const producto of productos) {
      const stockTotal = Object.values(producto.tallasDisponibles ?? {}).reduce(
        (acc, v) => acc + (Number(v) || 0),
        0,
      );
      if (stockTotal === 0) continue;

      const conteoProducto = conteoNormalizado[producto.id];
      reporte.totalProductosRevisados++;

      if (modoConteo === 'cantidad') {
        const esperadoTotal = stockTotal;
        const contado: number = conteoProducto?.cantidad ?? 0;
        const diferencia = contado - esperadoTotal;

        const base = {
          productoId: producto.id,
          zapatoId: producto.id,
          marca: producto.marca?.trim() ?? '',
          referencia: producto.referencia ?? '',
          fila: String(producto.fila ?? '—'),
          talla: 0,
        };

        if (diferencia === 0) {
          reporte.correctos.push({
            ...base,
            esperado: esperadoTotal,
            contado,
            diferencia: 0,
            estado: 'correcto',
          });
        } else if (diferencia > 0) {
          reporte.correctos.push({
            ...base,
            esperado: esperadoTotal,
            contado: esperadoTotal,
            diferencia: 0,
            estado: 'correcto',
          });
          reporte.sobrantes.push({
            ...base,
            esperado: 0,
            contado: diferencia,
            diferencia,
            estado: 'sobrante',
          });
        } else {
          reporte.faltantes.push({
            ...base,
            esperado: esperadoTotal,
            contado,
            diferencia,
            estado: 'faltante',
          });
        }
      } else {
        // Normalizar claves de tallas también (Firestore las guarda como strings)
        const conteoTallas: { [t: number]: number } = {};
        if (conteoProducto) {
          for (const [k, v] of Object.entries(conteoProducto)) {
            conteoTallas[Number(k)] = Number(v) || 0;
          }
        }

        const tallasDetalle: ItemReporte['tallasDetalle'] = [];
        let esperadoTotal = 0;
        let contadoTotal = 0;
        let estadoGlobal: 'correcto' | 'faltante' | 'sobrante' = 'correcto';

        for (const [tallaStr, esperado] of Object.entries(
          producto.tallasDisponibles ?? {},
        )) {
          const talla = Number(tallaStr);
          const esperadoNum = Number(esperado ?? 0);
          if (esperadoNum === 0) continue;

          const contado: number = conteoTallas[talla] ?? 0;
          const diferencia = contado - esperadoNum;

          esperadoTotal += esperadoNum;
          contadoTotal += contado;

          tallasDetalle.push({
            talla,
            esperado: esperadoNum,
            contado,
            diferencia,
          });

          if (diferencia < 0) estadoGlobal = 'faltante';
          else if (diferencia > 0 && estadoGlobal !== 'faltante')
            estadoGlobal = 'sobrante';
        }

        const diferenciaTotal = contadoTotal - esperadoTotal;

        const base: ItemReporte = {
          productoId: producto.id,
          zapatoId: producto.id,
          marca: producto.marca?.trim() ?? '',
          referencia: producto.referencia ?? '',
          fila: String(producto.fila ?? '—'),
          talla: 0,
          tallasDetalle,
          esperado: esperadoTotal,
          contado: contadoTotal,
          diferencia: diferenciaTotal,
          estado: estadoGlobal,
        };

        if (diferenciaTotal === 0) {
          reporte.correctos.push({ ...base, estado: 'correcto' });
        } else if (diferenciaTotal > 0) {
          reporte.correctos.push({
            ...base,
            contado: esperadoTotal,
            diferencia: 0,
            estado: 'correcto',
          });
          reporte.sobrantes.push({
            ...base,
            esperado: 0,
            contado: diferenciaTotal,
            diferencia: diferenciaTotal,
            estado: 'sobrante',
          });
        } else {
          reporte.faltantes.push({ ...base, estado: 'faltante' });
        }
      }
    }

    reporte.faltantes.sort((a, b) => a.diferencia - b.diferencia);
    reporte.sobrantes.sort((a, b) => b.diferencia - a.diferencia);
    return reporte;
  }

  async obtenerSesionPorId(sesionId: string): Promise<SesionBodega | null> {
    const snap = await getDoc(doc(this.firestore, this.COL, sesionId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as SesionBodega;
  }

  async getDocSnapshot(sesionId: string) {
    return getDoc(doc(this.firestore, this.COL, sesionId));
  }

  stopListening(): void {
    if (this.unsubscribeSesion) {
      this.unsubscribeSesion();
      this.unsubscribeSesion = null;
    }
    this.sesionActiva.set(null);
    this.sesionId.set(null);
  }
}
