import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  collectionData,
  query,
  where,
  orderBy,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { HistorialLocal } from '../../../pages/interfaces';

@Injectable({ providedIn: 'root' })
export class HistorialLocalesService {
  private readonly COLLECTION = 'historialLocales';

  constructor(
    private firestore: Firestore,
    private injector: Injector,
  ) {}

  async agregarHistorial(datos: Omit<HistorialLocal, 'id'>): Promise<void> {
    await runInInjectionContext(this.injector, async () => {
      const ref = collection(this.firestore, this.COLLECTION);
      await addDoc(ref, datos);
    });
  }

  obtenerHistorialPorZapatoId(zapatoId: number): Observable<HistorialLocal[]> {
    return runInInjectionContext(this.injector, () => {
      const ref = collection(this.firestore, this.COLLECTION);
      const q = query(
        ref,
        where('zapatoId', '==', zapatoId),
        orderBy('fecha', 'desc'),
      );
      return collectionData(q, { idField: 'id' }) as Observable<
        HistorialLocal[]
      >;
    });
  }

  obtenerHistorialPorRangoFecha(
    fechaInicioISO: string,
    fechaFinISO: string,
  ): Observable<HistorialLocal[]> {
    return runInInjectionContext(this.injector, () => {
      const ref = collection(this.firestore, this.COLLECTION);
      const q = query(
        ref,
        where('fecha', '>=', fechaInicioISO),
        where('fecha', '<=', fechaFinISO),
        orderBy('fecha', 'desc'),
      );
      return collectionData(q, { idField: 'id' }) as Observable<
        HistorialLocal[]
      >;
    });
  }
}
