import { Injectable } from '@angular/core';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';

const COLLECTION = 'configuracion';
const DOC_ID = 'sin_activacion_llegada';

@Injectable({
  providedIn: 'root',
})
export class SinActivacionService {
  private idsSubject = new BehaviorSubject<string[]>([]);
  ids$ = this.idsSubject.asObservable();

  constructor(private firestore: Firestore) {}

  async cargarIds(): Promise<void> {
    const ref = doc(this.firestore, COLLECTION, DOC_ID);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      this.idsSubject.next(data['ids'] ?? []);
    } else {
      this.idsSubject.next([]);
    }
  }

  async guardarIds(ids: string[]): Promise<void> {
    const ref = doc(this.firestore, COLLECTION, DOC_ID);
    await setDoc(ref, { ids });
    this.idsSubject.next(ids);
  }

  get idsActuales(): string[] {
    return this.idsSubject.getValue();
  }
}
