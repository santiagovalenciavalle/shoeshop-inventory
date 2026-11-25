import { Injectable, inject, Injector } from '@angular/core';
import { ingresoTalla, Products } from '../../pages/interfaces';
import { NotificationsService } from '../notifications/notifications.service';
import {
  Firestore,
  collection,
  doc,
  deleteDoc,
  updateDoc,
  sum,
  getAggregateFromServer,
} from '@angular/fire/firestore';
import { BehaviorSubject, Subscription } from 'rxjs';
import {
  getDocs,
  setDoc,
  query,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  onSnapshot,
  getDoc,
  getCountFromServer,
  runTransaction,
} from 'firebase/firestore';
import { RegistroIngresosService } from '../administracion/registro de ingresos/registro-ingresos.service';
import { AuthService } from '../auth/auth.service';
import { deleteObject, getStorage, ref } from 'firebase/storage';

import { enContexto } from '../../shared/utils/firestore-contexto';
@Injectable({
  providedIn: 'root',
})
export class CatalogoService {
  private readonly _inj = inject(Injector);

  private readonly COLLECTION_NAME = 'productos';

  private productosSubject = new BehaviorSubject<Products[]>([]);
  productos$ = this.productosSubject.asObservable();

  private productosSub: Subscription | null = null;
  private lastVisible: QueryDocumentSnapshot<DocumentData> | null = null;
  private pageSize = 100;
  private hasMore = true;
  private datosCargados = false;
  private cargaEnCurso: Promise<void> | null = null;
  private unsubscribeColeccion: (() => void) | null = null;

  private readonly METADATA_COLLECTION = 'metadata';
  private readonly METADATA_DOC_PRODUCTOS = 'productos';

  user: any;

  constructor(
    private firestore: Firestore,
    private ingresosService: RegistroIngresosService,
    private authService: AuthService,
  ) {}

  /**
   * De dónde se leen los productos:
   *  - con sesión: `productos` (todos los campos, incluidos costos y ubicación);
   *  - sin sesión (catálogo público): `catalogo_publico`, la copia con solo los campos seguros
   *    que mantiene la función `sincronizarCatalogoPublico`. Es la única colección que las reglas
   *    de Firestore dejan leer a un visitante anónimo.
   */
  private fuente: 'productos' | 'catalogo_publico' | null = null;

  private fuenteSegunSesion(): 'productos' | 'catalogo_publico' {
    return this.authService.getCurrentUser() ? 'productos' : 'catalogo_publico';
  }

  /** `true` si lo que hay cargado es el catálogo público (sin precios internos). */
  get esCatalogoPublico(): boolean {
    return this.fuente === 'catalogo_publico';
  }

  async cargarTodosProductosOrdenadosDesc(forceRefresh = false): Promise<void> {
    const fuente = this.fuenteSegunSesion();
    // Si cambió la sesión (p. ej. un visitante inició sesión) hay que volver a suscribirse
    if (this.datosCargados && !forceRefresh && this.fuente === fuente) return;

    if (this.cargaEnCurso) {
      return this.cargaEnCurso;
    }

    this.cargaEnCurso = this._suscribirColeccion(fuente);

    try {
      await this.cargaEnCurso;
    } finally {
      this.cargaEnCurso = null;
    }
  }

  private _suscribirColeccion(
    fuente: 'productos' | 'catalogo_publico' = 'productos',
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.unsubscribeColeccion) {
        this.unsubscribeColeccion();
        this.unsubscribeColeccion = null;
      }
      this.fuente = fuente;

      const productosRef = collection(this.firestore, fuente);
      const q = query(productosRef, orderBy('id', 'desc'));

      let primeraCarga = true;

      this.unsubscribeColeccion = enContexto(this._inj, () => onSnapshot(
        q,
        (snapshot) => {
          if (primeraCarga) {
            const productos: Products[] = snapshot.docs.map((d) => ({
              id: Number(d.id),
              ...(d.data() as Omit<Products, 'id'>),
            }));
            this.productosSubject.next(productos);
            this.datosCargados = true;
            primeraCarga = false;
            resolve();
            return;
          }

          const actuales = [...this.productosSubject.getValue()];

          for (const change of snapshot.docChanges()) {
            const item: Products = {
              id: Number(change.doc.id),
              ...(change.doc.data() as Omit<Products, 'id'>),
            };
            const index = actuales.findIndex((p) => p.id === item.id);

            if (change.type === 'removed') {
              if (index >= 0) actuales.splice(index, 1);
            } else if (index >= 0) {
              actuales[index] = item;
            } else {
              actuales.unshift(item);
            }
          }

          this.productosSubject.next(actuales);
        },
        (error) => {
          console.error('Error en listener de productos:', error);
          reject(error);
        },
      ));
    });
  }

  cerrarListener(): void {
    if (this.unsubscribeColeccion) {
      this.unsubscribeColeccion();
      this.unsubscribeColeccion = null;
    }
    this.datosCargados = false;
  }

  private async _cargarTodosDesdeFirestore(): Promise<void> {
    const productosRef = collection(this.firestore, this.COLLECTION_NAME);
    const q = query(productosRef, orderBy('id', 'desc'));

    const snapshot = await getDocs(q);
    const productos: Products[] = snapshot.docs.map((doc) => ({
      id: Number(doc.id),
      ...(doc.data() as Omit<Products, 'id'>),
    }));

    this.productosSubject.next(productos);
    this.datosCargados = true;
  }

  private async _marcarAltaProducto(): Promise<void> {
    try {
      const metadataRef = doc(
        this.firestore,
        this.METADATA_COLLECTION,
        this.METADATA_DOC_PRODUCTOS,
      );
      await setDoc(
        metadataRef,
        { ultimaAlta: new Date().toISOString() },
        { merge: true },
      );
    } catch (error) {
      console.error('Error al marcar alta de producto:', error);
    }
  }

  async cargarProductosTiempoReal(): Promise<void> {
    await this.cargarTodosProductosOrdenadosDesc();
  }

  getProductos() {
    return this.productos$;
  }

  async cargarPrimeraPagina(): Promise<void> {
    const productosRef = collection(this.firestore, this.COLLECTION_NAME);
    const q = query(productosRef, orderBy('id', 'desc'), limit(this.pageSize));

    const snapshot = await getDocs(q);

    const productos = snapshot.docs.map((doc) => {
      const data = doc.data() as Omit<Products, 'id'>;
      return {
        id: Number(doc.id),
        ...data,
      };
    });

    this.lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
    this.hasMore = snapshot.docs.length === this.pageSize;

    this.productosSubject.next(productos);
  }

  async cargarSiguientePagina(): Promise<boolean> {
    if (!this.lastVisible || !this.hasMore) return false;

    const productosRef = collection(this.firestore, this.COLLECTION_NAME);
    const q = query(
      productosRef,
      orderBy('id', 'desc'),
      startAfter(this.lastVisible),
      limit(this.pageSize),
    );

    try {
      const snapshot = await getDocs(q);

      const nuevosProductos = snapshot.docs.map((doc) => ({
        id: Number(doc.id),
        ...(doc.data() as Omit<Products, 'id'>),
      }));

      this.lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
      this.hasMore = snapshot.docs.length === this.pageSize;

      const productosActuales = this.productosSubject.getValue();
      const productosCombinados = [...productosActuales];

      for (const nuevo of nuevosProductos) {
        const index = productosCombinados.findIndex(
          (p) => Number(p.id) === Number(nuevo.id),
        );
        if (index === -1) {
          productosCombinados.push(nuevo);
        }
      }

      this.productosSubject.next(productosCombinados);

      return snapshot.docs.length === this.pageSize;
    } catch (error) {
      console.error('❌ Error al cargar siguiente página de productos:', error);
      return false;
    }
  }

  async obtenerStockTotalAgregado(): Promise<number> {
    const productosRef = collection(this.firestore, this.COLLECTION_NAME);
    const snapshot = await enContexto(this._inj, () => getAggregateFromServer(productosRef, {
      total: sum('stock'),
    }));
    return snapshot.data().total ?? 0;
  }

  async agregarProducto(
    producto: Omit<Products, 'stock' | 'id'>,
  ): Promise<void> {
    this.user = this.authService.getCurrentUser();
    const stockTotal = Object.values(producto.tallasDisponibles).reduce(
      (acc, cantidad) => acc + cantidad,
      0,
    );

    const metadataRef = doc(
      this.firestore,
      this.METADATA_COLLECTION,
      this.METADATA_DOC_PRODUCTOS,
    );

    try {
      let nuevoProducto!: Products;

      await runTransaction(this.firestore, async (transaction) => {
        const metadataSnap = await transaction.get(metadataRef);
        const ultimoId = metadataSnap.exists()
          ? (metadataSnap.data()['ultimoId'] ?? 0)
          : 0;
        const nuevoId = ultimoId + 1;

        nuevoProducto = {
          ...producto,
          id: nuevoId,
          stock: stockTotal,
          stockInicial: stockTotal,
          valorInventario: (producto.precioAdquisicion ?? 0) * stockTotal, // NUEVO
        };

        const productoRef = doc(
          this.firestore,
          this.COLLECTION_NAME,
          String(nuevoId),
        );

        transaction.set(productoRef, nuevoProducto);
        transaction.set(metadataRef, { ultimoId: nuevoId }, { merge: true });
      });

      this._agregarProductoEnMemoria(nuevoProducto);

      const ingreso: ingresoTalla = {
        zapatoId: nuevoProducto.id,
        marca: producto.marca,
        referencia: producto.referencia,
        cantIngresada: String(stockTotal),
        fecha: new Date(),
        nombre: this.user.name,
      };

      await this.ingresosService.nuevoIngresoProducto(ingreso);
    } catch (error) {
      console.error('Error al agregar producto:', error);
    }
  }

  private _agregarProductoEnMemoria(producto: Products): void {
    const actuales = this.productosSubject.getValue();
    this.productosSubject.next([producto, ...actuales]);
  }

  private _actualizarProductoEnMemoria(
    id: number | string,
    cambios: Partial<Products>,
  ): void {
    const actuales = this.productosSubject.getValue();
    const idNum = Number(id);
    const index = actuales.findIndex((p) => p.id === idNum);
    if (index === -1) return;

    const copia = [...actuales];
    copia[index] = { ...copia[index], ...cambios };
    this.productosSubject.next(copia);
  }

  private _eliminarProductoEnMemoria(id: number | string): void {
    const actuales = this.productosSubject.getValue();
    const idNum = Number(id);
    this.productosSubject.next(actuales.filter((p) => p.id !== idNum));
  }

  async obtenerCantidadProductos(): Promise<number> {
    const productosRef = collection(this.firestore, this.COLLECTION_NAME);
    const snapshot = await getCountFromServer(productosRef);
    return snapshot.data().count;
  }

  getProductosSnapshot(): Products[] {
    return this.productosSubject.getValue();
  }

  async borrarProducto(id: string | number): Promise<void> {
    try {
      const productoRef = doc(this.firestore, `${this.COLLECTION_NAME}/${id}`);

      const productoSnap = await getDoc(productoRef);
      if (!productoSnap.exists()) {
        console.warn(`Producto con id ${id} no encontrado para borrar.`);
        return;
      }
      const producto = productoSnap.data() as Products;

      if (
        producto.imagen &&
        producto.imagen.startsWith('https://firebasestorage.googleapis.com')
      ) {
        try {
          const storage = getStorage();

          const decodedUrl = decodeURIComponent(producto.imagen);
          const baseUrl =
            'https://firebasestorage.googleapis.com/v0/b/tu-proyecto.appspot.com/o/';

          if (decodedUrl.startsWith(baseUrl)) {
            const pathStart = baseUrl.length;
            const pathEnd = decodedUrl.indexOf('?alt=media');
            const filePath = decodedUrl.substring(pathStart, pathEnd);

            const fileRef = ref(storage, filePath);
            await deleteObject(fileRef);
          }
        } catch (error) {
          console.warn(`Error al borrar imagen del producto ${id}:`, error);
        }
      }

      await deleteDoc(productoRef);
      this._eliminarProductoEnMemoria(id);
    } catch (error) {
      console.error('Error al borrar producto:', error);
    }
  }

  async actualizarStockPorTalla(
    id: string | number,
    talla: number,
  ): Promise<void> {
    const productoRef = doc(this.firestore, `${this.COLLECTION_NAME}/${id}`);
    let tallasResultado: Record<number, number> | null = null;
    let stockResultado = 0;
    let valorInventarioResultado = 0; // NUEVO

    await runTransaction(this.firestore, async (transaction) => {
      const productoSnap = await transaction.get(productoRef);

      if (!productoSnap.exists()) {
        throw new Error(`Producto con id ${id} no encontrado.`);
      }

      const producto = productoSnap.data() as Products;

      if (
        !producto.tallasDisponibles?.[talla] ||
        producto.tallasDisponibles[talla] <= 0
      ) {
        throw new Error(`La talla ${talla} del producto ${id} ya está en 0.`);
      }

      const nuevasTallas = { ...producto.tallasDisponibles };
      nuevasTallas[talla]--;

      const nuevoStock = Object.values(nuevasTallas).reduce(
        (acc, val) => acc + val,
        0,
      );
      const nuevoValorInventario =
        (producto.precioAdquisicion ?? 0) * nuevoStock;

      transaction.update(productoRef, {
        tallasDisponibles: nuevasTallas,
        stock: nuevoStock,
        valorInventario: nuevoValorInventario,
      });

      tallasResultado = nuevasTallas;
      stockResultado = nuevoStock;
      valorInventarioResultado = nuevoValorInventario;
    });

    if (tallasResultado) {
      this._actualizarProductoEnMemoria(id, {
        tallasDisponibles: tallasResultado,
        stock: stockResultado,
        valorInventario: valorInventarioResultado,
      } as Partial<Products>);
    }
  }

  async incrementarStockPorTalla(
    id: string | number,
    talla: number,
  ): Promise<void> {
    const productoRef = doc(this.firestore, `${this.COLLECTION_NAME}/${id}`);
    let tallasResultado: Record<number, number> | null = null;
    let stockResultado = 0;

    await runTransaction(this.firestore, async (transaction) => {
      const productoSnap = await transaction.get(productoRef);

      if (!productoSnap.exists()) {
        throw new Error(`Producto con id ${id} no encontrado.`);
      }

      const producto = productoSnap.data() as Products;
      const nuevasTallas = { ...(producto.tallasDisponibles ?? {}) };
      nuevasTallas[talla] = (nuevasTallas[talla] ?? 0) + 1;

      const nuevoStock = Object.values(nuevasTallas).reduce(
        (acc, val) => acc + val,
        0,
      );

      const nuevoValorInventario =
        (producto.precioAdquisicion ?? 0) * nuevoStock;

      transaction.update(productoRef, {
        tallasDisponibles: nuevasTallas,
        stock: nuevoStock,
        valorInventario: nuevoValorInventario,
      });

      tallasResultado = nuevasTallas;
      stockResultado = nuevoStock;
    });

    if (tallasResultado) {
      this._actualizarProductoEnMemoria(id, {
        tallasDisponibles: tallasResultado,
        stock: stockResultado,
      } as Partial<Products>);
    }
  }

  async getProductoPorId(id: string | number): Promise<Products | undefined> {
    try {
      const productoRef = doc(this.firestore, this.COLLECTION_NAME, String(id));
      const productoSnap = await getDoc(productoRef);
      if (productoSnap.exists()) {
        return {
          id: Number(productoSnap.id),
          ...(productoSnap.data() as Products),
        };
      } else {
        console.warn('Producto no encontrado en BD para id:', id);
        return undefined;
      }
    } catch (error) {
      console.error('Error al obtener producto por id desde BD:', error);
      return undefined;
    }
  }

  async getPrecioAdquisicionPorId(id: string | number): Promise<number | null> {
    const producto = await this.getProductoPorId(id);
    return producto?.precioAdquisicion ?? null;
  }

  async actualizarProducto(
    id: string | number,
    datosProducto: Products,
  ): Promise<void> {
    const stockTotal = Object.values(datosProducto.tallasDisponibles).reduce(
      (acc, cantidad) => acc + cantidad,
      0,
    );
    const valorInventario = (datosProducto.precioAdquisicion ?? 0) * stockTotal;

    const productoRef = doc(this.firestore, `${this.COLLECTION_NAME}/${id}`);
    try {
      await updateDoc(productoRef, {
        ...datosProducto,
        stock: stockTotal,
        valorInventario,
      });
      this._actualizarProductoEnMemoria(id, {
        ...datosProducto,
        stock: stockTotal,
        valorInventario,
      });
    } catch (error) {
      console.error('Error al actualizar producto:', error);
    }
  }

  async obtenerCapitalTotalAgregado(): Promise<number> {
    const productosRef = collection(this.firestore, this.COLLECTION_NAME);
    const snapshot = await enContexto(this._inj, () => getAggregateFromServer(productosRef, {
      total: sum('valorInventario'),
    }));
    return snapshot.data().total ?? 0;
  }

  async actualizarFilaProducto(
    id: number | string,
    fila: string,
  ): Promise<void> {
    const productoRef = doc(this.firestore, `${this.COLLECTION_NAME}/${id}`);

    await updateDoc(productoRef, {
      fila: fila,
    });

    this._actualizarProductoEnMemoria(id, { fila } as Partial<Products>);
  }

  resetProductos(): void {
    this.productosSubject.next([]);
    this.datosCargados = false;
  }

  private suscriptoresActivos = 0;

  registrar(): void {
    this.suscriptoresActivos++;
  }

  desregistrar(): void {
    this.suscriptoresActivos = Math.max(0, this.suscriptoresActivos - 1);
  }

  reiniciarListener(): void {
    this.cargarTodosProductosOrdenadosDesc(true);
  }
}
