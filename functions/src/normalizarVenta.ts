import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * Red de seguridad: `zapatoId` de una venta SIEMPRE debe ser un número.
 * Si llega como texto ("52"), se convierte solo. Las consultas `where('zapatoId', '==', 52)`
 * no encuentran valores en texto, y eso descuadra el inventario.
 * Solo escribe cuando hay texto, por lo que no entra en bucle.
 */
export const normalizarZapatoIdVenta = onDocumentWritten(
  { document: 'ventas/{ventaId}', region: 'us-central1', memory: '256MiB' },
  async (event) => {
    const despues = event.data?.after;
    if (!despues?.exists) return;
    const valor = despues.data()?.['zapatoId'];
    if (typeof valor !== 'string') return;

    const n = Number(valor.trim());
    if (valor.trim() === '' || !Number.isFinite(n)) {
      console.warn(`[ventas] ${event.params['ventaId']} tiene un zapatoId no numérico: ${JSON.stringify(valor)}`);
      return;
    }
    await despues.ref.update({ zapatoId: n });
    console.log(`[ventas] ${event.params['ventaId']}: zapatoId "${valor}" convertido a número ${n}.`);
  },
);
