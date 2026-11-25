import { Injectable, inject, Injector } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Bono, Products } from '../../../pages/interfaces';
import { collectionData, Firestore } from '@angular/fire/firestore';
import { collection, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { AuthService } from '../../auth/auth.service';

import { enContexto } from '../../../shared/utils/firestore-contexto';
@Injectable({
  providedIn: 'root',
})
export class BonosService {
  private readonly _inj = inject(Injector);

  private readonly COLLECTION_NAME = 'bonos';

  private bonosSubject = new BehaviorSubject<Bono[]>([]);
  bonos$ = this.bonosSubject.asObservable();
  private zapatosDevueltosSubject = new BehaviorSubject<Products[]>([]);
  zapatosDevueltos$ = this.zapatosDevueltosSubject.asObservable();

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
  ) {
    this.cargarBonos();
  }

  private cargarBonos(): void {
    const bonosCollection = collection(this.firestore, this.COLLECTION_NAME);
    enContexto(this._inj, () => collectionData(bonosCollection, { idField: 'id' })).subscribe({
      next: (data) => {
        this.bonosSubject.next(data as Bono[]);
      },
      error: (error) => {
        console.error('Error al cargar bonos desde Firestore:', error);
      },
    });
  }

  async buscarBonoPorId(id: string): Promise<Bono | null> {
    try {
      const bonoRef = doc(this.firestore, this.COLLECTION_NAME, id);
      const bonoSnap = await getDoc(bonoRef);

      if (bonoSnap.exists()) {
        return { id, ...bonoSnap.data() } as Bono;
      } else {
        console.warn(`No se encontró ningún bono con el ID: ${id}`);
        return null;
      }
    } catch (error) {
      console.error('Error al buscar bono por ID:', error);
      return null;
    }
  }

  getBonos() {
    return this.bonos$;
  }

  async agregarBono(bono: Bono): Promise<void> {
    try {
      const usuario = this.authService.getCurrentUser();
      if (!usuario || !usuario.id) {
        throw new Error('Usuario no autenticado o sin ID');
      }
      bono.vendedorId = usuario.id;

      const bonoRef = doc(this.firestore, this.COLLECTION_NAME, bono.id);

      await setDoc(bonoRef, bono);
    } catch (error) {
      console.error('Error al agregar bono:', error);
    }
  }

  async borrarBono(id: string): Promise<void> {
    try {
      const bonoRef = doc(this.firestore, this.COLLECTION_NAME, id);
      await deleteDoc(bonoRef);
    } catch (error) {
      console.error('Error al borrar bono:', error);
    }
  }
}
