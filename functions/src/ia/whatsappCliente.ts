import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { notificarAdmins } from './notificar';
import {
  ConfigWhatsApp,
  RESPUESTA_NO_ENTIENDO,
  RESPUESTA_PASAR_ASESOR,
  interpretar,
  respuestaDisponibilidad,
  respuestaUbicacion,
  textoAyuda,
} from './whatsappLogica';
import { enviarTexto, extraerMensajes, firmaValida } from './whatsappMeta';

const WHATSAPP_TOKEN = defineSecret('WHATSAPP_TOKEN');
const WHATSAPP_APP_SECRET = defineSecret('WHATSAPP_APP_SECRET');
const WHATSAPP_VERIFY_TOKEN = defineSecret('WHATSAPP_VERIFY_TOKEN');
const WHATSAPP_PHONE_ID = defineSecret('WHATSAPP_PHONE_ID');

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

const MAX_MENSAJES = 12; // por teléfono
const VENTANA_MIN = 10;
const SILENCIO_ASESOR_MIN = 30;

async function dentroDelLimite(telefono: string): Promise<boolean> {
  const ventana = Math.floor(Date.now() / (VENTANA_MIN * 60_000));
  const ref = db.doc(`whatsappLimites/${telefono.replace(/\D/g, '')}`);
  return db.runTransaction(async (t) => {
    const s = await t.get(ref);
    const n = s.data()?.['ventana'] === ventana ? Number(s.data()?.['n'] ?? 0) : 0;
    if (n >= MAX_MENSAJES) return false;
    t.set(ref, { ventana, n: n + 1 });
    return true;
  });
}

async function configuracion(): Promise<ConfigWhatsApp> {
  try {
    const s = await db.doc('config/whatsapp').get();
    return (s.data() ?? {}) as ConfigWhatsApp;
  } catch {
    return {};
  }
}

async function localesDeExhibicion(codigo: number): Promise<string[]> {
  const snap = await db.collection('exhibiciones').where('zapatoId', '==', String(codigo)).get();
  const set = new Set<string>();
  snap.forEach((d) => {
    const locales = d.data()['locales'];
    if (Array.isArray(locales)) locales.forEach((l) => l && set.add(String(l)));
  });
  return [...set].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
}

async function pasarAAsesor(telefono: string, nombre: string, motivo: string, codigo: number | null, talla: number | null, texto: string): Promise<void> {
  await db.collection('solicitudesWhatsApp').add({
    telefono,
    nombre: nombre || null,
    motivo,
    codigo,
    talla,
    mensaje: texto.slice(0, 300),
    atendida: false,
    fecha: admin.firestore.FieldValue.serverTimestamp(),
  });
  try {
    await notificarAdmins(
      '💬 Cliente por WhatsApp',
      `${nombre ? `${nombre} (${telefono})` : telefono}: ${motivo}${codigo ? ` · código ${codigo}` : ''}${talla ? ` · talla ${talla}` : ''}.`,
      { tipo: 'whatsapp-cliente', telefono },
    );
  } catch (e) {
    console.error('[whatsapp] no se pudo avisar a los administradores', e);
  }
}

/** Decide la respuesta. Devuelve null para no responder (el cliente ya espera a un asesor). */
async function procesar(telefono: string, nombre: string, texto: string): Promise<string | null> {
  const cfg = await configuracion();
  const conv = db.doc(`conversacionesWhatsApp/${telefono.replace(/\D/g, '')}`);
  const previo = (await conv.get()).data() ?? {};
  const i = interpretar(texto);

  const registrar = (extra: Record<string, any> = {}) =>
    conv.set(
      {
        telefono,
        nombre: nombre || null,
        ultimoMensaje: texto.slice(0, 200),
        ultimoCodigo: i.codigo ?? previo['ultimoCodigo'] ?? null,
        ultimaActividad: admin.firestore.FieldValue.serverTimestamp(),
        total: admin.firestore.FieldValue.increment(1),
        ...extra,
      },
      { merge: true },
    );

  // Si ya está esperando a un asesor y no pregunta algo concreto, no se le responde de nuevo
  const esperando = previo['estado'] === 'esperando-asesor';
  const hace = previo['asesorAvisadoEn']?.toMillis ? Date.now() - previo['asesorAvisadoEn'].toMillis() : Infinity;
  if (esperando && i.codigo === null && i.intent !== 'asesor' && hace < SILENCIO_ASESOR_MIN * 60_000) {
    await registrar();
    return null;
  }

  if (i.intent === 'saludo') {
    await registrar({ estado: 'bot' });
    return textoAyuda(cfg);
  }

  if (i.intent === 'precio' || i.intent === 'asesor') {
    const motivo = i.intent === 'precio' ? 'pregunta por precio' : 'quiere hablar con un asesor';
    await pasarAAsesor(telefono, nombre, motivo, i.codigo, i.talla, texto);
    await registrar({ estado: 'esperando-asesor', asesorAvisadoEn: admin.firestore.FieldValue.serverTimestamp() });
    return RESPUESTA_PASAR_ASESOR;
  }

  if (i.intent === 'ubicacion' && i.codigo === null) {
    const r = respuestaUbicacion(cfg);
    if (r.pasarAAsesor) {
      await pasarAAsesor(telefono, nombre, 'pregunta por la ubicación', null, null, texto);
      await registrar({ estado: 'esperando-asesor', asesorAvisadoEn: admin.firestore.FieldValue.serverTimestamp() });
    } else {
      await registrar({ estado: 'bot' });
    }
    return r.texto;
  }

  if (i.codigo !== null) {
    const prod = await db.doc(`productos/${i.codigo}`).get();
    if (!prod.exists) {
      await registrar({ estado: 'bot' });
      return `No encontré el código ${i.codigo} 🤔\nRevisa el número (lo ves en la etiqueta o en el catálogo) e inténtalo de nuevo. Si prefieres, escribe *asesor*.`;
    }
    const d = prod.data()!;
    const locales = await localesDeExhibicion(i.codigo);
    await registrar({ estado: 'bot' });
    return respuestaDisponibilidad(
      {
        codigo: i.codigo,
        marca: String(d['marca'] ?? ''),
        referencia: String(d['referencia'] ?? ''),
        tallasDisponibles: (d['tallasDisponibles'] ?? {}) as Record<string, number>,
        precioMin: d['precioMin'] ?? null,
      },
      i.talla,
      locales,
      cfg,
    );
  }

  await registrar({ estado: 'bot' });
  return RESPUESTA_NO_ENTIENDO;
}

/**
 * Webhook de la API oficial de WhatsApp (Meta Cloud API).
 *  - GET  : verificación del webhook (Meta envía hub.challenge).
 *  - POST : mensajes entrantes de clientes.
 */
export const whatsappCliente = onRequest(
  {
    region: 'us-central1',
    secrets: [WHATSAPP_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN, WHATSAPP_PHONE_ID],
    timeoutSeconds: 30,
    memory: '256MiB',
    maxInstances: 5,
  },
  async (req, res) => {
    // Verificación inicial que pide Meta al registrar el webhook
    if (req.method === 'GET') {
      const ok =
        req.query['hub.mode'] === 'subscribe' &&
        String(req.query['hub.verify_token'] ?? '') === WHATSAPP_VERIFY_TOKEN.value();
      if (ok) res.status(200).send(String(req.query['hub.challenge'] ?? ''));
      else res.status(403).send('Token de verificación incorrecto');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).send('Método no permitido');
      return;
    }

    // Solo Meta puede escribirle a este endpoint: se valida su firma
    if (!firmaValida(req.rawBody, req.get('x-hub-signature-256'), WHATSAPP_APP_SECRET.value())) {
      console.warn('[whatsapp] firma inválida');
      res.status(403).send('Firma inválida');
      return;
    }

    const mensajes = extraerMensajes(req.body);
    for (const m of mensajes) {
      try {
        // Meta reintenta los avisos que no se confirman: así nunca se responde dos veces
        try {
          await db.doc(`whatsappMensajes/${m.id.replace(/[^A-Za-z0-9=_-]/g, '_').slice(0, 120)}`).create({
            fecha: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch {
          continue;
        }

        let respuesta: string | null;
        if (!(await dentroDelLimite(m.telefono))) {
          respuesta = 'Estás escribiendo muy rápido 😅 Espera unos minutos e inténtalo de nuevo, o escribe *asesor*.';
        } else if (m.tipo !== 'text' || !m.texto.trim()) {
          respuesta = 'Por ahora solo entiendo mensajes de texto 🙏 Escríbeme el *código* del zapato, o *asesor* para hablar con una persona.';
        } else {
          respuesta = await procesar(m.telefono, m.nombre, m.texto);
        }
        if (respuesta) {
          await enviarTexto(WHATSAPP_PHONE_ID.value(), WHATSAPP_TOKEN.value(), m.telefono, respuesta);
        }
      } catch (e) {
        console.error('[whatsapp] error con el mensaje', m.id, e);
        try {
          await enviarTexto(
            WHATSAPP_PHONE_ID.value(),
            WHATSAPP_TOKEN.value(),
            m.telefono,
            'Tuve un problema para consultar eso 🙏 Escribe *asesor* y una persona te atiende.',
          );
        } catch {
          /* si tampoco se puede avisar, queda en los registros */
        }
      }
    }
    // Siempre se confirma a Meta para que no reenvíe el aviso
    res.status(200).send('ok');
  },
);
