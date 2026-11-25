/**
 * Lógica pura del asistente de WhatsApp para clientes.
 *
 * Principio de seguridad: el texto del cliente NUNCA se le pasa a un modelo
 * para que "responda". Aquí solo se EXTRAE qué quiere (código, talla, intención)
 * y las respuestas las arma el código con datos reales del inventario.
 */

export type Intencion = 'consulta' | 'ubicacion' | 'precio' | 'asesor' | 'saludo' | 'desconocido';

export interface Interpretacion {
  intent: Intencion;
  codigo: number | null;
  talla: number | null;
}

export const TALLA_MIN = 28;
export const TALLA_MAX = 46;

export function normalizar(texto: string): string {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

const PALABRAS_PRECIO = /\b(precio|precios|cuanto|cuesta|vale|valor|costo|cotiza|cotizacion|descuento|rebaja|oferta)\b/;
const PALABRAS_ASESOR = /\b(asesor|asesora|vendedor|vendedora|persona|humano|hablar|llamar|llamen|comprar|compro|quiero|reservar|reserva|apartar|aparta|pedir|pedido|domicilio|envio|enviar|cambio|garantia|reclamo|queja|ayuda con)\b/;
const PALABRAS_UBICACION = /\b(donde|ubicacion|ubicados|direccion|local|locales|como llego|horario|horarios|abren|cierran|mapa|piso)\b/;
const PALABRAS_SALUDO = /\b(hola|holi|buenas|buenos dias|buen dia|buenas tardes|buenas noches|menu|ayuda|info|informacion)\b/;

export function interpretar(textoOriginal: string): Interpretacion {
  const t = normalizar(textoOriginal);

  // Talla explícita: "talla 40", "t40", "tll 40"
  let talla: number | null = null;
  const mTalla = /\b(?:talla|tallas|tll|t)\s*[:#]?\s*(\d{2})\b/.exec(t);
  if (mTalla) {
    const n = Number(mTalla[1]);
    if (n >= TALLA_MIN && n <= TALLA_MAX) talla = n;
  }

  // Código explícito: "codigo 1234", "ref 1234", "#1234"
  let codigo: number | null = null;
  const mCodigo = /(?:codigo|cod|ref|referencia|numero|nro|no\.?|#)\s*[:#]?\s*(\d{1,6})\b/.exec(t);
  if (mCodigo) codigo = Number(mCodigo[1]);

  if (codigo === null) {
    const numeros = (t.match(/\b\d{1,6}\b/g) ?? []).map(Number).filter((n) => n !== talla);
    const enRangoTalla = numeros.filter((n) => n >= TALLA_MIN && n <= TALLA_MAX);
    const otros = numeros.filter((n) => !(n >= TALLA_MIN && n <= TALLA_MAX));
    if (otros.length) {
      codigo = otros[0];
      if (talla === null && enRangoTalla.length) talla = enRangoTalla[0];
    } else if (numeros.length === 1) {
      // Un solo número: se toma como código, salvo que ya sea la talla
      codigo = numeros[0];
    } else if (numeros.length >= 2) {
      codigo = Math.max(...numeros);
      if (talla === null) talla = Math.min(...numeros);
    }
  }
  if (codigo !== null && (codigo <= 0 || codigo > 999999)) codigo = null;

  let intent: Intencion = 'desconocido';
  if (PALABRAS_PRECIO.test(t)) intent = 'precio';
  else if (PALABRAS_ASESOR.test(t)) intent = 'asesor';
  else if (PALABRAS_UBICACION.test(t)) intent = 'ubicacion';
  else if (codigo !== null) intent = 'consulta';
  else if (PALABRAS_SALUDO.test(t)) intent = 'saludo';

  return { intent, codigo, talla };
}

// ── Respuestas ─────────────────────────────────────────────────

export interface ConfigWhatsApp {
  nombreNegocio?: string;
  saludo?: string;
  direccion?: string;
  horario?: string;
  mostrarPrecio?: boolean;
}

export interface ProductoWhatsApp {
  codigo: number;
  marca: string;
  referencia: string;
  tallasDisponibles: Record<string, number>;
  precioMin?: number | null;
}

const PIE = '\n\nEscribe *asesor* si quieres hablar con una persona.';

export function textoAyuda(c: ConfigWhatsApp): string {
  const nombre = c.nombreNegocio || 'ShoeShop';
  return (
    c.saludo ||
    `¡Hola! 👋 Soy el asistente de ${nombre}.\n\nEscríbeme el *código* del zapato y, si quieres, la *talla*. Por ejemplo: "1234 talla 40".\n\nTe digo si está disponible y dónde puedes verlo.`
  ) + PIE;
}

export function tallasDe(p: ProductoWhatsApp): number[] {
  return Object.entries(p.tallasDisponibles ?? {})
    .filter(([, c]) => Number(c) > 0)
    .map(([t]) => Number(t))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

export function respuestaDisponibilidad(
  p: ProductoWhatsApp,
  talla: number | null,
  localesExhibicion: string[],
  c: ConfigWhatsApp,
): string {
  const tallas = tallasDe(p);
  const nombre = `${p.marca} ${p.referencia}`.trim();
  const lineas: string[] = [`👟 *${nombre}* (código ${p.codigo})`];

  if (!tallas.length) {
    lineas.push('Por ahora está *agotado*. Si quieres, un asesor revisa si va a llegar pronto: escribe *asesor*.');
  } else if (talla !== null) {
    if (tallas.includes(talla)) lineas.push(`✅ Sí tenemos la talla *${talla}*.`);
    else lineas.push(`❌ La talla ${talla} no está disponible por ahora.`);
    lineas.push(`Tallas disponibles: ${tallas.join(', ')}.`);
  } else {
    lineas.push(`Tallas disponibles: ${tallas.join(', ')}.`);
  }

  if (tallas.length) {
    if (localesExhibicion.length) {
      lineas.push(`📍 Puedes verlo exhibido en: ${localesExhibicion.join(', ')}.`);
    } else {
      lineas.push('📍 Lo tenemos en bodega; un asesor te lo muestra cuando vengas.');
    }
  }
  if (c.mostrarPrecio && p.precioMin) {
    lineas.push(`💲 Precio: $${Math.round(p.precioMin).toLocaleString('es-CO')}.`);
  } else if (tallas.length) {
    lineas.push('Para el precio, escribe *asesor* y te lo confirma una persona.');
  }
  return lineas.join('\n') + PIE;
}

export function respuestaUbicacion(c: ConfigWhatsApp): { texto: string; pasarAAsesor: boolean } {
  if (c.direccion) {
    return {
      texto: `📍 ${c.direccion}${c.horario ? `\n🕒 ${c.horario}` : ''}${PIE}`,
      pasarAAsesor: false,
    };
  }
  return {
    texto: 'Con gusto te compartimos la ubicación exacta. Ya avisé a un asesor para que te escriba. 🙌',
    pasarAAsesor: true,
  };
}

export const RESPUESTA_NO_ENTIENDO =
  'No logré entender tu mensaje 🤔\nEscríbeme el *código* del zapato (y la talla si quieres), por ejemplo: "1234 talla 40". O escribe *asesor* para hablar con una persona.';

export const RESPUESTA_PASAR_ASESOR =
  'Listo ✅ Ya avisé a un asesor. Te escribirá por este mismo chat en unos minutos.';
