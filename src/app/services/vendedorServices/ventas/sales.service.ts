/** @format */

import { Injectable, inject, Injector } from '@angular/core';
import { Venta } from '../../../pages/interfaces';
import {
  Firestore,
  collection,
  addDoc,
  collectionData,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  writeBatch,
  docData,
} from '@angular/fire/firestore';
import { BehaviorSubject, map, Observable, Subscription } from 'rxjs';
import { AuthService } from '../../../services/auth/auth.service';
import { getDocs, updateDoc } from 'firebase/firestore';
import { deleteDoc } from 'firebase/firestore';

import { enContexto } from '../../../shared/utils/firestore-contexto';
@Injectable({
  providedIn: 'root',
})
export class SalesService {
  private readonly _inj = inject(Injector);

  private readonly COLLECTION_NAME = 'ventas';

  private ventasSubject = new BehaviorSubject<Venta[]>([]);
  ventas$ = this.ventasSubject.asObservable();

  private ventasSub: Subscription | null = null;
  private isInitializednormal = false;

  private readonly LIMITE_TIEMPO_REAL = 150;

  private hasMoreAntiguas = true;
  private cursorAntiguas: any = null;

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
  ) {}

  initVentas(): void {
    if (this.isInitializednormal) return;

    const ventasRef = collection(this.firestore, this.COLLECTION_NAME);
    const q = query(
      ventasRef,
      orderBy('fechaVenta', 'desc'),
      limit(this.LIMITE_TIEMPO_REAL),
    );

    this.ventasSub = enContexto(this._inj, () => collectionData(q, { idField: 'id' })).subscribe({
      next: (data) => {
        this.ventasSubject.next(data as Venta[]);
      },
      error: (error) => {
        console.error('Error al cargar ventas desde Firestore:', error);
      },
    });

    this.isInitializednormal = true;
  }

  async cargarVentasAntiguas(): Promise<boolean> {
    const actuales = this.ventasSubject.getValue();
    if (actuales.length === 0 || !this.hasMoreAntiguas) return false;

    const cursor =
      this.cursorAntiguas ?? (actuales[actuales.length - 1] as any).fechaVenta;

    const ventasRef = collection(this.firestore, this.COLLECTION_NAME);
    const q = query(
      ventasRef,
      orderBy('fechaVenta', 'desc'),
      startAfter(cursor),
      limit(this.LIMITE_TIEMPO_REAL),
    );

    const snapshot = await getDocs(q);
    const nuevas = snapshot.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as Venta,
    );

    this.hasMoreAntiguas = snapshot.docs.length === this.LIMITE_TIEMPO_REAL;
    if (nuevas.length > 0) {
      this.cursorAntiguas = (nuevas[nuevas.length - 1] as any).fechaVenta;
    }

    this.ventasSubject.next([...actuales, ...nuevas]);

    return this.hasMoreAntiguas;
  }

  getVentasHoy$(): Observable<Venta[]> {
    const ventasRef = collection(this.firestore, this.COLLECTION_NAME);
    const hoy = new Date();
    const inicio = new Date(
      hoy.getFullYear(),
      hoy.getMonth(),
      hoy.getDate(),
      0,
      0,
      0,
      0,
    );
    const fin = new Date(
      hoy.getFullYear(),
      hoy.getMonth(),
      hoy.getDate(),
      23,
      59,
      59,
      999,
    );

    const q = query(
      ventasRef,
      where('fechaVenta', '>=', inicio),
      where('fechaVenta', '<=', fin),
    );

    return enContexto(this._inj, () => collectionData(q, { idField: 'id' })) as Observable<Venta[]>;
  }

  getVentasPorDia$(fecha: Date): Observable<Venta[]> {
    const ventasRef = collection(this.firestore, this.COLLECTION_NAME);
    const inicio = new Date(
      fecha.getFullYear(),
      fecha.getMonth(),
      fecha.getDate(),
      0,
      0,
      0,
      0,
    );
    const fin = new Date(
      fecha.getFullYear(),
      fecha.getMonth(),
      fecha.getDate(),
      23,
      59,
      59,
      999,
    );

    const q = query(
      ventasRef,
      where('fechaVenta', '>=', inicio),
      where('fechaVenta', '<=', fin),
    );

    return new Observable((observer) => {
      getDocs(q)
        .then((snapshot) => {
          const data = snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as Venta,
          );
          observer.next(data);
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }

  getVentasPorSemana$(inicio: Date, fin: Date): Observable<Venta[]> {
    const ventasRef = collection(this.firestore, this.COLLECTION_NAME);
    const q = query(
      ventasRef,
      where('fechaVenta', '>=', inicio),
      where('fechaVenta', '<=', fin),
    );

    return new Observable((observer) => {
      getDocs(q)
        .then((snapshot) => {
          const data = snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as Venta,
          );
          observer.next(data);
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }

  getVentasPorMes$(mes: Date): Observable<Venta[]> {
    const ventasRef = collection(this.firestore, this.COLLECTION_NAME);
    const inicio = new Date(mes.getFullYear(), mes.getMonth(), 1, 0, 0, 0, 0);
    const fin = new Date(
      mes.getFullYear(),
      mes.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const q = query(
      ventasRef,
      where('fechaVenta', '>=', inicio),
      where('fechaVenta', '<=', fin),
    );

    return new Observable((observer) => {
      getDocs(q)
        .then((snapshot) => {
          const data = snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as Venta,
          );
          observer.next(data);
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }

  getVentasPorAnio$(anio: number): Observable<Venta[]> {
    const ventasRef = collection(this.firestore, this.COLLECTION_NAME);
    const inicio = new Date(anio, 0, 1, 0, 0, 0, 0);
    const fin = new Date(anio, 11, 31, 23, 59, 59, 999);

    const q = query(
      ventasRef,
      where('fechaVenta', '>=', inicio),
      where('fechaVenta', '<=', fin),
    );

    return new Observable((observer) => {
      getDocs(q)
        .then((snapshot) => {
          const data = snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as Venta,
          );
          observer.next(data);
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }

  getVentasPorRangoFecha(inicio: Date, fin: Date): Observable<Venta[]> {
    const ventasRef = collection(this.firestore, this.COLLECTION_NAME);
    const q = query(
      ventasRef,
      where('fechaVenta', '>=', inicio),
      where('fechaVenta', '<=', fin),
    );

    return new Observable((observer) => {
      getDocs(q)
        .then((snapshot) => {
          const data = snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as Venta,
          );
          observer.next(data);
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }

  getVentas$(): Observable<Venta[]> {
    return this.ventas$;
  }

  async buscarVentaOriginal(
    productoDevueltoId: string,
  ): Promise<Venta | undefined> {
    const ventasRef = collection(this.firestore, this.COLLECTION_NAME);
    const q = query(ventasRef, where('id', '==', productoDevueltoId));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Venta;
    }
    return undefined;
  }

  async obtenerVentasPorZapatoId(zapatoId: number): Promise<any[]> {
    const ventasRef = collection(this.firestore, 'ventas');
    const q = query(ventasRef, where('zapatoId', '==', zapatoId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  resetVentas(): void {
    this.ventasSub?.unsubscribe();
    this.ventasSubject.next([]);
    this.isInitializednormal = false;
    this.hasMoreAntiguas = true;
    this.cursorAntiguas = null;
  }

  async agregarVentaYEliminarPedido(
    venta: Venta,
    pedidoId: string,
  ): Promise<boolean> {
    try {
      const usuario = this.authService.getCurrentUser();
      if (!usuario) {
        console.error('No hay usuario autenticado');
        return false;
      }

      const ventaLimpia = Object.fromEntries(
        Object.entries({
          ...venta,
          zapatoId: Number(venta.zapatoId),
          vendedor: usuario.name,
          vendedorId: usuario.id,
        }).filter(([, v]) => v !== undefined),
      );

      const batch = writeBatch(this.firestore);

      const ventaRef = doc(collection(this.firestore, this.COLLECTION_NAME));
      batch.set(ventaRef, ventaLimpia);

      const pedidoRef = doc(this.firestore, 'pedidos', pedidoId);
      batch.delete(pedidoRef);

      await batch.commit();

      if (venta.numCliente) {
        const link = this.generarLinkWhatsApp(venta);
        window.open(link, '_blank');
      }

      return true;
    } catch (e) {
      console.error('Batch venta falló:', e);
      return false;
    }
  }

  async agregarVenta(venta: Venta): Promise<boolean> {
    const usuario = this.authService.getCurrentUser();
    if (!usuario) {
      console.error('No hay usuario autenticado');
      return false;
    }

    try {
      const ventasRef = collection(this.firestore, this.COLLECTION_NAME);

      const ventaLimpia = Object.fromEntries(
        Object.entries({
          ...venta,
          zapatoId: Number(venta.zapatoId),
          vendedor: usuario.name,
          vendedorId: usuario.id,
        }).filter(([, v]) => v !== undefined),
      );

      await addDoc(ventasRef, ventaLimpia);

      if (venta.numCliente) {
        const link = this.generarLinkWhatsApp(venta);
        window.open(link, '_blank');
      }

      return true;
    } catch (error) {
      console.error('Error al agregar la venta en Firestore:', error);
      return false;
    }
  }

  async actualizarVentaPorId(
    id: string,
    datosActualizados: Partial<Venta>,
  ): Promise<boolean> {
    try {
      if (!id) {
        console.error('ID de la venta no proporcionado');
        return false;
      }

      const q = query(
        collection(this.firestore, this.COLLECTION_NAME),
        where('id', '==', id),
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.error(`La venta con ID ${id} no existe.`);
        return false;
      }

      const datosFiltrados = Object.fromEntries(
        Object.entries(datosActualizados).filter(([, v]) => v !== undefined),
      );

      await updateDoc(snapshot.docs[0].ref, datosFiltrados);
      return true;
    } catch (error) {
      console.error('Error al actualizar la venta:', error);
      return false;
    }
  }

  async actualizarVentaPorDocId(
    docId: string,
    datosActualizados: Partial<Venta>,
  ): Promise<boolean> {
    try {
      if (!docId) {
        console.error('DocID no proporcionado');
        return false;
      }

      const datosFiltrados = Object.fromEntries(
        Object.entries(datosActualizados).filter(([, v]) => v !== undefined),
      );

      const ref = doc(this.firestore, this.COLLECTION_NAME, docId);

      await updateDoc(ref, datosFiltrados);

      return true;
    } catch (error) {
      console.error('Error al actualizar por docId:', error);
      return false;
    }
  }

  generarLinkWhatsApp(venta: Venta): string {
    const marca = venta.marca;
    const referencia = venta.referencia || '';
    const talla = venta.talla || '';
    const valor =
      venta.precio?.toLocaleString('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
      }) || '';
    const fechaVenta = new Date(venta.fechaVenta).toLocaleDateString('es-CO');
    const local = venta.local || '';
    const numero = '+57' + venta.numCliente;

    let mensajeCredito = '';
    const tipo = venta.metodoPago?.toLowerCase() || '';

    if (tipo === 'sistecredito') {
      mensajeCredito = `
💳 *Compra realizada con Sistecrédito*  
Puedes pagar tus cuotas directamente en nuestro local o desde la plataforma oficial de Sistecrédito.`;
    } else if (tipo === 'addi') {
      mensajeCredito = `
💳 *Compra realizada con Addi*  
Puedes realizar los pagos de tus cuotas en nuestro local o a través de la plataforma oficial de Addi.`;
    }

    const mensaje = `Hola, te saludamos desde *ShoeShop*.  
Hemos generado tu factura de venta correspondiente a tu compra reciente.  
Nuestro compromiso es brindarte una experiencia clara, confiable y acompañarte en cada paso de tu proceso de compra. 🤝

🏷️ *Marca:* ${marca}
🧾 *Referencia:* ${referencia}
📏 *Talla:* ${talla}
💵 *Valor:* ${valor}
📅 *Garantía:* 1 mes por despegue o descosido desde el ${fechaVenta}
🔁 *Cambios de talla:* 8 días (siempre que no haya sido usado)
📍 *Local:* ${local}
${mensajeCredito}

Si tienes alguna inquietud o deseas hacer seguimiento a tu garantía o pago, estaremos atentos para ayudarte.  

📲 Catálogo para futuras compras: https://your-app.example.com/catalogo
¡Gracias por elegirnos! 🖤`;

    const mensajeCodificado = encodeURIComponent(mensaje);
    return `https://api.whatsapp.com/send?phone=${numero}&text=${mensajeCodificado}`;
  }

  async buscarVentaPorId(id: string): Promise<Venta | undefined> {
    const ventaRef = doc(this.firestore, this.COLLECTION_NAME, id);
    const ventaDoc = await getDoc(ventaRef);

    return ventaDoc.exists()
      ? ({ id: ventaDoc.id, ...ventaDoc.data() } as Venta)
      : undefined;
  }

  async idExiste(id: string): Promise<boolean> {
    const ventaRef = doc(this.firestore, this.COLLECTION_NAME, id);
    const ventaDoc = await getDoc(ventaRef);
    return ventaDoc.exists();
  }

  async obtenerVentasPorCredito(
    credito: 'sistecredito' | 'addi',
  ): Promise<Venta[]> {
    try {
      const cuatroMesesAtras = new Date();
      cuatroMesesAtras.setMonth(cuatroMesesAtras.getMonth() - 4);
      cuatroMesesAtras.setHours(0, 0, 0, 0);

      const ventasRef = collection(this.firestore, this.COLLECTION_NAME);
      const q = query(
        ventasRef,
        where('metodoPago', '==', credito),
        where('fechaVenta', '>=', cuatroMesesAtras),
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Venta,
      );
    } catch (error) {
      console.error('Error al obtener ventas por crédito:', error);
      return [];
    }
  }

  async eliminarVentaPorId(id: string): Promise<boolean> {
    try {
      if (!id) {
        console.error('ID de la venta no proporcionado');
        return false;
      }

      const ventaRef = doc(this.firestore, this.COLLECTION_NAME, id);
      const ventaDoc = await getDoc(ventaRef);

      if (!ventaDoc.exists()) {
        console.error(`La venta con ID ${id} no existe.`);
        return false;
      }

      await deleteDoc(ventaRef);

      return true;
    } catch (error) {
      console.error('Error al eliminar la venta:', error);
      return false;
    }
  }

  async eliminarVentaPorCampoId(id: string): Promise<boolean> {
    try {
      if (!id) {
        console.error('ID de la venta no proporcionado');
        return false;
      }

      const q = query(
        collection(this.firestore, this.COLLECTION_NAME),
        where('id', '==', id),
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.error(`La venta con ID ${id} no existe.`);
        return false;
      }

      await deleteDoc(snapshot.docs[0].ref);

      return true;
    } catch (error) {
      console.error('Error al eliminar la venta:', error);
      return false;
    }
  }

  getVentasSemana(fechaReferencia: Date = new Date()): Observable<Venta[]> {
    const ventasRef = collection(this.firestore, this.COLLECTION_NAME);

    const dia = fechaReferencia.getDay();
    const inicioSemana = new Date(fechaReferencia);
    inicioSemana.setDate(fechaReferencia.getDate() - dia);
    inicioSemana.setHours(0, 0, 0, 0);

    const finSemana = new Date(inicioSemana);
    finSemana.setDate(inicioSemana.getDate() + 6);
    finSemana.setHours(23, 59, 59, 999);

    const q = query(
      ventasRef,
      where('fechaVenta', '>=', inicioSemana),
      where('fechaVenta', '<=', finSemana),
    );

    return enContexto(this._inj, () => collectionData(q, { idField: 'id' })).pipe(
      map(
        (ventas: any[]) =>
          ventas
            .map((venta) => ({
              ...venta,
              fechaVenta: venta.fechaVenta?.toDate?.() ?? venta.fechaVenta,
            }))
            .filter(
              (venta) =>
                venta.tipoVenta !== 'Devuelto por cambio' &&
                venta.tipoVenta !== 'Devuelto por bono',
            ) as Venta[],
      ),
    );
  }

  getResumenAnual$(
    anio: number,
  ): Observable<Record<number, { total: number; cantidad: number }> | null> {
    const ref = doc(this.firestore, 'resumenesVentas', String(anio));
    return enContexto(this._inj, () => docData(ref)).pipe(map((data: any) => data?.meses ?? null));
  }
}
