import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  runTransaction,
  query,
  where,
  getDocs,
  Transaction,
  DocumentReference,
  addDoc,
} from '@angular/fire/firestore';
import { InventarioLocal, Prestamo, Venta } from '../../../pages/interfaces';

export interface ContextoAccionLocal {
  origen: 'inventario' | 'pedidoLocal';
  productoId: number;
  talla: number;
  localDocId: string;
  pedidoLocalId?: string;
}

export interface DatosPedidoDevuelto {
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
}

@Injectable({ providedIn: 'root' })
export class AccionesLocalesService {
  private readonly VENTAS_COLLECTION = 'ventas';
  private readonly PRESTAMOS_COLLECTION = 'prestamos';
  private readonly INVENTARIO_COLLECTION = 'inventarioLocales';
  private readonly PEDIDOS_COLLECTION = 'pedidosDeLocales';

  constructor(
    private firestore: Firestore,
    private injector: Injector,
  ) {}

  private idInventario(productoId: number, localId: string): string {
    return `${productoId}_${localId}`;
  }

  private limpiar<T extends object>(obj: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(obj).filter(([, v]) => v !== undefined),
    ) as Partial<T>;
  }

  private construirPedidoDevuelto(
    datos: DatosPedidoDevuelto,
    tipoDevolucion: 'cambio' | 'bono',
  ) {
    return {
      productoId: datos.productoId,
      talla: datos.talla,
      marca: datos.marca,
      referencia: datos.referencia,
      imagen: datos.imagen,
      localOrigenId: datos.localOrigenId,
      localOrigenNombre: datos.localOrigenNombre,
      estado: 'devuelto' as const,
      porFuera: true,
      solicitadoPorNombre: datos.devueltoPorNombre,
      solicitadoPorId: datos.devueltoPorId,
      localSolicitanteId: datos.localOrigenNombre,
      fechaSolicitud: new Date(),
      devueltoPorNombre: datos.devueltoPorNombre,
      devueltoPorId: datos.devueltoPorId,
      fechaDevolucion: new Date(),
      tipoDevolucion,
      productoDevueltoId: datos.productoDevueltoId,
    };
  }

  private async resolverOrigenEnTransaccion(
    transaction: Transaction,
    ctx: ContextoAccionLocal,
  ): Promise<void> {
    if (ctx.origen === 'inventario') {
      const invRef = doc(
        this.firestore,
        this.INVENTARIO_COLLECTION,
        this.idInventario(ctx.productoId, ctx.localDocId),
      );
      const invSnap = await transaction.get(invRef);
      if (!invSnap.exists()) {
        throw new Error('No se encontró el inventario del local.');
      }
      const data = invSnap.data() as InventarioLocal;
      const tallas = { ...(data.tallasDisponibles ?? {}) };
      const disponible = tallas[ctx.talla] ?? 0;
      if (disponible < 1) {
        throw new Error('Ya no hay stock disponible de esta talla.');
      }
      tallas[ctx.talla] = disponible - 1;
      if (tallas[ctx.talla] <= 0) delete tallas[ctx.talla];
      const nuevoStock = Object.values(tallas).reduce((a, b) => a + b, 0);
      transaction.update(invRef, {
        tallasDisponibles: tallas,
        stock: nuevoStock,
      });
    } else {
      if (!ctx.pedidoLocalId) {
        throw new Error('Falta el ID del pedido a eliminar.');
      }
      const pedidoRef = doc(
        this.firestore,
        this.PEDIDOS_COLLECTION,
        ctx.pedidoLocalId,
      );
      transaction.delete(pedidoRef);
    }
  }

  private async resolverVentaRefPorId(id: string): Promise<DocumentReference> {
    const ventasRef = collection(this.firestore, this.VENTAS_COLLECTION);
    const q = query(ventasRef, where('id', '==', id));
    const snapshot = await runInInjectionContext(this.injector, () =>
      getDocs(q),
    );
    if (snapshot.empty) {
      throw new Error(`No se encontró la venta con ID ${id}.`);
    }
    return snapshot.docs[0].ref;
  }

  async registrarVenta(ctx: ContextoAccionLocal, venta: Venta): Promise<void> {
    const ventaRef = doc(collection(this.firestore, this.VENTAS_COLLECTION));
    const ventaLimpia = this.limpiar(venta);

    await runInInjectionContext(this.injector, () =>
      runTransaction(this.firestore, async (transaction) => {
        await this.resolverOrigenEnTransaccion(transaction, ctx);
        transaction.set(ventaRef, ventaLimpia);
      }),
    );
  }

  async registrarPrestamo(
    ctx: ContextoAccionLocal,
    prestamo: Prestamo,
  ): Promise<void> {
    const prestamoRef = doc(
      collection(this.firestore, this.PRESTAMOS_COLLECTION),
    );
    const prestamoLimpio = this.limpiar(prestamo);

    await runInInjectionContext(this.injector, () =>
      runTransaction(this.firestore, async (transaction) => {
        await this.resolverOrigenEnTransaccion(transaction, ctx);
        transaction.set(prestamoRef, prestamoLimpio);
      }),
    );
  }

  async registrarCambio(
    ctx: ContextoAccionLocal,
    ventaCambio: Venta,
    ventaOriginalId: string,
    datosVentaOriginalUpdate: Partial<Venta>,
    datosPedidoDevuelto: DatosPedidoDevuelto,
  ): Promise<void> {
    const ventaOriginalRef = await this.resolverVentaRefPorId(ventaOriginalId);
    const ventaCambioRef = doc(
      collection(this.firestore, this.VENTAS_COLLECTION),
    );
    const pedidoDevueltoRef = doc(
      collection(this.firestore, this.PEDIDOS_COLLECTION),
    );
    const ventaCambioLimpia = this.limpiar(ventaCambio);
    const updateLimpio = this.limpiar(datosVentaOriginalUpdate);

    await runInInjectionContext(this.injector, () =>
      runTransaction(this.firestore, async (transaction) => {
        const ventaOriginalSnap = await transaction.get(ventaOriginalRef);
        if (!ventaOriginalSnap.exists()) {
          throw new Error('La venta original ya no existe.');
        }

        let invRef: DocumentReference | null = null;
        let invData: InventarioLocal | null = null;
        if (ctx.origen === 'inventario') {
          invRef = doc(
            this.firestore,
            this.INVENTARIO_COLLECTION,
            this.idInventario(ctx.productoId, ctx.localDocId),
          );
          const invSnap = await transaction.get(invRef);
          if (!invSnap.exists()) {
            throw new Error('No se encontró el inventario del local.');
          }
          invData = invSnap.data() as InventarioLocal;
          const disponible = invData.tallasDisponibles?.[ctx.talla] ?? 0;
          if (disponible < 1) {
            throw new Error('Ya no hay stock disponible de esta talla.');
          }
        }

        transaction.set(ventaCambioRef, ventaCambioLimpia);
        transaction.update(ventaOriginalRef, updateLimpio);

        if (ctx.origen === 'inventario' && invRef && invData) {
          const tallas = { ...(invData.tallasDisponibles ?? {}) };
          tallas[ctx.talla] = (tallas[ctx.talla] ?? 1) - 1;
          if (tallas[ctx.talla] <= 0) delete tallas[ctx.talla];
          const nuevoStock = Object.values(tallas).reduce((a, b) => a + b, 0);
          transaction.update(invRef, {
            tallasDisponibles: tallas,
            stock: nuevoStock,
          });
        } else if (ctx.origen === 'pedidoLocal' && ctx.pedidoLocalId) {
          transaction.delete(
            doc(this.firestore, this.PEDIDOS_COLLECTION, ctx.pedidoLocalId),
          );
        }

        transaction.set(
          pedidoDevueltoRef,
          this.construirPedidoDevuelto(datosPedidoDevuelto, 'cambio'),
        );
      }),
    );
  }

  async crearPedidoDevuelto(
    datos: DatosPedidoDevuelto,
    tipoDevolucion: 'cambio' | 'bono',
  ): Promise<void> {
    const ref = collection(this.firestore, this.PEDIDOS_COLLECTION);
    await runInInjectionContext(this.injector, () =>
      addDoc(ref, this.construirPedidoDevuelto(datos, tipoDevolucion)),
    );
  }

  async redimirBono(
    ctx: ContextoAccionLocal,
    ventaNueva: Venta,
    ventaOriginalId: string,
    datosVentaOriginalUpdate: Partial<Venta>,
  ): Promise<void> {
    const ventaOriginalRef = await this.resolverVentaRefPorId(ventaOriginalId);
    const ventaNuevaRef = doc(
      collection(this.firestore, this.VENTAS_COLLECTION),
    );
    const ventaNuevaLimpia = this.limpiar(ventaNueva);
    const updateLimpio = this.limpiar(datosVentaOriginalUpdate);

    await runInInjectionContext(this.injector, () =>
      runTransaction(this.firestore, async (transaction) => {
        const ventaOriginalSnap = await transaction.get(ventaOriginalRef);
        if (!ventaOriginalSnap.exists()) {
          throw new Error('La venta asociada al bono ya no existe.');
        }

        let invRef: DocumentReference | null = null;
        let invData: InventarioLocal | null = null;
        if (ctx.origen === 'inventario') {
          invRef = doc(
            this.firestore,
            this.INVENTARIO_COLLECTION,
            this.idInventario(ctx.productoId, ctx.localDocId),
          );
          const invSnap = await transaction.get(invRef);
          if (!invSnap.exists()) {
            throw new Error('No se encontró el inventario del local.');
          }
          invData = invSnap.data() as InventarioLocal;
          const disponible = invData.tallasDisponibles?.[ctx.talla] ?? 0;
          if (disponible < 1) {
            throw new Error('Ya no hay stock disponible de esta talla.');
          }
        }

        transaction.set(ventaNuevaRef, ventaNuevaLimpia);
        transaction.update(ventaOriginalRef, updateLimpio);

        if (ctx.origen === 'inventario' && invRef && invData) {
          const tallas = { ...(invData.tallasDisponibles ?? {}) };
          tallas[ctx.talla] = (tallas[ctx.talla] ?? 1) - 1;
          if (tallas[ctx.talla] <= 0) delete tallas[ctx.talla];
          const nuevoStock = Object.values(tallas).reduce((a, b) => a + b, 0);
          transaction.update(invRef, {
            tallasDisponibles: tallas,
            stock: nuevoStock,
          });
        } else if (ctx.origen === 'pedidoLocal' && ctx.pedidoLocalId) {
          transaction.delete(
            doc(this.firestore, this.PEDIDOS_COLLECTION, ctx.pedidoLocalId),
          );
        }
      }),
    );
  }
}
