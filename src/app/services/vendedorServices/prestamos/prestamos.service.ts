import { Injectable, inject, Injector } from '@angular/core';
import { Prestamo } from '../../../pages/interfaces';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  deleteDoc,
  writeBatch,
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service';

import { enContexto } from '../../../shared/utils/firestore-contexto';
@Injectable({
  providedIn: 'root',
})
export class PrestamosService {
  private readonly _inj = inject(Injector);

  private readonly COLLECTION_NAME = 'prestamos';

  private prestamosSubject = new BehaviorSubject<Prestamo[]>([]);
  prestamos$ = this.prestamosSubject.asObservable();

  private suscripcion: Subscription | null = null;

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
  ) {}

  private suscriptoresActivos = 0;

  registrar(): void {
    this.suscriptoresActivos++;
  }

  desregistrar(): void {
    this.suscriptoresActivos = Math.max(0, this.suscriptoresActivos - 1);
  }

  private cargarDesdeFirestore(): void {
    this.suscripcion?.unsubscribe();

    const prestamosRef = collection(this.firestore, this.COLLECTION_NAME);
    this.suscripcion = enContexto(this._inj, () => collectionData(prestamosRef, {
      idField: 'id',
    })).subscribe({
      next: (data) => this.prestamosSubject.next(data as Prestamo[]),
      error: (error) => console.error('Error al cargar préstamos:', error),
    });
  }

  reiniciarListener(): void {
    this.cargarDesdeFirestore();
  }

  getPrestamos$(): Observable<Prestamo[]> {
    return this.prestamos$;
  }

  getPrestamosPorVendedor$(id: string): Observable<Prestamo[]> {
    return this.prestamos$.pipe(
      map((prestamos) => prestamos.filter((p) => p.vendedorId === id)),
    );
  }

  async agregarPrestamoYEliminarPedido(
    prestamo: Prestamo,
    pedidoId: string,
  ): Promise<boolean> {
    try {
      const usuario = this.authService.getCurrentUser();
      if (!usuario || !usuario.id) {
        console.error('No hay usuario autenticado');
        return false;
      }

      const zapatoIdNumber = Number(prestamo.zapatoId);
      if (isNaN(zapatoIdNumber)) {
        console.error('zapatoId no es un número válido:', prestamo.zapatoId);
        return false;
      }

      const prestamoConUsuario = {
        ...prestamo,
        zapatoId: zapatoIdNumber,
        vendedorId: usuario.id,
      };

      const batch = writeBatch(this.firestore);

      const prestamoRef = doc(collection(this.firestore, this.COLLECTION_NAME));
      batch.set(prestamoRef, prestamoConUsuario);

      const pedidoRef = doc(this.firestore, 'pedidos', pedidoId);
      batch.delete(pedidoRef);

      await batch.commit();
      return true;
    } catch (e) {
      console.error('Batch préstamo falló:', e);
      return false;
    }
  }

  async agregarPrestamo(prestamo: Prestamo): Promise<boolean> {
    try {
      const usuario = this.authService.getCurrentUser();
      if (!usuario?.id) {
        console.error('No hay usuario autenticado');
        return false;
      }

      const zapatoIdNumber = Number(prestamo.zapatoId);
      if (isNaN(zapatoIdNumber)) {
        console.error('zapatoId no es un número válido:', prestamo.zapatoId);
        return false;
      }

      const ref = collection(this.firestore, this.COLLECTION_NAME);
      await addDoc(ref, {
        ...prestamo,
        zapatoId: zapatoIdNumber,
        vendedorId: usuario.id,
      });

      return true;
    } catch (e) {
      console.error('Error al agregar préstamo:', e);
      return false;
    }
  }

  async eliminarPrestamo(id: string): Promise<void> {
    const prestamoDocRef = doc(this.firestore, `${this.COLLECTION_NAME}/${id}`);
    await deleteDoc(prestamoDocRef);
  }
}
