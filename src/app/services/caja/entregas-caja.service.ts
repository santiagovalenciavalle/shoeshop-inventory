import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from '@angular/fire/firestore';

/**
 * Entrega de efectivo: lo que un vendedor le da al recolector habilitado por el admin.
 * El recolector solo escribe el monto recibido; nunca ve cuánto debía entregar.
 */
export interface EntregaCaja {
  id?: string;
  /** Día de la entrega (YYYY-MM-DD, hora local). */
  fecha: string;
  /** Misma clave que usa el cuadre del admin para unir con las ventas del vendedor. */
  clave: string;
  vendedorId: string | null;
  vendedor: string;
  monto: number;
  nota: string;
  recolectorId: string;
  recolector: string;
  creadoEn: Date;
  editadoEn?: Date | null;
  /** Montos anteriores si el recolector corrigió el registro (auditoría). */
  historial?: { monto: number; nota: string; en: Date }[];
  anulada?: boolean;
  anuladaEn?: Date | null;
}

/** Clave común vendedor ↔ ventas ↔ entregas. Debe coincidir con la del cuadre de caja. */
export function claveCajaVendedor(vendedorIdONombre: string): string {
  return (vendedorIdONombre || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60);
}

export function fechaLocalYmd(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const COLECCION = 'entregasCaja';

@Injectable({ providedIn: 'root' })
export class EntregasCajaService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);

  private aFecha(v: any): Date {
    return v?.toDate ? v.toDate() : v instanceof Date ? v : new Date(v);
  }

  private mapear(id: string, d: Record<string, any>): EntregaCaja {
    return {
      ...(d as EntregaCaja),
      id,
      creadoEn: this.aFecha(d['creadoEn']),
      editadoEn: d['editadoEn'] ? this.aFecha(d['editadoEn']) : null,
      anuladaEn: d['anuladaEn'] ? this.aFecha(d['anuladaEn']) : null,
      historial: (d['historial'] ?? []).map((h: any) => ({ ...h, en: this.aFecha(h.en) })),
    };
  }

  async crear(datos: {
    fecha: string;
    vendedorId: string | null;
    vendedor: string;
    monto: number;
    nota: string;
    recolectorId: string;
    recolector: string;
  }): Promise<void> {
    await runInInjectionContext(this.injector, () =>
      addDoc(collection(this.firestore, COLECCION), {
        ...datos,
        clave: claveCajaVendedor(datos.vendedorId || datos.vendedor),
        nota: datos.nota.trim(),
        creadoEn: new Date(),
        editadoEn: null,
        historial: [],
        anulada: false,
        anuladaEn: null,
      }),
    );
  }

  /** El recolector corrige su propio registro; se conserva el valor anterior. */
  async corregir(e: EntregaCaja, monto: number, nota: string): Promise<void> {
    const historial = [
      ...(e.historial ?? []),
      { monto: e.monto, nota: e.nota, en: e.editadoEn ?? e.creadoEn },
    ];
    await runInInjectionContext(this.injector, () =>
      updateDoc(doc(this.firestore, COLECCION, e.id!), {
        monto,
        nota: nota.trim(),
        editadoEn: new Date(),
        historial,
      }),
    );
  }

  /** No se borra: queda marcada como anulada para que el admin vea qué pasó. */
  async anular(e: EntregaCaja): Promise<void> {
    await runInInjectionContext(this.injector, () =>
      updateDoc(doc(this.firestore, COLECCION, e.id!), {
        anulada: true,
        anuladaEn: new Date(),
      }),
    );
  }

  /** Entregas que registró un recolector en una fecha (consulta que cumple las reglas). */
  async delRecolectorEnFecha(recolectorId: string, fecha: string): Promise<EntregaCaja[]> {
    const snap = await runInInjectionContext(this.injector, () =>
      getDocs(
        query(
          collection(this.firestore, COLECCION),
          where('recolectorId', '==', recolectorId),
          where('fecha', '==', fecha),
        ),
      ),
    );
    return snap.docs
      .map((d) => this.mapear(d.id, d.data()))
      .sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime());
  }

  /** Todas las entregas de un rango (solo admin). Incluye anuladas para mostrarlas. */
  async delRango(desde: string, hasta: string): Promise<EntregaCaja[]> {
    const snap = await runInInjectionContext(this.injector, () =>
      getDocs(
        query(
          collection(this.firestore, COLECCION),
          where('fecha', '>=', desde),
          where('fecha', '<=', hasta),
        ),
      ),
    );
    return snap.docs
      .map((d) => this.mapear(d.id, d.data()))
      .sort((a, b) => a.creadoEn.getTime() - b.creadoEn.getTime());
  }
}
