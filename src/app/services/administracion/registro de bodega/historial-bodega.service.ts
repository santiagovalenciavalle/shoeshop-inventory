import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  deleteDoc,
  addDoc,
  doc,
  query,
  where,
  getDocs,
  orderBy,
} from '@angular/fire/firestore';
import { historial } from '../../../pages/interfaces';

@Injectable({
  providedIn: 'root',
})
export class HistorialBodegaService {
  private readonly COLLECTION_NAME = 'historial-bodega';

  constructor(private firestore: Firestore) {}

  private async ejecutarQuery(q: any): Promise<historial[]> {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<historial, 'id'>),
    }));
  }

  private ordenarPorFecha(items: historial[]): historial[] {
    return items.sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
    );
  }

  async obtenerPorFecha(fecha: Date): Promise<historial[]> {
    const inicio = new Date(fecha);
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(fecha);
    fin.setHours(23, 59, 59, 999);

    const ref = collection(this.firestore, this.COLLECTION_NAME);

    const q = query(
      ref,
      where('fecha', '>=', inicio.toISOString()),
      where('fecha', '<=', fin.toISOString()),
      orderBy('fecha', 'desc'),
    );

    return this.ejecutarQuery(q);
  }

  async obtenerPorMes(fecha: Date): Promise<historial[]> {
    const inicio = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);
    fin.setHours(23, 59, 59, 999);

    const ref = collection(this.firestore, this.COLLECTION_NAME);
    const q = query(
      ref,
      where('fecha', '>=', inicio.toISOString()),
      where('fecha', '<=', fin.toISOString()),
      orderBy('fecha', 'desc'),
    );

    return this.ejecutarQuery(q);
  }

  async obtenerPorCodigo(zapatoId: string): Promise<historial[]> {
    const ref = collection(this.firestore, this.COLLECTION_NAME);
    const comoNumero = Number(zapatoId);
    const esNumero = !isNaN(comoNumero) && zapatoId.trim() !== '';

    const queries: Promise<historial[]>[] = [
      this.ejecutarQuery(query(ref, where('zapatoId', '==', zapatoId))),
    ];

    if (esNumero) {
      queries.push(
        this.ejecutarQuery(query(ref, where('zapatoId', '==', comoNumero))),
      );
    }

    const resultados = await Promise.all(queries);

    const mapa = new Map<string, historial>();
    resultados.flat().forEach((item) => mapa.set(item.id, item));

    return this.ordenarPorFecha(Array.from(mapa.values()));
  }

  async obtenerPorMarca(marca: string): Promise<historial[]> {
    const ref = collection(this.firestore, this.COLLECTION_NAME);
    const texto = marca.toLowerCase();

    const q = query(
      ref,
      where('marca', '>=', texto),
      where('marca', '<=', texto + '\uf8ff'),
    );

    const items = await this.ejecutarQuery(q);
    return this.ordenarPorFecha(items);
  }

  async obtenerPorReferencia(referencia: string): Promise<historial[]> {
    const ref = collection(this.firestore, this.COLLECTION_NAME);
    const texto = referencia.toLowerCase();

    const q = query(
      ref,
      where('referencia', '>=', texto),
      where('referencia', '<=', texto + '\uf8ff'),
    );

    const items = await this.ejecutarQuery(q);
    return this.ordenarPorFecha(items);
  }

  async agregarHistorial(data: Omit<historial, 'id'>): Promise<void> {
    try {
      const ref = collection(this.firestore, this.COLLECTION_NAME);
      await addDoc(ref, data);
    } catch (err) {
      console.error('Error al agregar historial:', err);
      throw err;
    }
  }

  async eliminarHistorial(id: string): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error al eliminar historial:', error);
      throw error;
    }
  }
}
