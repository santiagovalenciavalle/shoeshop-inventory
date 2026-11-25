import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
} from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';
import { getDocs, where, query } from 'firebase/firestore';
import { ingresoTalla } from '../../../pages/interfaces';

@Injectable({
  providedIn: 'root',
})
export class RegistroIngresosService {
  private readonly COLLECTION_NAME = 'ingresosProductos';

  private ingresosSubject = new BehaviorSubject<ingresoTalla[]>([]);
  ingresos$ = this.ingresosSubject.asObservable();

  private isInitialized = false;
  private cargaEnCurso: Promise<void> | null = null;

  constructor(private firestore: Firestore) {}

  reiniciarListener(): void {
    // Solo se recarga si alguna pantalla ya los había pedido. Antes se leía la colección
    // completa en cada inicio de sesión aunque nadie usara el resultado.
    if (this.isInitialized) this.cargarIngresos(true);
  }

  async cargarIngresos(forceRefresh = false): Promise<void> {
    if (this.isInitialized && !forceRefresh) return;

    if (this.cargaEnCurso) {
      return this.cargaEnCurso;
    }

    this.cargaEnCurso = this._cargarDesdeFirestore();

    try {
      await this.cargaEnCurso;
    } finally {
      this.cargaEnCurso = null;
    }
  }

  private async _cargarDesdeFirestore(): Promise<void> {
    const ingresosCollection = collection(this.firestore, this.COLLECTION_NAME);
    const snapshot = await getDocs(ingresosCollection);
    const ingresos = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as ingresoTalla),
    }));
    this.ingresosSubject.next(ingresos);
    this.isInitialized = true;
  }

  async getIngresosProductos(): Promise<ingresoTalla[]> {
    const ingresosCollection = collection(this.firestore, this.COLLECTION_NAME);
    const snapshot = await getDocs(ingresosCollection);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as ingresoTalla),
    }));
  }

  /** Ingresos de una sola referencia (consulta filtrada, no la colección completa). */
  async getIngresosPorZapatoId(zapatoId: number | string): Promise<ingresoTalla[]> {
    const id = Number(zapatoId);
    const ref = collection(this.firestore, this.COLLECTION_NAME);
    const snapshot = await getDocs(query(ref, where('zapatoId', '==', id)));
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as ingresoTalla),
    }));
  }

  async nuevoIngresoProducto(ingreso: ingresoTalla): Promise<void> {
    const ingresosCollection = collection(this.firestore, this.COLLECTION_NAME);
    try {
      await addDoc(ingresosCollection, ingreso);
    } catch (error) {
      console.error('Error al agregar nuevo ingreso de producto:', error);
      throw error;
    }
  }

  async eliminarDocumentosPorZapatoId(
    zapatoId: number | string,
  ): Promise<void> {
    try {
      const zapatoIdNum =
        typeof zapatoId === 'string' ? parseInt(zapatoId, 10) : zapatoId;
      if (isNaN(zapatoIdNum)) {
        console.warn('zapatoId no es un número válido:', zapatoId);
        return;
      }
      const coleccionRef = collection(this.firestore, this.COLLECTION_NAME);
      const q = query(coleccionRef, where('zapatoId', '==', zapatoIdNum));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return;
      const deletePromises = querySnapshot.docs.map((docSnap) =>
        deleteDoc(doc(this.firestore, this.COLLECTION_NAME, docSnap.id)),
      );
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error al eliminar documentos:', error);
    }
  }
}
