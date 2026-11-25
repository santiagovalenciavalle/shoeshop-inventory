import { Injectable, inject, Injector } from '@angular/core';
import { Pedido } from '../../pages/interfaces';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  DocumentReference,
  runTransaction,
  getDoc,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';
import { map } from 'rxjs';
import { AuthService } from '../auth/auth.service';

import { enContexto } from '../../shared/utils/firestore-contexto';
@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private readonly _inj = inject(Injector);

  private readonly COLLECTION_NAME = 'pedidos';
  private pedidosSubject = new BehaviorSubject<Pedido[]>([]);
  pedidos$ = this.pedidosSubject.asObservable();
  private pedidosSuscripcion: Subscription | null = null;
  private suscriptoresActivos = 0;

  registrar(): void {
    this.suscriptoresActivos++;
  }

  desregistrar(): void {
    this.suscriptoresActivos = Math.max(0, this.suscriptoresActivos - 1);
  }

  async existePedido(pedidoId: string): Promise<boolean> {
    const pedidoRef = doc(
      this.firestore,
      `${this.COLLECTION_NAME}/${pedidoId}`,
    );
    const snap = await getDoc(pedidoRef);
    return snap.exists();
  }

  reiniciarListener(): void {
    this.cargarPedidosDesdeFirestore();
  }

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
  ) {}

  private cargarPedidosDesdeFirestore(): void {
    this.pedidosSuscripcion?.unsubscribe();

    const pedidosCollection = collection(this.firestore, this.COLLECTION_NAME);
    this.pedidosSuscripcion = enContexto(this._inj, () => collectionData(pedidosCollection, {
      idField: 'id',
    })).subscribe({
      next: (data) => this.pedidosSubject.next(data as Pedido[]),
      error: (error) => console.error('Error al cargar pedidos:', error),
    });
  }

  async marcarComoProcesando(pedidoId: string): Promise<void> {
    const pedidoRef = doc(this.firestore, `pedidos/${pedidoId}`);

    await runTransaction(this.firestore, async (transaction) => {
      const snap = await transaction.get(pedidoRef);

      if (!snap.exists()) {
        throw new Error('PEDIDO_NO_ENCONTRADO');
      }

      const data = snap.data();

      if (data['procesando'] === true) {
        throw new Error('PEDIDO_YA_EN_PROCESO');
      }

      if (data['estado'] !== 'Recibido') {
        throw new Error('PEDIDO_ESTADO_INVALIDO');
      }

      transaction.update(pedidoRef, { procesando: true });
    });
  }

  async quitarBloqueo(pedidoId: string): Promise<void> {
    try {
      const pedidoRef = doc(this.firestore, `pedidos/${pedidoId}`);
      await updateDoc(pedidoRef, { procesando: false });
    } catch (e) {
      console.error('Error al quitar bloqueo del pedido:', e);
    }
  }

  async aceptarPedidoAtomico(
    pedidoId: string,
    zapatoId: string | number,
    talla: number,
  ): Promise<void> {
    const pedidoRef = doc(this.firestore, `pedidos/${pedidoId}`);
    const productoRef = doc(this.firestore, `productos/${zapatoId}`);

    await runTransaction(this.firestore, async (transaction) => {
      const [pedidoSnap, productoSnap] = await Promise.all([
        transaction.get(pedidoRef),
        transaction.get(productoRef),
      ]);

      if (!pedidoSnap.exists()) throw new Error('Pedido no encontrado.');
      const pedidoData = pedidoSnap.data();
      if (pedidoData['estado'] !== 'Pendiente') {
        throw new Error('PEDIDO_YA_PROCESADO');
      }

      if (!productoSnap.exists()) throw new Error('Producto no encontrado.');
      const producto = productoSnap.data();
      const tallasDisponibles = { ...producto['tallasDisponibles'] };

      if (!tallasDisponibles[talla] || tallasDisponibles[talla] <= 0) {
        throw new Error(`Sin stock disponible para talla ${talla}.`);
      }

      tallasDisponibles[talla]--;
      const nuevoStock = Object.values(tallasDisponibles).reduce(
        (acc: number, val: any) => acc + val,
        0,
      );

      const hora = new Date().toISOString();

      transaction.update(pedidoRef, {
        estado: 'Recibido',
        hora,
        stockDescontado: true,
      });

      transaction.update(productoRef, {
        tallasDisponibles,
        stock: nuevoStock,
      });
    });
  }

  async devolverPedidoAtomico(
    pedidoId: string,
    zapatoId: string | number,
    talla: number,
  ): Promise<void> {
    const pedidoRef = doc(this.firestore, `pedidos/${pedidoId}`);
    const productoRef = doc(this.firestore, `productos/${zapatoId}`);

    await runTransaction(this.firestore, async (transaction) => {
      const [pedidoSnap, productoSnap] = await Promise.all([
        transaction.get(pedidoRef),
        transaction.get(productoRef),
      ]);

      if (!pedidoSnap.exists()) throw new Error('Pedido no encontrado.');
      const pedidoData = pedidoSnap.data();

      if (pedidoData['estado'] === 'StockRestaurado') {
        throw new Error('DEVOLUCION_YA_PROCESADA');
      }
      if (pedidoData['estado'] !== 'Devuelto') {
        throw new Error('El pedido no está en estado Devuelto.');
      }

      if (!productoSnap.exists()) throw new Error('Producto no encontrado.');
      const producto = productoSnap.data();
      const tallasDisponibles = { ...(producto['tallasDisponibles'] ?? {}) };

      tallasDisponibles[talla] = (tallasDisponibles[talla] ?? 0) + 1;
      const nuevoStock = Object.values(tallasDisponibles).reduce(
        (acc: number, val: any) => acc + val,
        0,
      );

      transaction.update(pedidoRef, { estado: 'StockRestaurado' });

      transaction.update(productoRef, {
        tallasDisponibles,
        stock: nuevoStock,
      });
    });

    const pedidoRef2 = doc(this.firestore, `pedidos/${pedidoId}`);
    await deleteDoc(pedidoRef2);
  }

  obtenerPedidos(): Observable<Pedido[]> {
    return this.pedidos$;
  }

  async agregarPedido(pedido: Pedido): Promise<DocumentReference> {
    const pedidosCollection = collection(this.firestore, this.COLLECTION_NAME);

    const usuario = this.authService.getCurrentUser();

    if (!usuario || !usuario.id) {
      throw new Error('Usuario no autenticado o sin ID');
    }

    pedido.vendedorId = usuario.id;
    pedido.vendedor = usuario.name;
    pedido.local = usuario.local;

    try {
      return await addDoc(pedidosCollection, pedido);
    } catch (error) {
      console.error('Error al agregar pedido:', error);
      throw error;
    }
  }

  /**
   * RESERVA DE STOCK AL SOLICITAR
   *
   * Un pedido "Pendiente" todavía no descuenta stock (eso pasa cuando bodega lo acepta), así que
   * sin control se podían crear varios pedidos para un mismo par. Aquí el pedido se crea dentro de
   * una transacción que cuenta los pedidos pendientes de esa referencia y talla: si ya hay tantos
   * pendientes como pares en bodega, la talla está RESERVADA y no se crea otro.
   *
   * `reservasPedidos/{zapatoId}_{talla}` guarda los ids de los pedidos pendientes. No hay que
   * limpiarlo desde bodega: cada solicitud vuelve a comprobar cuáles siguen pendientes y descarta
   * los que ya se aceptaron, rechazaron o borraron.
   *
   * Lanza Error('TALLA_RESERVADA') o Error('SIN_STOCK').
   */
  async solicitarPedidoConReserva(pedido: Pedido): Promise<string> {
    const usuario = this.authService.getCurrentUser();
    if (!usuario || !usuario.id) {
      throw new Error('Usuario no autenticado o sin ID');
    }
    pedido.vendedorId = usuario.id;
    pedido.vendedor = usuario.name;
    pedido.local = usuario.local;

    const zapatoId = Number(pedido.zapatoId);
    const talla = String(pedido.talla);
    const pedidosCol = collection(this.firestore, this.COLLECTION_NAME);
    const nuevoRef = doc(pedidosCol);
    const productoRef = doc(this.firestore, `productos/${zapatoId}`);
    const reservaRef = doc(this.firestore, `reservasPedidos/${zapatoId}_${talla}`);

    // Pedidos pendientes que ya existían (incluye los creados antes de tener reservas)
    let idsPrevios: string[] = [];
    try {
      const snap = await getDocs(
        query(
          pedidosCol,
          where('zapatoId', '==', zapatoId),
          where('talla', '==', talla),
          where('estado', '==', 'Pendiente'),
        ),
      );
      idsPrevios = snap.docs.map((d) => d.id);
    } catch (e) {
      console.warn('No se pudieron consultar los pedidos pendientes previos', e);
    }

    await runTransaction(this.firestore, async (tx) => {
      const [productoSnap, reservaSnap] = await Promise.all([
        tx.get(productoRef),
        tx.get(reservaRef),
      ]);
      if (!productoSnap.exists()) throw new Error('Producto no encontrado.');

      const enBodega = Number(
        productoSnap.data()['tallasDisponibles']?.[talla] ?? 0,
      );
      if (enBodega <= 0) throw new Error('SIN_STOCK');

      const guardados: string[] = reservaSnap.exists()
        ? ((reservaSnap.data()['pedidos'] as string[]) ?? [])
        : [];
      const candidatos = [...new Set([...guardados, ...idsPrevios])];
      const snaps = await Promise.all(
        candidatos.map((id) =>
          tx.get(doc(this.firestore, `${this.COLLECTION_NAME}/${id}`)),
        ),
      );
      const vigentes = candidatos.filter(
        (_, i) => snaps[i].exists() && snaps[i].data()?.['estado'] === 'Pendiente',
      );

      if (vigentes.length >= enBodega) throw new Error('TALLA_RESERVADA');

      tx.set(nuevoRef, { ...pedido });
      tx.set(reservaRef, {
        zapatoId,
        talla,
        pedidos: [...vigentes, nuevoRef.id],
        actualizado: new Date().toISOString(),
      });
    });

    return nuevoRef.id;
  }

  /**
   * Cuántos pedidos pendientes hay por talla para una referencia, en tiempo real.
   * Sirve para mostrar "Reservado" en el catálogo mientras bodega no acepta o rechaza.
   */
  pendientesPorTalla$(zapatoId: number): Observable<Record<string, number>> {
    const q = query(
      collection(this.firestore, this.COLLECTION_NAME),
      where('zapatoId', '==', Number(zapatoId)),
      where('estado', '==', 'Pendiente'),
    );
    return enContexto(this._inj, () => collectionData(q)).pipe(
      map((lista) => {
        const porTalla: Record<string, number> = {};
        for (const p of lista as Pedido[]) {
          const t = String(p.talla);
          porTalla[t] = (porTalla[t] ?? 0) + 1;
        }
        return porTalla;
      }),
    );
  }

  async actualizarPedido(pedido: Pedido): Promise<void> {
    if (!pedido.id) throw new Error('El pedido no tiene ID');

    const pedidoDocRef = doc(
      this.firestore,
      `${this.COLLECTION_NAME}/${pedido.id}`,
    );
    try {
      await updateDoc(pedidoDocRef, { ...pedido });
    } catch (error) {
      console.error('Error al actualizar pedido:', error);
      throw error;
    }
  }

  async eliminarPedidoPorId(id: string): Promise<boolean> {
    try {
      if (!id) {
        console.error('ID del pedido no proporcionado');
        return false;
      }

      const pedidoRef = doc(this.firestore, this.COLLECTION_NAME, id);

      await deleteDoc(pedidoRef);

      return true;
    } catch (error) {
      console.error('Error al eliminar el pedido:', error);
      return false;
    }
  }

  async eliminarPedido(pedido: Pedido): Promise<void> {
    if (!pedido.id) throw new Error('El pedido no tiene ID');

    const pedidoDocRef = doc(
      this.firestore,
      `${this.COLLECTION_NAME}/${pedido.id}`,
    );
    try {
      await deleteDoc(pedidoDocRef);
    } catch (error) {
      console.error('Error al eliminar pedido:', error);
      throw error;
    }
  }
}
