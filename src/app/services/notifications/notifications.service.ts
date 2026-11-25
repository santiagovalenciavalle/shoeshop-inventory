import { Injectable, inject, Injector } from '@angular/core';
import { Notification } from '../../pages/interfaces';
import { BehaviorSubject, Observable, defer } from 'rxjs';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  deleteDoc,
  DocumentReference,
  limit,
  orderBy,
  query,
  Timestamp,
} from '@angular/fire/firestore';

import { enContexto } from '../../shared/utils/firestore-contexto';
@Injectable({
  providedIn: 'root',
})
export class NotificationsService {
  private readonly _inj = inject(Injector);

  private readonly COLLECTION_NAME = 'notifications';

  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  private escuchando = false;

  /**
   * La escucha empieza cuando alguien se suscribe (una pantalla que muestra notificaciones),
   * no al crear el servicio. Antes arrancaba siempre, incluso en el catálogo público sin sesión,
   * donde Firestore la rechazaba por permisos.
   */
  notifications$: Observable<Notification[]> = defer(() => {
    this.cargarDesdeFirestore();
    return this.notificationsSubject.asObservable();
  });

  constructor(private firestore: Firestore) {}

  private cargarDesdeFirestore(): void {
    if (this.escuchando) return;
    this.escuchando = true;
    const notiCollection = collection(this.firestore, this.COLLECTION_NAME);
    // Solo las 100 más recientes (antes se escuchaba la colección completa, que nunca se limpiaba).
    // `creadaEn` se estampa al crear; las anteriores se marcan una vez con
    // functions/estampar-notifications.js
    const recientes = query(
      notiCollection,
      orderBy('creadaEn', 'desc'),
      limit(100),
    );
    enContexto(this._inj, () => collectionData(recientes, { idField: 'id' })).subscribe({
      next: (data) => {
        this.notificationsSubject.next(data as Notification[]);
      },
      error: (error) => {
        // Se permite reintentar en la próxima suscripción (p. ej. tras iniciar sesión)
        this.escuchando = false;
        console.error('Error al cargar notificaciones desde Firestore:', error);
      },
    });
  }

  obtenerNotificaciones(): Observable<Notification[]> {
    return this.notifications$;
  }

  async agregarNotificacion(noti: Notification): Promise<DocumentReference> {
    const notiCollection = collection(this.firestore, this.COLLECTION_NAME);
    try {
      return await addDoc(notiCollection, { ...noti, creadaEn: Timestamp.now() });
    } catch (error) {
      console.error('Error al agregar notificación en Firestore:', error);
      throw error;
    }
  }

  async eliminarNotificacion(id: string | number): Promise<void> {
    const notiDocRef = doc(this.firestore, `${this.COLLECTION_NAME}/${id}`);
    try {
      await deleteDoc(notiDocRef);
    } catch (error) {
      console.error('Error al eliminar notificación en Firestore:', error);
      throw error;
    }
  }
}
