import * as crypto from 'crypto';

/**
 * Utilidades puras para la API oficial de WhatsApp (Meta Cloud API).
 */

/** Valida la firma X-Hub-Signature-256 con el App Secret sobre el cuerpo crudo. */
export function firmaValida(cuerpoCrudo: Buffer | string | undefined, cabecera: string | undefined, appSecret: string): boolean {
  if (!cuerpoCrudo || !cabecera || !appSecret) return false;
  const esperado =
    'sha256=' + crypto.createHmac('sha256', appSecret).update(cuerpoCrudo).digest('hex');
  const a = Buffer.from(esperado);
  const b = Buffer.from(cabecera);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export interface MensajeEntrante {
  id: string;
  /** Teléfono del cliente, solo dígitos con indicativo (ej. 573001234567). */
  telefono: string;
  nombre: string;
  tipo: string;
  texto: string;
}

/** Extrae los mensajes de un aviso (webhook) de Meta, ignorando estados de entrega. */
export function extraerMensajes(body: any): MensajeEntrante[] {
  const salida: MensajeEntrante[] = [];
  const entradas = Array.isArray(body?.entry) ? body.entry : [];
  for (const entrada of entradas) {
    for (const cambio of Array.isArray(entrada?.changes) ? entrada.changes : []) {
      const valor = cambio?.value;
      if (!valor || !Array.isArray(valor.messages)) continue;
      const nombres = new Map<string, string>();
      for (const c of Array.isArray(valor.contacts) ? valor.contacts : []) {
        if (c?.wa_id) nombres.set(String(c.wa_id), String(c?.profile?.name ?? ''));
      }
      for (const m of valor.messages) {
        if (!m?.id || !m?.from) continue;
        const from = String(m.from).replace(/\D/g, '');
        salida.push({
          id: String(m.id),
          telefono: from,
          nombre: (nombres.get(from) ?? '').slice(0, 60),
          tipo: String(m.type ?? ''),
          texto: m.type === 'text' ? String(m?.text?.body ?? '').slice(0, 500) : '',
        });
      }
    }
  }
  return salida;
}

/** Envía un mensaje de texto por la API de Meta. */
export async function enviarTexto(
  phoneNumberId: string,
  token: string,
  para: string,
  mensaje: string,
): Promise<void> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: para,
      type: 'text',
      text: { preview_url: false, body: mensaje.slice(0, 4000) },
    }),
  });
  if (!res.ok) {
    const detalle = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`Meta respondió ${res.status}: ${detalle}`);
  }
}
