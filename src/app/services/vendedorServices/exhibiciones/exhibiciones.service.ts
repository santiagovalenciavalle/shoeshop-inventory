import { Injectable, inject, Injector } from '@angular/core';
import { Observable, BehaviorSubject, from } from 'rxjs';
import {
  Firestore,
  collection,
  doc,
  deleteDoc,
  getDocs,
  addDoc,
  query,
  orderBy,
  setDoc,
  writeBatch,
} from '@angular/fire/firestore';
import { exhibiciones } from '../../../pages/interfaces';
import {
  getDoc,
  updateDoc,
  where,
  onSnapshot,
  getAggregateFromServer,
  sum,
} from 'firebase/firestore';

import { enContexto } from '../../../shared/utils/firestore-contexto';
@Injectable({
  providedIn: 'root',
})
export class ExhibicionesService {
  private readonly _inj = inject(Injector);

  private readonly COLLECTION_NAME = 'exhibiciones';
  private readonly CONFIGURACION_COLLECTION = 'configuracion';
  private readonly CONFIGURACION_RECEPCION_DOC = 'recepcion';

  private exhibicionesSubject = new BehaviorSubject<exhibiciones[]>([]);
  exhibiciones$ = this.exhibicionesSubject.asObservable();

  private isInitialized = false;
  private cargaEnCurso: Promise<void> | null = null;

  // NUEVO: un único listener para TODA la colección (antes: 1 por documento).
  private unsubscribeColeccion: (() => void) | null = null;

  constructor(private firestore: Firestore) {}

  async cargarTodasExhibiciones(forceRefresh = false): Promise<void> {
    if (this.isInitialized && !forceRefresh) {
      return;
    }

    if (this.cargaEnCurso) {
      return this.cargaEnCurso;
    }

    this.cargaEnCurso = this._suscribirColeccion();

    try {
      await this.cargaEnCurso;
    } finally {
      this.cargaEnCurso = null;
    }
  }

  /**
   * UN solo listener en tiempo real sobre toda la colección.
   * - Primera emisión: trae todos los documentos (misma cantidad de
   *   lecturas que antes tenía el getDocs inicial, eso no cambia).
   * - Emisiones siguientes: solo trae los cambios via docChanges()
   *   (added/modified/removed). Un alta, edición o devolución en
   *   cualquier parte de la app cuesta 1 lectura para este listener,
   *   no una relectura completa de 1.000 documentos.
   * Total de listeners abiertos: 1 (antes: hasta 1.001).
   */
  private _suscribirColeccion(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.unsubscribeColeccion) {
        this.unsubscribeColeccion();
        this.unsubscribeColeccion = null;
      }

      const exhibicionesRef = collection(this.firestore, this.COLLECTION_NAME);
      const q = query(exhibicionesRef, orderBy('zapatoId', 'desc'));

      let primeraCarga = true;

      this.unsubscribeColeccion = enContexto(this._inj, () => onSnapshot(
        q,
        (snapshot) => {
          if (primeraCarga) {
            const datos = snapshot.docs.map(
              (d) =>
                ({
                  id: d.id,
                  ...(d.data() as Omit<exhibiciones, 'id'>),
                }) as exhibiciones,
            );
            this.exhibicionesSubject.next(datos);
            this.isInitialized = true;
            primeraCarga = false;
            resolve();
            return;
          }

          const actuales = [...this.exhibicionesSubject.getValue()];

          for (const change of snapshot.docChanges()) {
            const item = {
              id: change.doc.id,
              ...(change.doc.data() as Omit<exhibiciones, 'id'>),
            } as exhibiciones;

            const index = actuales.findIndex((e) => String(e.id) === item.id);

            if (change.type === 'removed') {
              if (index >= 0) actuales.splice(index, 1);
            } else if (index >= 0) {
              actuales[index] = item;
            } else {
              actuales.unshift(item);
            }
          }

          this.exhibicionesSubject.next(actuales);
        },
        (error) => {
          console.error('Error en listener de exhibiciones:', error);
          reject(error);
        },
      ));
    });
  }

  async migrarOrigenLocalATodas(): Promise<{
    total: number;
    actualizados: number;
  }> {
    const exhibicionesRef = collection(this.firestore, this.COLLECTION_NAME);
    const snapshot = await getDocs(exhibicionesRef);

    const docs = snapshot.docs;
    const total = docs.length;
    let actualizados = 0;

    const TAMANO_BATCH = 450;

    for (let i = 0; i < docs.length; i += TAMANO_BATCH) {
      const chunk = docs.slice(i, i + TAMANO_BATCH);
      const batch = writeBatch(this.firestore);

      for (const docSnap of chunk) {
        batch.update(docSnap.ref, { origenLocal: true });
      }

      await batch.commit();
      actualizados += chunk.length;
    }

    return { total, actualizados };
  }

  cerrarListener(): void {
    if (this.unsubscribeColeccion) {
      this.unsubscribeColeccion();
      this.unsubscribeColeccion = null;
    }
    this.isInitialized = false;
  }

  async refrescar(): Promise<void> {
    await this.cargarTodasExhibiciones(true);
  }

  getExhibicionesPorZapato$(zapatoId: string): Observable<exhibiciones[]> {
    const ref = collection(this.firestore, this.COLLECTION_NAME);
    const q = query(ref, where('zapatoId', '==', String(zapatoId)));
    return from(this.ejecutarQueryUnaVez(q));
  }

  getExhibiciones$(): Observable<exhibiciones[]> {
    return this.exhibiciones$;
  }

  getSnapshot(): exhibiciones[] {
    return this.exhibicionesSubject.getValue();
  }

  async obtenerExhibicionesUnaVez(): Promise<exhibiciones[]> {
    await this.cargarTodasExhibiciones();
    return this.exhibicionesSubject.getValue();
  }

  private async ejecutarQueryUnaVez(q: any): Promise<exhibiciones[]> {
    const snapshot = await getDocs(q);
    return snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...(doc.data() as Omit<exhibiciones, 'id'>),
        }) as exhibiciones,
    );
  }

  async agregarExhibicion(nuevaExhibicion: exhibiciones): Promise<boolean> {
    try {
      const exhibicionesRef = collection(this.firestore, this.COLLECTION_NAME);
      const docRef = await addDoc(exhibicionesRef, nuevaExhibicion);

      const exhibicionCompleta = {
        ...nuevaExhibicion,
        id: docRef.id,
      } as exhibiciones;

      const actuales = this.exhibicionesSubject.getValue();
      this.exhibicionesSubject.next([exhibicionCompleta, ...actuales]);

      return true;
    } catch (error) {
      console.error('Error al agregar la exhibición:', error);
      return false;
    }
  }

  async obtenerExhibicionesPorZapatoId(
    zapatoId: any,
  ): Promise<Omit<exhibiciones, 'imagen'>[]> {
    try {
      const ref = collection(this.firestore, this.COLLECTION_NAME);
      const zapatoIdStr = String(zapatoId);
      const q = query(ref, where('zapatoId', '==', zapatoIdStr));
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => {
        const { imagen, ...resto } = doc.data() as exhibiciones;
        return { ...resto, id: doc.id };
      });
    } catch (error) {
      console.error('Error al obtener las exhibiciones por zapatoId:', error);
      return [];
    }
  }

  async eliminarExhibicionPorId(id: string): Promise<boolean> {
    try {
      const exhibicionRef = doc(
        this.firestore,
        this.COLLECTION_NAME,
        String(id),
      );
      await deleteDoc(exhibicionRef);

      return true;
    } catch (error) {
      console.error('Error al eliminar la exhibición:', error);
      return false;
    }
  }

  private limpiarUndefined<T extends object>(obj: T): Partial<T> {
    const limpio: Partial<T> = {};
    for (const key of Object.keys(obj) as (keyof T)[]) {
      if (obj[key] !== undefined) {
        limpio[key] = obj[key];
      }
    }
    return limpio;
  }

  async actualizarExhibicion(
    exhibicionActualizada: exhibiciones,
  ): Promise<boolean> {
    try {
      const exhibicionRef = doc(
        this.firestore,
        this.COLLECTION_NAME,
        String(exhibicionActualizada.id),
      );

      const datosLimpios = this.limpiarUndefined(exhibicionActualizada);
      await updateDoc(exhibicionRef, datosLimpios);
      return true;
    } catch (error) {
      console.error('Error al actualizar la exhibición:', error);
      return false;
    }
  }

  reset(): void {
    this.cerrarListener();
    this.exhibicionesSubject.next([]);
    this.cargaEnCurso = null;
  }

  reiniciarListener(): void {
    this.cargarTodasExhibiciones(true);
  }

  getExhibicionesPorFuera$(): Observable<exhibiciones[]> {
    const ref = collection(this.firestore, this.COLLECTION_NAME);
    const q = query(ref, where('porFuera', '==', true));
    return from(this.ejecutarQueryUnaVez(q));
  }

  async existeExhibicion(pedidoId: string): Promise<boolean> {
    const pedidoRef = doc(
      this.firestore,
      `${this.COLLECTION_NAME}/${pedidoId}`,
    );
    const snap = await getDoc(pedidoRef);
    return snap.exists();
  }

  async guardarConfiguracionRecepcion(recibir: boolean): Promise<boolean> {
    try {
      const configRef = doc(
        this.firestore,
        this.CONFIGURACION_COLLECTION,
        this.CONFIGURACION_RECEPCION_DOC,
      );
      await setDoc(configRef, {
        recibir,
        actualizadoEn: new Date(),
      });
      return true;
    } catch (error) {
      console.error('Error al guardar la configuración de recepción:', error);
      return false;
    }
  }

  async obtenerConfiguracionRecepcion(): Promise<boolean | null> {
    try {
      const configRef = doc(
        this.firestore,
        this.CONFIGURACION_COLLECTION,
        this.CONFIGURACION_RECEPCION_DOC,
      );
      const snap = await getDoc(configRef);
      if (!snap.exists()) return null;
      const data = snap.data() as { recibir?: boolean };
      return data.recibir ?? null;
    } catch (error) {
      console.error('Error al obtener la configuración de recepción:', error);
      return null;
    }
  }

  async obtenerCapitalTotalExhibiciones(): Promise<number> {
    try {
      const ref = collection(this.firestore, this.COLLECTION_NAME);
      const snapshot = await enContexto(this._inj, () => getAggregateFromServer(ref, {
        capital: sum('precioAdquisicion'),
      }));
      return snapshot.data().capital ?? 0;
    } catch (error) {
      console.error('Error al calcular el capital de exhibiciones:', error);
      return 0;
    }
  }
}
