import {
  Injectable,
  Injector,
  NgZone,
  inject,
  runInInjectionContext,
} from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  arrayUnion,
  updateDoc,
  writeBatch,
  Unsubscribe,
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { AuthService } from '../../auth/auth.service';

export type SeveridadNotificacion = 'alta' | 'media' | 'info';

export interface NotificacionIA {
  id: string;
  tipo: string;
  severidad: SeveridadNotificacion;
  titulo: string;
  descripcion: string;
  /** Ruta de la app a la que lleva al hacer clic. */
  ruta: string;
  /** Filtros que la pantalla destino aplica al abrirse (query params). */
  params: Record<string, string>;
  /** Si el administrador actual ya la leyó. */
  leida: boolean;
  fecha: Date | null;
}

/**
 * Centro de notificaciones de la IA. Las crea el servidor (colección `notificacionesIA`)
 * y aquí solo se leen en tiempo real y se marcan como leídas.
 */
@Injectable({ providedIn: 'root' })
export class NotificacionesIaService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private zone = inject(NgZone);
  private auth = inject(AuthService);

  /** Cada administrador lleva su propio estado de lectura (campo `leidoPor` con los uids). */
  private get uid(): string {
    return this.auth.getCurrentUser()?.id ?? '';
  }

  private readonly subject = new BehaviorSubject<NotificacionIA[]>([]);
  private unsub: Unsubscribe | null = null;
  private usuarios = 0;

  readonly notificaciones$: Observable<NotificacionIA[]> =
    this.subject.asObservable();
  readonly noLeidas$: Observable<number> = this.notificaciones$.pipe(
    map((l) => l.filter((n) => !n.leida).length),
  );

  /** Empieza a escuchar. Cada componente que lo use debe llamar a `detener()` al destruirse. */
  escuchar(): void {
    this.usuarios++;
    if (this.unsub) return;
    runInInjectionContext(this.injector, () => {
      const q = query(
        collection(this.firestore, 'notificacionesIA'),
        orderBy('fecha', 'desc'),
        limit(100),
      );
      this.unsub = onSnapshot(
        q,
        (snap) => {
          const uid = this.uid;
          const lista = snap.docs.map((d) => {
            const x = d.data() as any;
            return {
              id: d.id,
              tipo: x.tipo ?? '',
              severidad: (x.severidad ?? 'info') as SeveridadNotificacion,
              titulo: x.titulo ?? '',
              descripcion: x.descripcion ?? '',
              ruta: x.ruta ?? '',
              params: (x.params ?? {}) as Record<string, string>,
              leida:
                !!uid &&
                Array.isArray(x.leidoPor) &&
                x.leidoPor.includes(uid),
              fecha: x.fecha?.toDate ? (x.fecha.toDate() as Date) : null,
            } satisfies NotificacionIA;
          });
          this.zone.run(() => this.subject.next(lista));
        },
        (e) => console.error('No se pudieron leer las notificaciones', e),
      );
    });
  }

  detener(): void {
    this.usuarios = Math.max(0, this.usuarios - 1);
    if (this.usuarios === 0 && this.unsub) {
      this.unsub();
      this.unsub = null;
    }
  }

  async marcarLeida(id: string): Promise<void> {
    const uid = this.uid;
    if (!uid) return;
    await runInInjectionContext(this.injector, () =>
      updateDoc(doc(this.firestore, 'notificacionesIA', id), {
        leidoPor: arrayUnion(uid),
      }),
    );
  }

  async marcarTodasLeidas(): Promise<void> {
    const uid = this.uid;
    const pendientes = this.subject.value.filter((n) => !n.leida);
    if (!uid || !pendientes.length) return;
    await runInInjectionContext(this.injector, async () => {
      for (let i = 0; i < pendientes.length; i += 400) {
        const batch = writeBatch(this.firestore);
        pendientes
          .slice(i, i + 400)
          .forEach((n) =>
            batch.update(doc(this.firestore, 'notificacionesIA', n.id), {
              leidoPor: arrayUnion(uid),
            }),
          );
        await batch.commit();
      }
    });
  }
}
