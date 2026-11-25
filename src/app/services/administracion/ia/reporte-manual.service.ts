import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
} from '@angular/fire/firestore';

export interface AdminPremier {
  id: string;
  name: string;
  emailReporte: string;
  seleccionado: boolean;
}

const FUNCTION_URL =
  'https://us-central1-your-project-id.cloudfunctions.net/enviarReporteManual';

@Injectable({ providedIn: 'root' })
export class ReporteManualService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);

  async obtenerAdminsPremier(): Promise<AdminPremier[]> {
    const snap = await getDocs(
      query(
        collection(this.firestore, 'usuarios'),
        where('role', '==', 'admin'),
      ),
    );
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data['name'] ?? 'Sin nombre',
          emailReporte: data['emailReporte'] ?? '',
          seleccionado: false,
        };
      })
      .filter((a) => a.emailReporte.trim() !== ''); // ← solo los que tienen email
  }

  async enviarReporte(emails: string[]): Promise<void> {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails }),
    });

    if (!res.ok) throw new Error('Error al enviar reporte');
    const data = await res.json();
    if (!data.ok) throw new Error(data.error ?? 'Error desconocido');
  }
}
