import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  where,
  limit,
  deleteDoc,
  doc,
} from '@angular/fire/firestore';

export interface NominaEmpleado {
  id: string;
  nombre: string;
  rol: 'bodega' | 'vendedor' | 'patinador';
  diasTrabajados: number;
  pagoDiario: number;
  mediosDias?: number;
  comisionActiva?: boolean;
  base: number;
  zapatosVendidos?: number;
  comisionPorZapato?: number;
  comisionTotal?: number;
  total: number;
}

export interface NominaGuardada {
  categoria: 'nomina';
  semana: string;
  fechaInicio: Timestamp;
  fechaFin: Timestamp;
  fechaGuardado: Timestamp;
  empleados: NominaEmpleado[];
  config: {
    pagoDiarioBodega: number;
    pagoDiarioVendedor: number;
    pagoDiarioPatinador: number;
    comisionPorZapato: number;
  };
  totales: {
    base: number;
    comisiones: number;
    total: number;
    totalEmpleados: number;
  };
}

export interface NominaGuardadaConId extends NominaGuardada {
  docId: string;
}

@Injectable({ providedIn: 'root' })
export class NominaGuardadoService {
  private firestore = inject(Firestore);

  async guardarNomina(
    data: Omit<NominaGuardada, 'fechaGuardado'>,
  ): Promise<string> {
    const col = collection(this.firestore, 'nominas');
    const doc = await addDoc(col, {
      ...data,
      fechaGuardado: Timestamp.now(),
    });
    return doc.id;
  }

  async obtenerNominaPorSemana(
    inicio: Date,
    fin: Date,
  ): Promise<NominaGuardadaConId | null> {
    const q = query(
      collection(this.firestore, 'nominas'),
      where('fechaInicio', '>=', Timestamp.fromDate(inicio)),
      where('fechaInicio', '<=', Timestamp.fromDate(fin)),
      orderBy('fechaInicio', 'desc'),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { docId: d.id, ...(d.data() as any) };
  }

  async eliminarNomina(docId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'nominas', docId));
  }

  async obtenerNominas(): Promise<NominaGuardadaConId[]> {
    const col = collection(this.firestore, 'nominas');
    const q = query(col, orderBy('fechaGuardado', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      docId: d.id,
      ...(d.data() as NominaGuardada),
    }));
  }
}
