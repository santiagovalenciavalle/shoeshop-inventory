import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';

export interface Gasto {
  id?: string;
  nombre: string;
  categoria: string;
  monto: number;
  fecha: string;
  nota?: string;
  creadoEn?: Timestamp;
}

export const CATEGORIAS_GASTO = [
  { id: 'arriendo', label: 'Arriendo', emoji: '🏠' },
  { id: 'servicios', label: 'Servicios', emoji: '💡' },
  { id: 'nomina', label: 'Nómina', emoji: '👥' },
  { id: 'inventario', label: 'Inventario', emoji: '📦' },
  { id: 'transporte', label: 'Transporte', emoji: '🚚' },
  { id: 'marketing', label: 'Marketing', emoji: '📢' },
  { id: 'mantenimiento', label: 'Mantenimiento', emoji: '🔧' },
  { id: 'impuestos', label: 'Impuestos', emoji: '🏛️' },
  { id: 'seguros', label: 'Seguros', emoji: '🛡️' },
  { id: 'tecnologia', label: 'Tecnología', emoji: '💻' },
  { id: 'alimentacion', label: 'Alimentación', emoji: '🍽️' },
  { id: 'papeleria', label: 'Papelería', emoji: '📄' },
  { id: 'otro', label: 'Otro', emoji: '📌' },
];

@Injectable({ providedIn: 'root' })
export class GastosService {
  private firestore = inject(Firestore);

  private _gastos$ = new BehaviorSubject<Gasto[]>([]);
  gastos$ = this._gastos$.asObservable();

  private _cargando$ = new BehaviorSubject<boolean>(false);
  cargando$ = this._cargando$.asObservable();

  async cargarGastosPorMes(anio: number, mes: number): Promise<void> {
    this._cargando$.next(true);
    try {
      const inicio = new Date(anio, mes, 1);
      const fin = new Date(anio, mes + 1, 0, 23, 59, 59, 999);
      const q = query(
        collection(this.firestore, 'gastos'),
        where('creadoEn', '>=', Timestamp.fromDate(inicio)),
        where('creadoEn', '<=', Timestamp.fromDate(fin)),
        orderBy('creadoEn', 'desc'),
      );
      const snap = await getDocs(q);
      this._gastos$.next(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Gasto, 'id'>),
        })),
      );
    } finally {
      this._cargando$.next(false);
    }
  }

  async agregar(gasto: Omit<Gasto, 'id' | 'creadoEn'>): Promise<void> {
    const fechaDate = new Date(gasto.fecha + 'T00:00:00');
    await addDoc(collection(this.firestore, 'gastos'), {
      ...gasto,
      creadoEn: Timestamp.fromDate(fechaDate),
    });
  }

  async editar(
    id: string,
    gasto: Omit<Gasto, 'id' | 'creadoEn'>,
  ): Promise<void> {
    const fechaDate = new Date(gasto.fecha + 'T00:00:00');
    await updateDoc(doc(this.firestore, 'gastos', id), {
      ...gasto,
      creadoEn: Timestamp.fromDate(fechaDate),
    });
  }

  async eliminar(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'gastos', id));
  }

  getCategoriaInfo(id: string) {
    return (
      CATEGORIAS_GASTO.find((c) => c.id === id) ?? {
        id,
        label: id,
        emoji: '📌',
      }
    );
  }
}
