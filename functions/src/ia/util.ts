import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

/** Solo deja pasar a administradores activos. Devuelve su uid. */
export async function exigirAdmin(request: CallableRequest<any>): Promise<string> {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  const snap = await db.doc(`usuarios/${request.auth.uid}`).get();
  const d = snap.data();
  if (!snap.exists || String(d?.['role'] ?? '').toLowerCase() !== 'admin' || d?.['active']?.value === false) {
    throw new HttpsError('permission-denied', 'Solo los administradores pueden usar esta función.');
  }
  return request.auth.uid;
}

export function aFecha(v: any): Date | null {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export const money = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CO');

/** Misma clave de vendedor que usa la pantalla de cuadre de caja. */
export function claveVendedor(idONombre: string): string {
  return String(idONombre || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60);
}

/** Venta que representa un par que salió del inventario (misma regla que `esVentaValidaParaStock`). */
export function ventaSacaPar(v: any): boolean {
  const tipo = String(v['tipoVenta'] ?? '').toLowerCase().trim();
  return tipo !== 'devuelto por bono' && tipo !== 'devuelto por cambio';
}

/** Venta real de un par para medir rotación (no cuenta bonos ni cambios de otro día). */
export function ventaCuentaRotacion(v: any): boolean {
  const tipo = String(v['tipoVenta'] ?? '').toLowerCase().trim();
  if (tipo === 'devuelto por bono' || tipo === 'devuelto por cambio' || tipo === 'bono') return false;
  if ((tipo === 'cambio' || tipo === 'cambio exhibicion') && v['esMismoDia'] === false) return false;
  return true;
}
