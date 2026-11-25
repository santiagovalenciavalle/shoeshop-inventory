import { Injectable, inject, Injector } from '@angular/core';
import {
  addDoc,
  arrayUnion,
  collection,
  collectionData,
  deleteDoc,
  doc,
  docData,
  Firestore,
  updateDoc,
} from '@angular/fire/firestore';
import { Factura, Proveedor } from '../../../pages/interfaces';
import { Observable } from 'rxjs';

import { enContexto } from '../../../shared/utils/firestore-contexto';
@Injectable({
  providedIn: 'root',
})
export class ProveedoresService {
  private readonly _inj = inject(Injector);

  private readonly COLLECTION_NAME = 'proveedores';

  constructor(private firestore: Firestore) {}

  obtenerProveedores(): Observable<Proveedor[]> {
    const proveedoresRef = collection(this.firestore, this.COLLECTION_NAME);

    return enContexto(this._inj, () => collectionData(proveedoresRef, { idField: 'id' })) as Observable<
      Proveedor[]
    >;
  }

  obtenerProveedorPorId(id: string): Observable<Proveedor> {
    const proveedorDocRef = doc(this.firestore, this.COLLECTION_NAME, id);
    return enContexto(this._inj, () => docData(proveedorDocRef, { idField: 'id' })) as Observable<Proveedor>;
  }

  async agregarProveedor(data: Omit<Proveedor, 'id'>): Promise<void> {
    try {
      const proveedoresRef = collection(this.firestore, this.COLLECTION_NAME);
      await addDoc(proveedoresRef, data);
    } catch (error) {
      console.error('Error al agregar proveedor:', error);
      throw error;
    }
  }

  async agregarFacturaAProveedor(
    proveedorId: string,
    factura: Factura,
  ): Promise<void> {
    try {
      const proveedorDocRef = doc(
        this.firestore,
        this.COLLECTION_NAME,
        proveedorId,
      );

      await updateDoc(proveedorDocRef, {
        facturas: arrayUnion(factura),
      });
    } catch (error) {
      console.error('Error al agregar factura:', error);
      throw error;
    }
  }

  async actualizarFacturasProveedor(
    proveedorId: string,
    facturas: Factura[],
  ): Promise<void> {
    try {
      const proveedorDocRef = doc(
        this.firestore,
        this.COLLECTION_NAME,
        proveedorId,
      );

      await updateDoc(proveedorDocRef, {
        facturas: facturas,
      });
    } catch (error) {
      console.error('Error al actualizar facturas:', error);
      throw error;
    }
  }

  async eliminarProveedor(id: string): Promise<void> {
    try {
      const proveedorDocRef = doc(this.firestore, this.COLLECTION_NAME, id);

      await deleteDoc(proveedorDocRef);
    } catch (error) {
      console.error('Error al eliminar proveedor:', error);
      throw error;
    }
  }
}
