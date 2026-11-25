import { Injectable, inject, Injector } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  DocumentReference,
} from '@angular/fire/firestore';
import { setDoc } from 'firebase/firestore';

import { enContexto } from '../../shared/utils/firestore-contexto';
export interface Local {
  id?: string;
  nombre: string;
  estado: 'Activo' | 'Inactivo';
  vendedor?: string;
}

@Injectable({
  providedIn: 'root',
})
export class LocalesService {
  private readonly _inj = inject(Injector);

  private readonly COLLECTION_NAME = 'locales';

  private localesSubject = new BehaviorSubject<Local[]>([]);
  locales$ = this.localesSubject.asObservable();
  private suscriptoresActivos = 0;

  registrar(): void {
    this.suscriptoresActivos++;
  }

  desregistrar(): void {
    this.suscriptoresActivos = Math.max(0, this.suscriptoresActivos - 1);
  }
  private suscripcion: Subscription | null = null;

  constructor(private firestore: Firestore) {}

  private cargarDesdeFirestore(): void {
    this.suscripcion?.unsubscribe();

    const localCollection = collection(this.firestore, this.COLLECTION_NAME);
    this.suscripcion = enContexto(this._inj, () => collectionData(localCollection, {
      idField: 'id',
    })).subscribe({
      next: (data) => this.localesSubject.next(data as Local[]),
      error: (error) => console.error('Error al cargar locales:', error),
    });
  }

  reiniciarListener(): void {
    this.cargarDesdeFirestore();
  }

  obtenerLocales(): Observable<Local[]> {
    return this.locales$;
  }

  async editarLocal(local: Local): Promise<void> {
    const localRef = doc(this.firestore, `locales/${local.id}`);
    try {
      await setDoc(localRef, local);
    } catch (error) {
      console.error('Error al actualizar local:', error);
      throw error;
    }
  }

  async agregarLocal(local: Local): Promise<DocumentReference> {
    const localCollection = collection(this.firestore, this.COLLECTION_NAME);
    try {
      return await addDoc(localCollection, local);
    } catch (error) {
      console.error('Error al agregar local en Firestore:', error);
      throw error;
    }
  }

  async eliminarLocal(id: string | number): Promise<void> {
    const localDocRef = doc(this.firestore, `${this.COLLECTION_NAME}/${id}`);
    try {
      await deleteDoc(localDocRef);
    } catch (error) {
      console.error('Error al eliminar local en Firestore:', error);
      throw error;
    }
  }

  async actualizarLocal(id: string, cambios: Partial<Local>): Promise<void> {
    const localDocRef = doc(this.firestore, `${this.COLLECTION_NAME}/${id}`);
    try {
      await updateDoc(localDocRef, cambios);
    } catch (error) {
      console.error('Error al actualizar local en Firestore:', error);
      throw error;
    }
  }
}
