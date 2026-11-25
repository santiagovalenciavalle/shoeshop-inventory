import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  Timestamp,
} from '@angular/fire/firestore';

export interface RegistroLlegada {
  id?: string;
  nombre: string;
  trabajadorId: string;
  local: string;
  fecha: string;
  hora: string;
  rol: string;
  timestamp: Timestamp;
}

@Injectable({
  providedIn: 'root',
})
export class LlegadasService {
  private readonly COLLECTION = 'llegadas';

  constructor(private firestore: Firestore) {}

  async registrarLlegada(
    data: Omit<RegistroLlegada, 'timestamp' | 'id'>,
  ): Promise<void> {
    const llegadasRef = collection(this.firestore, this.COLLECTION);
    await addDoc(llegadasRef, {
      ...data,
      timestamp: Timestamp.now(),
    });
  }

  async yaRegistroHoy(trabajadorId: string): Promise<boolean> {
    const hoy = new Date();
    const inicioDia = new Date(
      hoy.getFullYear(),
      hoy.getMonth(),
      hoy.getDate(),
    );

    // Solo las llegadas de HOY (unas pocas), no todo el historial del trabajador.
    // Se filtra por fecha en el servidor y por trabajador aquí, para no exigir un índice compuesto.
    const llegadasRef = collection(this.firestore, this.COLLECTION);
    const q = query(
      llegadasRef,
      where('timestamp', '>=', Timestamp.fromDate(inicioDia)),
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.some(
      (docSnap) => docSnap.data()['trabajadorId'] === trabajadorId,
    );
  }

  async getLlegadasPorFecha(fecha: Date): Promise<RegistroLlegada[]> {
    const inicioDia = new Date(
      fecha.getFullYear(),
      fecha.getMonth(),
      fecha.getDate(),
    );
    const finDia = new Date(
      fecha.getFullYear(),
      fecha.getMonth(),
      fecha.getDate() + 1,
    );

    // Solo las llegadas del día pedido (antes se leía la colección completa y se filtraba aquí)
    const llegadasRef = collection(this.firestore, this.COLLECTION);
    const snapshot = await getDocs(
      query(
        llegadasRef,
        where('timestamp', '>=', Timestamp.fromDate(inicioDia)),
        where('timestamp', '<', Timestamp.fromDate(finDia)),
      ),
    );

    const registros: RegistroLlegada[] = [];

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data() as RegistroLlegada;
      const ts = data.timestamp;
      if (!ts) return;
      const fechaDoc: Date = (ts as any).toDate
        ? (ts as any).toDate()
        : new Date(ts as any);
      if (fechaDoc >= inicioDia && fechaDoc < finDia) {
        registros.push({ ...data, id: docSnap.id });
      }
    });

    return registros.sort((a, b) => {
      const tA =
        (a.timestamp as any).toDate?.() ?? new Date(a.timestamp as any);
      const tB =
        (b.timestamp as any).toDate?.() ?? new Date(b.timestamp as any);
      return tA.getTime() - tB.getTime();
    });
  }
}
