/** @format */

import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  runTransaction,
  query,
  where,
  updateDoc,
  deleteDoc,
} from '@angular/fire/firestore';
import { Observable, tap } from 'rxjs';
import {
  InventarioLocal,
  MovimientoInventario,
  Products,
} from '../../pages/interfaces';

export interface ItemDistribucion {
  talla: number;
  localId: string;
  localNombre: string;
  cantidad: number;
}

@Injectable({
  providedIn: 'root',
})
export class LocalesInventarioService {
  private readonly INVENTARIO_COLLECTION = 'inventarioLocales';
  private readonly MOVIMIENTOS_COLLECTION = 'movimientosInventario';

  constructor(
    private firestore: Firestore,
    private injector: Injector,
  ) {}

  private idInventarioLocal(productoId: number, localId: string): string {
    return `${productoId}_${localId}`;
  }

  getInventarioCompleto(): Observable<InventarioLocal[]> {
    return runInInjectionContext(this.injector, () => {
      const ref = collection(this.firestore, this.INVENTARIO_COLLECTION);

      return collectionData(ref, { idField: 'id' }).pipe(
        tap((data) => console.log('EMITIÓ', data.length, new Date())),
      ) as Observable<InventarioLocal[]>;
    });
  }

  async trasladarALocales(
    producto: Products,
    items: ItemDistribucion[],
    usuario: string,
  ): Promise<void> {
    const itemsValidos = items.filter((i) => i.cantidad > 0);
    if (itemsValidos.length === 0) {
      throw new Error('No hay cantidades para trasladar.');
    }

    const totalPorTalla: { [talla: number]: number } = {};
    for (const item of itemsValidos) {
      totalPorTalla[item.talla] =
        (totalPorTalla[item.talla] ?? 0) + item.cantidad;
    }

    const localesIds = Array.from(new Set(itemsValidos.map((i) => i.localId)));
    const productoRef = doc(this.firestore, 'productos', String(producto.id));
    const localRefs = localesIds.map((localId) => ({
      localId,
      ref: doc(
        this.firestore,
        this.INVENTARIO_COLLECTION,
        this.idInventarioLocal(producto.id, localId),
      ),
    }));

    await runInInjectionContext(this.injector, () =>
      runTransaction(this.firestore, async (transaction) => {
        const productoSnap = await transaction.get(productoRef);
        if (!productoSnap.exists()) {
          throw new Error('El producto ya no existe.');
        }

        const localSnaps = await Promise.all(
          localRefs.map(async (l) => ({
            localId: l.localId,
            ref: l.ref,
            snap: await transaction.get(l.ref),
          })),
        );

        const productoData = productoSnap.data() as Products;
        const tallasBodega = { ...(productoData.tallasDisponibles ?? {}) };

        for (const [tallaStr, cantidadRequerida] of Object.entries(
          totalPorTalla,
        )) {
          const talla = Number(tallaStr);
          const disponible = tallasBodega[talla] ?? 0;
          if (disponible < cantidadRequerida) {
            throw new Error(
              `No hay suficiente stock de la talla ${talla} en bodega (disponible: ${disponible}, solicitado: ${cantidadRequerida}).`,
            );
          }
        }

        for (const [tallaStr, cantidadRequerida] of Object.entries(
          totalPorTalla,
        )) {
          const talla = Number(tallaStr);
          tallasBodega[talla] -= cantidadRequerida;
          if (tallasBodega[talla] <= 0) delete tallasBodega[talla];
        }
        const nuevoStockBodega = Object.values(tallasBodega).reduce(
          (a, b) => a + b,
          0,
        );
        transaction.update(productoRef, {
          tallasDisponibles: tallasBodega,
          stock: nuevoStockBodega,
        });

        for (const { localId, ref, snap } of localSnaps) {
          const dataActual = snap.exists()
            ? (snap.data() as InventarioLocal)
            : null;
          const tallasLocal = { ...(dataActual?.tallasDisponibles ?? {}) };

          const itemsDeEsteLocal = itemsValidos.filter(
            (i) => i.localId === localId,
          );
          for (const item of itemsDeEsteLocal) {
            tallasLocal[item.talla] =
              (tallasLocal[item.talla] ?? 0) + item.cantidad;
          }

          const nuevoStockLocal = Object.values(tallasLocal).reduce(
            (a, b) => a + b,
            0,
          );
          const localNombre =
            itemsDeEsteLocal[0]?.localNombre ?? dataActual?.localNombre ?? '';

          const nuevoDoc: InventarioLocal = {
            productoId: producto.id,
            localId,
            localNombre,
            marca: producto.marca,
            referencia: producto.referencia,
            imagen: producto.imagen,
            tallasDisponibles: tallasLocal,
            stock: nuevoStockLocal,
            fechaActualizacion: new Date(),
          };

          transaction.set(ref, nuevoDoc);
        }

        for (const item of itemsValidos) {
          const movRef = doc(
            collection(this.firestore, this.MOVIMIENTOS_COLLECTION),
          );
          const movimiento: MovimientoInventario = {
            productoId: producto.id,
            marca: producto.marca,
            referencia: producto.referencia,
            talla: item.talla,
            cantidad: item.cantidad,
            tipo: 'envio',
            localId: item.localId,
            localNombre: item.localNombre,
            usuario,
            fecha: new Date(),
          };
          transaction.set(movRef, movimiento);
        }
      }),
    );
  }

  getInventarioPorProducto(productoId: number): Observable<InventarioLocal[]> {
    return runInInjectionContext(this.injector, () => {
      const ref = collection(this.firestore, this.INVENTARIO_COLLECTION);
      const q = query(ref, where('productoId', '==', productoId));
      return collectionData(q, { idField: 'id' }) as Observable<
        InventarioLocal[]
      >;
    });
  }

  async devolverABodega(
    producto: Products,
    items: ItemDistribucion[],
    usuario: string,
  ): Promise<void> {
    const itemsValidos = items.filter((i) => i.cantidad > 0);
    if (itemsValidos.length === 0) {
      throw new Error('No hay cantidades para devolver.');
    }

    const localesIds = Array.from(new Set(itemsValidos.map((i) => i.localId)));
    const productoRef = doc(this.firestore, 'productos', String(producto.id));
    const localRefs = localesIds.map((localId) => ({
      localId,
      ref: doc(
        this.firestore,
        this.INVENTARIO_COLLECTION,
        this.idInventarioLocal(producto.id, localId),
      ),
    }));

    await runInInjectionContext(this.injector, () =>
      runTransaction(this.firestore, async (transaction) => {
        const productoSnap = await transaction.get(productoRef);
        if (!productoSnap.exists()) {
          throw new Error('El producto ya no existe.');
        }

        const localSnaps = await Promise.all(
          localRefs.map(async (l) => ({
            localId: l.localId,
            ref: l.ref,
            snap: await transaction.get(l.ref),
          })),
        );

        for (const { localId, snap } of localSnaps) {
          const data = snap.exists() ? (snap.data() as InventarioLocal) : null;
          const tallasLocal = data?.tallasDisponibles ?? {};
          const itemsDeEsteLocal = itemsValidos.filter(
            (i) => i.localId === localId,
          );
          for (const item of itemsDeEsteLocal) {
            const disponible = tallasLocal[item.talla] ?? 0;
            if (disponible < item.cantidad) {
              throw new Error(
                `El local ${localId} no tiene suficiente stock de la talla ${item.talla} (disponible: ${disponible}, solicitado: ${item.cantidad}).`,
              );
            }
          }
        }

        const productoData = productoSnap.data() as Products;
        const tallasBodega = { ...(productoData.tallasDisponibles ?? {}) };
        for (const item of itemsValidos) {
          tallasBodega[item.talla] =
            (tallasBodega[item.talla] ?? 0) + item.cantidad;
        }
        const nuevoStockBodega = Object.values(tallasBodega).reduce(
          (a, b) => a + b,
          0,
        );
        transaction.update(productoRef, {
          tallasDisponibles: tallasBodega,
          stock: nuevoStockBodega,
        });

        for (const { localId, ref, snap } of localSnaps) {
          const data = snap.exists() ? (snap.data() as InventarioLocal) : null;
          const tallasLocal = { ...(data?.tallasDisponibles ?? {}) };
          const itemsDeEsteLocal = itemsValidos.filter(
            (i) => i.localId === localId,
          );
          for (const item of itemsDeEsteLocal) {
            tallasLocal[item.talla] -= item.cantidad;
            if (tallasLocal[item.talla] <= 0) delete tallasLocal[item.talla];
          }
          const nuevoStockLocal = Object.values(tallasLocal).reduce(
            (a, b) => a + b,
            0,
          );

          const docActualizado: InventarioLocal = {
            productoId: producto.id,
            localId,
            localNombre: data?.localNombre ?? '',
            marca: producto.marca,
            referencia: producto.referencia,
            imagen: producto.imagen,
            tallasDisponibles: tallasLocal,
            stock: nuevoStockLocal,
            fechaActualizacion: new Date(),
          };

          transaction.set(ref, docActualizado);
        }

        for (const item of itemsValidos) {
          const movRef = doc(
            collection(this.firestore, this.MOVIMIENTOS_COLLECTION),
          );
          const movimiento: MovimientoInventario = {
            productoId: producto.id,
            marca: producto.marca,
            referencia: producto.referencia,
            talla: item.talla,
            cantidad: item.cantidad,
            tipo: 'devolucion',
            localId: item.localId,
            localNombre: item.localNombre,
            usuario,
            fecha: new Date(),
          };
          transaction.set(movRef, movimiento);
        }
      }),
    );
  }

  async actualizarInventarioLocal(
    id: string,
    cambios: Partial<InventarioLocal>,
  ): Promise<void> {
    const ref = doc(this.firestore, this.INVENTARIO_COLLECTION, id);
    await runInInjectionContext(this.injector, () =>
      updateDoc(ref, cambios as any),
    );
  }

  async eliminarInventarioLocal(id: string): Promise<void> {
    const ref = doc(this.firestore, this.INVENTARIO_COLLECTION, id);
    await runInInjectionContext(this.injector, () => deleteDoc(ref));
  }
}
