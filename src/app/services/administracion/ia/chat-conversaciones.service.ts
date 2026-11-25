import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  where,
} from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service';

export interface Conversacion {
  id: string;
  titulo: string;
  ultimoMensaje: string;
  ultimoMensajeRol: 'usuario' | 'asistente';
  fechaActualizacion: Date;
  totalMensajes: number;
  userId: string;
  vendedorId: string;
  vendedorNombre: string;
}

export interface MensajeFirestore {
  id?: string;
  rol: 'usuario' | 'asistente';
  contenido: string;
  timestamp: Date;
  cargando?: boolean;
}

const ADMIN_ID = 'rn0Km71CUbdhmvnkXjfKFEoX7hj1';

@Injectable({ providedIn: 'root' })
export class ChatConversacionesService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  private authService = inject(AuthService);

  private _conversaciones = new BehaviorSubject<Conversacion[]>([]);
  conversaciones$ = this._conversaciones.asObservable();

  private async getUserId(): Promise<string> {
    const user = this.authService.getCurrentUser();
    return user!.id;
  }

  async cargarConversaciones(): Promise<void> {
    const uid = await this.getUserId();
    const esSantiago = uid === ADMIN_ID;
    console.log('es santiago si o no:', esSantiago, 'uid:', uid);
    const q = esSantiago
      ? query(
          collection(this.firestore, 'chatConversaciones'),
          orderBy('fechaActualizacion', 'desc'),
          limit(100),
        )
      : query(
          collection(this.firestore, 'chatConversaciones'),
          where('vendedorId', '==', uid),
          orderBy('fechaActualizacion', 'desc'),
          limit(10),
        );

    const snap = await getDocs(q);
    const lista: Conversacion[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        titulo: data['titulo'] ?? 'Conversación',
        ultimoMensaje: data['ultimoMensaje'] ?? '',
        ultimoMensajeRol: data['ultimoMensajeRol'] ?? 'usuario',
        fechaActualizacion:
          data['fechaActualizacion']?.toDate?.() ?? new Date(),
        totalMensajes: data['totalMensajes'] ?? 0,
        userId: data['userId'] ?? uid,
        vendedorId: data['vendedorId'] ?? uid,
        vendedorNombre: data['vendedorNombre'] ?? 'Usuario',
      };
    });
    this._conversaciones.next(lista);
  }

  async crearConversacion(primerMensaje: string): Promise<string> {
    const uid = await this.getUserId();
    const usuario = this.authService.getCurrentUser();
    const titulo = this.generarTitulo(primerMensaje);

    const ref = await addDoc(collection(this.firestore, 'chatConversaciones'), {
      titulo,
      ultimoMensaje: primerMensaje,
      ultimoMensajeRol: 'usuario',
      fechaActualizacion: serverTimestamp(),
      totalMensajes: 1,
      userId: uid,
      vendedorId: uid,
      vendedorNombre: usuario?.name ?? 'Usuario',
    });
    await this.cargarConversaciones();
    return ref.id;
  }

  async actualizarConversacion(
    conversacionId: string,
    ultimoMensaje: string,
    rol: 'usuario' | 'asistente',
    totalMensajes: number,
  ): Promise<void> {
    const texto =
      ultimoMensaje.length > 80
        ? ultimoMensaje.substring(0, 80) + '…'
        : ultimoMensaje;

    await updateDoc(doc(this.firestore, 'chatConversaciones', conversacionId), {
      ultimoMensaje: texto,
      ultimoMensajeRol: rol,
      fechaActualizacion: serverTimestamp(),
      totalMensajes,
    });

    const lista = this._conversaciones.getValue().map((c) =>
      c.id === conversacionId
        ? {
            ...c,
            ultimoMensaje: texto,
            ultimoMensajeRol: rol,
            fechaActualizacion: new Date(),
            totalMensajes,
          }
        : c,
    );
    const idx = lista.findIndex((c) => c.id === conversacionId);
    if (idx > 0) {
      const [moved] = lista.splice(idx, 1);
      lista.unshift(moved);
    }
    this._conversaciones.next(lista);
  }

  async guardarMensaje(
    conversacionId: string,
    mensaje: MensajeFirestore,
  ): Promise<string> {
    const ref = await addDoc(
      collection(
        this.firestore,
        'chatConversaciones',
        conversacionId,
        'mensajes',
      ),
      {
        rol: mensaje.rol,
        contenido: mensaje.contenido,
        timestamp: serverTimestamp(),
      },
    );
    return ref.id;
  }

  async cargarMensajes(conversacionId: string): Promise<MensajeFirestore[]> {
    const q = query(
      collection(
        this.firestore,
        'chatConversaciones',
        conversacionId,
        'mensajes',
      ),
      orderBy('timestamp', 'asc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        rol: data['rol'],
        contenido: data['contenido'],
        timestamp: data['timestamp']?.toDate?.() ?? new Date(),
        cargando: false,
      };
    });
  }

  getConversaciones(): Conversacion[] {
    return this._conversaciones.getValue();
  }

  isAdmin(uid: string): boolean {
    return uid === ADMIN_ID;
  }

  private generarTitulo(texto: string): string {
    const limpio = texto.trim().replace(/[¿?¡!]/g, '');
    const palabras = limpio.split(/\s+/).slice(0, 6).join(' ');
    return palabras.length > 42 ? palabras.substring(0, 42) + '…' : palabras;
  }
}
