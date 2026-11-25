import { Injectable, inject, Injector } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  Firestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  getDocs,
  getDoc,
  orderBy,
  limit,
  Timestamp,
  increment,
  runTransaction,
  arrayUnion,
} from '@angular/fire/firestore';
import { deleteDoc } from 'firebase/firestore';

import { enContexto } from '../../../shared/utils/firestore-contexto';
export type AuditoriaEstado = 'pendiente' | 'en_progreso' | 'finalizado';

export interface EsperadoItem {
  zapatoId: string;
  marca: string;
  referencia: string;
  count: number;
}

export interface SesionAuditoria {
  id?: string;
  localNombre: string;
  localId: string;
  estado: AuditoriaEstado;
  fechaInicio?: any;
  fechaFin?: any;
  adminId?: string;
  adminNombre?: string;
  vendedorNombre?: string;

  conteo: { [zapatoId: string]: number };
  totalEscaneos: number;
  recientes: { id: string; ts: number }[];
  totalEsperados: number;

  esperados?: EsperadoItem[];

  resultado?: ResultadoAuditoria;
}

export interface ResultadoAuditoria {
  ok: { zapatoId: string; marca: string; referencia: string; count: number }[];
  faltantes: {
    zapatoId: string;
    marca: string;
    referencia: string;
    count: number;
  }[];
  sobrantes: { zapatoId: string; count: number }[];
  totalEsperados: number;
}

export interface FiltrosHistorial {
  localNombre?: string;
  vendedorNombre?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
}

const RECIENTES_MAX = 50;

@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private readonly _inj = inject(Injector);

  private readonly COLLECTION = 'sesiones_auditoria';

  private sesionActivaSubject = new BehaviorSubject<SesionAuditoria | null>(
    null,
  );
  sesionActiva$ = this.sesionActivaSubject.asObservable();

  private unsubscribe: (() => void) | null = null;

  constructor(private firestore: Firestore) {}

  async buscarSesionActivaDeAdmin(adminId: string): Promise<string | null> {
    const col = collection(this.firestore, this.COLLECTION);
    const q = query(
      col,
      where('adminId', '==', adminId),
      where('estado', '==', 'en_progreso'),
      orderBy('fechaInicio', 'desc'),
      limit(1),
    );
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0].id;
  }

  async buscarAuditoriasPasadas(
    filtros: FiltrosHistorial = {},
  ): Promise<SesionAuditoria[]> {
    const col = collection(this.firestore, this.COLLECTION);
    const constraints: any[] = [
      where('estado', '==', 'finalizado'),
      orderBy('fechaFin', 'desc'),
      limit(200),
    ];
    if (filtros.fechaDesde) {
      constraints.splice(
        1,
        0,
        where('fechaFin', '>=', Timestamp.fromDate(filtros.fechaDesde)),
      );
    }
    if (filtros.fechaHasta) {
      const hasta = new Date(filtros.fechaHasta);
      hasta.setHours(23, 59, 59, 999);
      constraints.splice(
        filtros.fechaDesde ? 2 : 1,
        0,
        where('fechaFin', '<=', Timestamp.fromDate(hasta)),
      );
    }
    const q = query(col, ...constraints);
    const snap = await getDocs(q);
    // El resultado de cada sesión ya viene guardado (calculado al finalizar).
    // NO se recalcula aquí bajo ninguna circunstancia.
    let docs = snap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as SesionAuditoria,
    );

    if (filtros.localNombre?.trim()) {
      const term = filtros.localNombre.trim().toLowerCase();
      docs = docs.filter(
        (d) =>
          d.localNombre?.toLowerCase().includes(term) ||
          d.localNombre?.replace(/[^0-9]/g, '').includes(term),
      );
    }
    if (filtros.vendedorNombre?.trim()) {
      const term = filtros.vendedorNombre.trim().toLowerCase();
      docs = docs.filter((d) => d.vendedorNombre?.toLowerCase().includes(term));
    }
    return docs;
  }

  private construirEsperados(
    exhibiciones: { zapatoId: string; marca: string; referencia: string }[],
  ): EsperadoItem[] {
    const map = new Map<string, EsperadoItem>();
    for (const ex of exhibiciones) {
      const key = String(ex.zapatoId).trim();
      if (map.has(key)) {
        map.get(key)!.count++;
      } else {
        map.set(key, {
          zapatoId: key,
          marca: ex.marca,
          referencia: ex.referencia,
          count: 1,
        });
      }
    }
    return Array.from(map.values());
  }

  async iniciarSesion(
    localNombre: string,
    localId: string,
    exhibicionesDelLocal: {
      zapatoId: string;
      marca: string;
      referencia: string;
    }[],
    adminId?: string,
    adminNombre?: string,
  ): Promise<string> {
    const esperados = this.construirEsperados(exhibicionesDelLocal);
    const totalEsperados = esperados.reduce((acc, i) => acc + i.count, 0);

    const sesionRef = doc(collection(this.firestore, this.COLLECTION));
    const sesion: SesionAuditoria = {
      localNombre,
      localId,
      estado: 'en_progreso',
      fechaInicio: serverTimestamp(),
      adminId,
      adminNombre,
      conteo: {},
      totalEscaneos: 0,
      recientes: [],
      totalEsperados,
      esperados,
    };
    await setDoc(sesionRef, sesion);
    return sesionRef.id;
  }

  escucharSesion(sesionId: string): void {
    if (this.unsubscribe) this.unsubscribe();
    const ref = doc(this.firestore, this.COLLECTION, sesionId);
    this.unsubscribe = enContexto(this._inj, () => onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        this.sesionActivaSubject.next({
          id: snap.id,
          ...snap.data(),
        } as SesionAuditoria);
      } else {
        this.sesionActivaSubject.next(null);
      }
    }));
  }

  async registrarVendedor(
    sesionId: string,
    vendedorNombre: string,
  ): Promise<void> {
    const ref = doc(this.firestore, this.COLLECTION, sesionId);
    await updateDoc(ref, { vendedorNombre });
  }

  async registrarEscaneosBatch(
    sesionId: string,
    nuevosIds: string[],
  ): Promise<void> {
    if (!nuevosIds.length) return;

    const idsNormalizados = nuevosIds.map((id) => String(id).trim());
    const ref = doc(this.firestore, this.COLLECTION, sesionId);

    const conteoLocal: Record<string, number> = {};
    for (const id of idsNormalizados) {
      conteoLocal[id] = (conteoLocal[id] ?? 0) + 1;
    }

    const updates: Record<string, any> = {};
    for (const [id, n] of Object.entries(conteoLocal)) {
      updates[`conteo.${id}`] = increment(n);
    }
    updates['totalEscaneos'] = increment(idsNormalizados.length);

    const ahora = Date.now();
    const nuevos = idsNormalizados.map((id) => ({ id, ts: ahora }));
    updates['recientes'] = arrayUnion(...nuevos);

    await updateDoc(ref, updates);

    // Recorte seguro de "recientes": lee el estado REAL del servidor
    // dentro de una transacción, en vez de confiar en el estado local
    // (que puede estar desactualizado y causar pérdida de datos).
    await runTransaction(this.firestore, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const data = snap.data() as SesionAuditoria;
      const recientes = data.recientes ?? [];
      if (recientes.length > RECIENTES_MAX * 2) {
        const recortados = [...recientes]
          .sort((a, b) => b.ts - a.ts)
          .slice(0, RECIENTES_MAX);
        tx.update(ref, { recientes: recortados });
      }
    });
  }

  async finalizarSesion(sesionId: string): Promise<void> {
    const ref = doc(this.firestore, this.COLLECTION, sesionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const data = snap.data() as SesionAuditoria;
    const resultado = this.calcularResultado(
      data.conteo ?? {},
      data.esperados ?? [],
    );

    await updateDoc(ref, {
      estado: 'finalizado',
      fechaFin: serverTimestamp(),
      resultado,
    });
  }

  async eliminarSesion(sesionId: string): Promise<void> {
    const ref = doc(this.firestore, this.COLLECTION, sesionId);
    await deleteDoc(ref);
    this.sesionActivaSubject.next(null);
  }

  getSesionActual(): SesionAuditoria | null {
    return this.sesionActivaSubject.getValue();
  }

  stopListening(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.sesionActivaSubject.next(null);
  }

  calcularResultado(
    conteo: { [zapatoId: string]: number } | null | undefined,
    esperados: EsperadoItem[],
  ): ResultadoAuditoria {
    const conteoRaw = conteo ?? {};
    const conteoSesion: { [key: string]: number } = {};
    for (const [k, v] of Object.entries(conteoRaw)) {
      conteoSesion[String(k).trim()] = v;
    }

    const ok: ResultadoAuditoria['ok'] = [];
    const faltantes: ResultadoAuditoria['faltantes'] = [];
    const sobrantes: ResultadoAuditoria['sobrantes'] = [];
    const esperadoIds = new Set(esperados.map((e) => e.zapatoId));

    let totalEsperados = 0;

    for (const info of esperados) {
      totalEsperados += info.count;
      const scanned = conteoSesion[info.zapatoId] ?? 0;

      if (scanned >= info.count) {
        ok.push({
          zapatoId: info.zapatoId,
          marca: info.marca,
          referencia: info.referencia,
          count: info.count,
        });
        if (scanned > info.count) {
          sobrantes.push({
            zapatoId: info.zapatoId,
            count: scanned - info.count,
          });
        }
      } else {
        faltantes.push({
          zapatoId: info.zapatoId,
          marca: info.marca,
          referencia: info.referencia,
          count: info.count - scanned,
        });
      }
    }

    for (const [zapatoId, count] of Object.entries(conteoSesion)) {
      if (!esperadoIds.has(zapatoId)) sobrantes.push({ zapatoId, count });
    }

    return { ok, faltantes, sobrantes, totalEsperados };
  }
}
