import { Injectable, inject, Injector } from '@angular/core';
import { AvisoExhibicionLocal } from '../../../pages/interfaces';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  deleteDoc,
  DocumentReference,
} from '@angular/fire/firestore';

import { enContexto } from '../../../shared/utils/firestore-contexto';
@Injectable({
  providedIn: 'root',
})
export class AvisosLocalOrigenService {
  private readonly _inj = inject(Injector);

  private readonly COLLECTION_NAME = 'avisosExhibicionesLocal';

  private avisosSubject = new BehaviorSubject<AvisoExhibicionLocal[]>([]);
  avisos$ = this.avisosSubject.asObservable();

  constructor(private firestore: Firestore) {
    this.cargarDesdeFirestore();
  }

  private cargarDesdeFirestore(): void {
    const avisosCollection = collection(this.firestore, this.COLLECTION_NAME);
    enContexto(this._inj, () => collectionData(avisosCollection, { idField: 'id' })).subscribe({
      next: (data) => {
        this.avisosSubject.next(data as AvisoExhibicionLocal[]);
      },
      error: (error) => {
        console.error(
          'Error al cargar avisos de local origen desde Firestore:',
          error,
        );
      },
    });
  }

  obtenerAvisos(): Observable<AvisoExhibicionLocal[]> {
    return this.avisos$;
  }

  async agregarAviso(aviso: AvisoExhibicionLocal): Promise<DocumentReference> {
    const avisosCollection = collection(this.firestore, this.COLLECTION_NAME);
    try {
      return await addDoc(avisosCollection, aviso);
    } catch (error) {
      console.error(
        'Error al agregar aviso de local origen en Firestore:',
        error,
      );
      throw error;
    }
  }

  async eliminarAviso(id: string | number): Promise<void> {
    const avisoDocRef = doc(this.firestore, `${this.COLLECTION_NAME}/${id}`);
    try {
      await deleteDoc(avisoDocRef);
    } catch (error) {
      console.error(
        'Error al eliminar aviso de local origen en Firestore:',
        error,
      );
      throw error;
    }
  }
}
