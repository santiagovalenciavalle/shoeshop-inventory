import { Injectable, inject, Injector } from '@angular/core';
import { PagosConfig } from '../../../pages/interfaces';
import { BehaviorSubject, catchError, from, Observable, tap } from 'rxjs';
import { doc, docData, Firestore, setDoc } from '@angular/fire/firestore';
import { enContexto } from '../../../shared/utils/firestore-contexto';
type TipoPago = 'bodega' | 'vendedor' | 'patinador' | 'comision';
@Injectable({
  providedIn: 'root',
})
export class EmployeePaymentsService {
  private readonly _inj = inject(Injector);

  pagosGlobales: {
    label: string;
    tipo: TipoPago;
    editar: boolean;
    value: number;
  }[] = [];
  private readonly COLLECTION_NAME = 'pagos';
  private readonly DOC_ID = 'configNomina';

  private pagosSubject = new BehaviorSubject<PagosConfig>({
    pagoDiarioBodega: 0,
    pagoDiarioVendedor: 0,
    pagoDiarioPatinador: 0,
    comisionPorZapato: 0,
  });

  pagos$: Observable<PagosConfig> = this.pagosSubject.asObservable();

  constructor(private firestore: Firestore) {
    const docRef = doc(this.firestore, this.COLLECTION_NAME, this.DOC_ID);

    enContexto(this._inj, () => docData(docRef)).subscribe({
      next: (data) => {
        if (data) {
          this.pagosSubject.next(data as PagosConfig);
        } else {
          setDoc(docRef, this.pagosSubject.getValue()).catch((err) =>
            console.error('Error creando documento pagos:', err),
          );
        }
      },
      error: (err) =>
        console.error('Error al escuchar pagos en Firebase:', err),
    });
  }

  guardarPagos(pagos: PagosConfig): Observable<void> {
    const docRef = doc(this.firestore, this.COLLECTION_NAME, this.DOC_ID);

    return from(setDoc(docRef, pagos)).pipe(
      tap(() => {
        this.pagosSubject.next(pagos);
      }),
      catchError((err) => {
        console.error('Error guardando pagos en Firebase:', err);
        throw err;
      }),
    );
  }

  obtenerPagos(): PagosConfig {
    return this.pagosSubject.getValue();
  }
}
