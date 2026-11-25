import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp,
  where,
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { MensajeChat } from './ia.service';

@Injectable({ providedIn: 'root' })
export class ChatMemoriaService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  private get userId(): string {
    return this.auth.currentUser?.uid ?? 'anonimo';
  }

  private get colRef() {
    return collection(this.firestore, `chats/${this.userId}/historial`);
  }

  async guardarMensaje(msg: MensajeChat): Promise<void> {
    if (msg.cargando || !msg.contenido) return;
    await addDoc(this.colRef, {
      rol: msg.rol,
      contenido: msg.contenido,
      timestamp: Timestamp.fromDate(msg.timestamp),
    });
  }

  async cargarHistorial(limite: number = 30): Promise<MensajeChat[]> {
    const q = query(this.colRef, orderBy('timestamp', 'desc'), limit(limite));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          rol: data['rol'],
          contenido: data['contenido'],
          timestamp: data['timestamp']?.toDate() ?? new Date(),
        } as MensajeChat;
      })
      .reverse();
  }

  async limpiarHistorialViejo(): Promise<void> {
    const hace30dias = new Date();
    hace30dias.setDate(hace30dias.getDate() - 30);
    const q = query(
      this.colRef,
      where('timestamp', '<', Timestamp.fromDate(hace30dias)),
    );
    const snap = await getDocs(q);
  }
}
