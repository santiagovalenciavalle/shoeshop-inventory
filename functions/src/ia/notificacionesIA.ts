import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

export type SeveridadIA = 'alta' | 'media' | 'info';

/**
 * Pantallas a las que puede llevar una notificación. La app las traduce a rutas y filtros;
 * así el servidor no depende de cómo estén organizadas las URL.
 */
export interface DestinoNotificacion {
  /** Ruta de la app, p. ej. '/admin/locales'. */
  ruta: string;
  /**
   * Filtros que la pantalla aplica al abrirse (query params).
   * Para /admin/locales: local ('todos' o nombre), periodo (hoy|semana|mes|anio|dia), fecha (YYYY-MM-DD),
   * vendedor, codigo (código de producto) y precioBajo ('1' = solo ventas bajo el precio mínimo).
   */
  params?: Record<string, string>;
}

export interface NotificacionIA extends DestinoNotificacion {
  /** Id estable: si ya existe no se vuelve a crear (evita avisar dos veces por lo mismo). */
  id: string;
  tipo: string;
  severidad: SeveridadIA;
  titulo: string;
  descripcion: string;
  /** Datos extra para mostrar en la lista (opcional). */
  extra?: Record<string, unknown>;
}

/** Guarda la notificación en el centro de la app. Devuelve false si ya existía. */
export async function crearNotificacionIA(n: NotificacionIA): Promise<boolean> {
  const limpio = (o: Record<string, unknown> | undefined) =>
    o ? Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) : {};
  try {
    await db.doc(`notificacionesIA/${n.id}`).create({
      tipo: n.tipo,
      severidad: n.severidad,
      titulo: n.titulo,
      descripcion: n.descripcion,
      ruta: n.ruta,
      params: limpio(n.params),
      extra: limpio(n.extra),
      // Uids de los administradores que ya la leyeron: cada uno tiene su propio estado de lectura.
      leidoPor: [],
      fecha: admin.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  } catch (e: any) {
    if (e?.code === 6 || String(e?.message ?? '').includes('ALREADY_EXISTS')) return false;
    throw e;
  }
}
