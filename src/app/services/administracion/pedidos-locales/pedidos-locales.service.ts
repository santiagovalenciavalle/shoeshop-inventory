import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  updateDoc,
  runTransaction,
  query,
  where,
  deleteDoc,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { PedidoLocal } from '../../../pages/interfaces';

@Injectable({ providedIn: 'root' })
export class PedidosLocalesService {
  private readonly PEDIDOS_COLLECTION = 'pedidosDeLocales';
  private readonly INVENTARIO_COLLECTION = 'inventarioLocales';
  private readonly EXHIBICIONES_COLLECTION = 'exhibiciones';
  private readonly AVISOS_COLLECTION = 'avisosExhibicionesLocal';
  private readonly METADATA_COLLECTION = 'metadata';
  private readonly METADATA_DOC_EXHIBICIONES = 'exhibiciones';

  constructor(
    private firestore: Firestore,
    private injector: Injector,
  ) {}

  getPedidosPorSolicitante(userId: string): Observable<PedidoLocal[]> {
    return runInInjectionContext(this.injector, () => {
      const ref = collection(this.firestore, this.PEDIDOS_COLLECTION);
      const q = query(ref, where('solicitadoPorId', '==', userId));
      return collectionData(q, { idField: 'id' }) as Observable<PedidoLocal[]>;
    });
  }

  getPedidosPorLocal(codigoLocal: string): Observable<PedidoLocal[]> {
    return runInInjectionContext(this.injector, () => {
      const ref = collection(this.firestore, this.PEDIDOS_COLLECTION);
      const q = query(ref, where('localOrigenNombre', '==', codigoLocal));
      return collectionData(q, { idField: 'id' }) as Observable<PedidoLocal[]>;
    });
  }

  getPedidosPorProductoYLocal(
    productoId: number,
    localId: string,
  ): Observable<PedidoLocal[]> {
    return runInInjectionContext(this.injector, () => {
      const ref = collection(this.firestore, this.PEDIDOS_COLLECTION);
      const q = query(
        ref,
        where('productoId', '==', productoId),
        where('localOrigenId', '==', localId),
      );
      return collectionData(q, { idField: 'id' }) as Observable<PedidoLocal[]>;
    });
  }

  async solicitar(
    datos: Omit<PedidoLocal, 'id' | 'estado' | 'porFuera' | 'fechaSolicitud'>,
  ): Promise<void> {
    await runInInjectionContext(this.injector, async () => {
      const ref = collection(this.firestore, this.PEDIDOS_COLLECTION);
      await addDoc(ref, {
        ...datos,
        estado: 'solicitado',
        porFuera: true,
        fechaSolicitud: new Date(),
      });
    });
  }

  async aceptarSolicitud(
    pedido: PedidoLocal,
    aceptadoPorNombre: string,
    aceptadoPorId: string,
  ): Promise<void> {
    const pedidoRef = doc(this.firestore, this.PEDIDOS_COLLECTION, pedido.id!);
    const inventarioId = `${pedido.productoId}_${pedido.localOrigenId}`;
    const inventarioRef = doc(
      this.firestore,
      this.INVENTARIO_COLLECTION,
      inventarioId,
    );

    await runInInjectionContext(this.injector, () =>
      runTransaction(this.firestore, async (transaction) => {
        const invSnap = await transaction.get(inventarioRef);
        if (!invSnap.exists()) {
          throw new Error('No se encontró el inventario del local.');
        }

        const data = invSnap.data() as any;
        const tallas = { ...(data.tallasDisponibles ?? {}) };
        const disponible = tallas[pedido.talla] ?? 0;

        if (disponible < 1) {
          throw new Error('Ya no hay stock disponible de esta talla.');
        }

        tallas[pedido.talla] = disponible - 1;
        if (tallas[pedido.talla] <= 0) delete tallas[pedido.talla];

        const nuevoStock = Object.values(tallas).reduce(
          (a: number, b) => a + (b as number),
          0,
        );

        transaction.update(inventarioRef, {
          tallasDisponibles: tallas,
          stock: nuevoStock,
        });

        transaction.update(pedidoRef, {
          estado: 'aceptado',
          aceptadoPorNombre,
          aceptadoPorId,
          fechaAceptacion: new Date(),
        });
      }),
    );
  }

  async eliminarPedidoLocal(id: string): Promise<void> {
    const ref = doc(this.firestore, this.PEDIDOS_COLLECTION, id);
    await runInInjectionContext(this.injector, () => deleteDoc(ref));
  }

  async crearPedidoDevuelto(datos: {
    productoId: number;
    talla: number;
    marca: string;
    referencia: string;
    imagen: string;
    localOrigenId: string;
    localOrigenNombre: string;
    devueltoPorNombre: string;
    devueltoPorId: string;
    productoDevueltoId: string;
    tipoDevolucion: 'cambio' | 'bono';
  }): Promise<void> {
    await runInInjectionContext(this.injector, async () => {
      const ref = collection(this.firestore, this.PEDIDOS_COLLECTION);
      await addDoc(ref, {
        productoId: datos.productoId,
        talla: datos.talla,
        marca: datos.marca,
        referencia: datos.referencia,
        imagen: datos.imagen,
        localOrigenId: datos.localOrigenId,
        localOrigenNombre: datos.localOrigenNombre,
        estado: 'devuelto',
        porFuera: true,
        solicitadoPorNombre: datos.devueltoPorNombre,
        solicitadoPorId: datos.devueltoPorId,
        localSolicitanteId: datos.localOrigenNombre,
        fechaSolicitud: new Date(),
        devueltoPorNombre: datos.devueltoPorNombre,
        devueltoPorId: datos.devueltoPorId,
        fechaDevolucion: new Date(),
        tipoDevolucion: datos.tipoDevolucion,
        productoDevueltoId: datos.productoDevueltoId,
      });
    });
  }

  async descontarStock(
    productoId: number,
    localId: string,
    talla: number,
  ): Promise<void> {
    const inventarioId = `${productoId}_${localId}`;
    const inventarioRef = doc(
      this.firestore,
      this.INVENTARIO_COLLECTION,
      inventarioId,
    );

    await runInInjectionContext(this.injector, () =>
      runTransaction(this.firestore, async (transaction) => {
        const invSnap = await transaction.get(inventarioRef);
        if (!invSnap.exists()) {
          throw new Error('No se encontró el inventario del local.');
        }

        const data = invSnap.data() as any;
        const tallas = { ...(data.tallasDisponibles ?? {}) };
        const disponible = tallas[talla] ?? 0;

        if (disponible < 1) {
          throw new Error('Ya no hay stock disponible de esta talla.');
        }

        tallas[talla] = disponible - 1;
        if (tallas[talla] <= 0) delete tallas[talla];

        const nuevoStock = Object.values(tallas).reduce(
          (a: number, b) => a + (b as number),
          0,
        );

        transaction.update(inventarioRef, {
          tallasDisponibles: tallas,
          stock: nuevoStock,
        });
      }),
    );
  }

  async devolver(
    pedido: PedidoLocal,
    devueltoPorNombre: string,
    devueltoPorId: string,
  ): Promise<void> {
    const pedidoRef = doc(this.firestore, this.PEDIDOS_COLLECTION, pedido.id!);
    await runInInjectionContext(this.injector, () =>
      updateDoc(pedidoRef, {
        estado: 'devuelto',
        devueltoPorNombre,
        devueltoPorId,
        fechaDevolucion: new Date(),
      }),
    );
  }

  async aceptarDevolucion(
    pedido: PedidoLocal,
    aceptadoPorNombre: string,
    aceptadoPorId: string,
  ): Promise<void> {
    const pedidoRef = doc(this.firestore, this.PEDIDOS_COLLECTION, pedido.id!);
    const inventarioId = `${pedido.productoId}_${pedido.localOrigenId}`;
    const inventarioRef = doc(
      this.firestore,
      this.INVENTARIO_COLLECTION,
      inventarioId,
    );

    await runInInjectionContext(this.injector, () =>
      runTransaction(this.firestore, async (transaction) => {
        const invSnap = await transaction.get(inventarioRef);
        const data = invSnap.exists()
          ? (invSnap.data() as any)
          : { tallasDisponibles: {} };
        const tallas = { ...(data.tallasDisponibles ?? {}) };

        tallas[pedido.talla] = (tallas[pedido.talla] ?? 0) + 1;

        const nuevoStock = Object.values(tallas).reduce(
          (a: number, b) => a + (b as number),
          0,
        );

        if (invSnap.exists()) {
          transaction.update(inventarioRef, {
            tallasDisponibles: tallas,
            stock: nuevoStock,
          });
        }

        transaction.delete(pedidoRef);
      }),
    );
  }

  async descontarStockYCrearExhibicion(
    productoId: number,
    localId: string,
    talla: number,
    datosExhibicion: Record<string, any>,
  ): Promise<void> {
    const inventarioId = `${productoId}_${localId}`;
    const inventarioRef = doc(
      this.firestore,
      this.INVENTARIO_COLLECTION,
      inventarioId,
    );
    const exhibicionRef = doc(
      collection(this.firestore, this.EXHIBICIONES_COLLECTION),
    );
    const metadataRef = doc(
      this.firestore,
      this.METADATA_COLLECTION,
      this.METADATA_DOC_EXHIBICIONES,
    );

    await runInInjectionContext(this.injector, () =>
      runTransaction(this.firestore, async (transaction) => {
        const invSnap = await transaction.get(inventarioRef);
        if (!invSnap.exists()) {
          throw new Error('No se encontró el inventario del local.');
        }

        const data = invSnap.data() as any;
        const tallas = { ...(data.tallasDisponibles ?? {}) };
        const disponible = tallas[talla] ?? 0;

        if (disponible < 1) {
          throw new Error('Ya no hay stock disponible de esta talla.');
        }

        tallas[talla] = disponible - 1;
        if (tallas[talla] <= 0) delete tallas[talla];

        const nuevoStock = Object.values(tallas).reduce(
          (a: number, b) => a + (b as number),
          0,
        );

        transaction.update(inventarioRef, {
          tallasDisponibles: tallas,
          stock: nuevoStock,
        });

        transaction.set(exhibicionRef, datosExhibicion);

        transaction.set(
          metadataRef,
          { ultimaAlta: new Date().toISOString() },
          { merge: true },
        );
      }),
    );
  }

  async descontarStockYCrearExhibicionYEliminarAviso(
    productoId: number,
    localId: string,
    talla: number,
    datosExhibicion: Record<string, any>,
    avisoId: string,
  ): Promise<void> {
    const inventarioId = `${productoId}_${localId}`;
    const inventarioRef = doc(
      this.firestore,
      this.INVENTARIO_COLLECTION,
      inventarioId,
    );
    const exhibicionRef = doc(
      collection(this.firestore, this.EXHIBICIONES_COLLECTION),
    );
    const avisoRef = doc(this.firestore, this.AVISOS_COLLECTION, avisoId);
    const metadataRef = doc(
      this.firestore,
      this.METADATA_COLLECTION,
      this.METADATA_DOC_EXHIBICIONES,
    );

    await runInInjectionContext(this.injector, () =>
      runTransaction(this.firestore, async (transaction) => {
        const invSnap = await transaction.get(inventarioRef);
        if (!invSnap.exists()) {
          throw new Error('No se encontró el inventario del local.');
        }

        const data = invSnap.data() as any;
        const tallas = { ...(data.tallasDisponibles ?? {}) };
        const disponible = tallas[talla] ?? 0;

        if (disponible < 1) {
          throw new Error('Ya no hay stock disponible de esta talla.');
        }

        tallas[talla] = disponible - 1;
        if (tallas[talla] <= 0) delete tallas[talla];

        const nuevoStock = Object.values(tallas).reduce(
          (a: number, b) => a + (b as number),
          0,
        );

        transaction.update(inventarioRef, {
          tallasDisponibles: tallas,
          stock: nuevoStock,
        });

        transaction.set(exhibicionRef, datosExhibicion);
        transaction.delete(avisoRef);

        transaction.set(
          metadataRef,
          { ultimaAlta: new Date().toISOString() },
          { merge: true },
        );
      }),
    );
  }
}
