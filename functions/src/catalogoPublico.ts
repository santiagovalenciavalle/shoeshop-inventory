import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Campos de `productos` que son seguros para mostrar en el catálogo público.
 * NUNCA agregar aquí precioAdquisicion, precioMin, valorInventario, stockInicial,
 * fila, pl ni nada de costos / ubicación interna.
 */
export const CAMPOS_PUBLICOS = [
  'id',
  'marca',
  'referencia',
  'imagen',
  'imagenes',
  'tallasDisponibles',
  'precioPremier',
  'descuento',
  'color',
  'material',
  'descripcion',
] as const;

export function proyectarPublico(data: FirebaseFirestore.DocumentData): Record<string, unknown> {
  const publico: Record<string, unknown> = {};
  for (const campo of CAMPOS_PUBLICOS) {
    if (data[campo] !== undefined) publico[campo] = data[campo];
  }
  // Solo se publica si hay stock; el catálogo filtra por `stock > 0`.
  publico['stock'] = Number(data['stock'] ?? 0);
  return publico;
}

/**
 * Un producto se publica si tiene stock y ya tiene precio mínimo y costo configurados
 * (la misma regla que usa el catálogo interno para mostrarlo). Los precios NO se publican:
 * solo se usan aquí para decidir.
 */
export function esPublicable(data: FirebaseFirestore.DocumentData): boolean {
  return Number(data['stock'] ?? 0) > 0 && !!data['precioMin'] && !!data['precioAdquisicion'];
}

/**
 * Mantiene `catalogo_publico/{id}` sincronizado con `productos/{id}`.
 * Cada venta, cambio de tallas, precio o foto se refleja casi en tiempo real.
 * Si el producto se borra o se agota, se elimina del catálogo público.
 */
export const sincronizarCatalogoPublico = onDocumentWritten(
  { document: 'productos/{productoId}', region: 'us-central1', memory: '256MiB' },
  async (event) => {
    const id = event.params.productoId;
    const destino = db.collection('catalogo_publico').doc(id);

    const despues = event.data?.after;
    if (!despues || !despues.exists) {
      await destino.delete();
      return;
    }

    const data = despues.data() ?? {};
    if (!esPublicable(data)) {
      await destino.delete();
      return;
    }

    await destino.set(proyectarPublico(data));
  },
);
