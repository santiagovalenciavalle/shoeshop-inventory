import * as scheduler from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * CADUCIDAD AUTOMÁTICA DE AVISOS
 *
 * Los avisos son información efímera: pasado cierto tiempo ya no sirven y solo hacen crecer
 * las colecciones y las lecturas. Cada semana se borran los más antiguos.
 * NO toca ventas, ingresos, caja ni nada contable.
 */
interface Regla {
  coleccion: string;
  campo: string;
  /** Días de vida. */
  dias: number;
  /** Algunos campos de fecha son texto ISO en lugar de Timestamp. */
  esTexto?: boolean;
}

export const REGLAS_LIMPIEZA: Regla[] = [
  { coleccion: 'notificacionesIA', campo: 'fecha', dias: 90 },
  { coleccion: 'alertasIA', campo: 'fecha', dias: 90 },
  { coleccion: 'calendarioAvisos', campo: 'creado', dias: 180 },
  { coleccion: 'descuadresInventario', campo: 'generado', dias: 180, esTexto: true },
  { coleccion: 'notifications', campo: 'creadaEn', dias: 60 },
];

const TOPE_POR_REGLA = 5000;

async function borrarAntiguos(r: Regla): Promise<number> {
  const corte = new Date(Date.now() - r.dias * 86_400_000);
  const valor = r.esTexto ? corte.toISOString() : admin.firestore.Timestamp.fromDate(corte);
  let borrados = 0;

  while (borrados < TOPE_POR_REGLA) {
    const snap = await db.collection(r.coleccion).where(r.campo, '<', valor).limit(400).get();
    if (snap.empty) break;
    const lote = db.batch();
    snap.docs.forEach((d) => lote.delete(d.ref));
    await lote.commit();
    borrados += snap.size;
    if (snap.size < 400) break;
  }
  return borrados;
}

export const limpiezaAvisos = scheduler.onSchedule(
  { schedule: '0 3 * * 0', timeZone: 'America/Bogota', timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    for (const regla of REGLAS_LIMPIEZA) {
      try {
        const n = await borrarAntiguos(regla);
        console.log(`[limpieza] ${regla.coleccion}: ${n} documentos de más de ${regla.dias} días eliminados.`);
      } catch (e) {
        // Una regla que falla (p. ej. falta un índice) no debe frenar las demás
        console.error(`[limpieza] ${regla.coleccion} falló`, e);
      }
    }
  },
);
