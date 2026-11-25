import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { llamarIA, IaPeticion, Perfil } from './core';

export const GROQ_API_KEY = defineSecret('GROQ_API_KEY');
export const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

type Funcion =
  | 'chat'
  | 'consejo'
  | 'alertas'
  | 'ranking'
  | 'mapa'
  | 'vision'
  | 'busquedaWeb'
  | 'cuadre'
  | 'memoria'
  | 'resumen';

/** Quién puede usar cada función de IA y con qué perfil de modelo se atiende. */
const POLITICAS: Record<Funcion, { roles: string[]; perfil: Perfil; maxTokens: number }> = {
  chat: { roles: ['admin'], perfil: 'analisis', maxTokens: 2500 },
  cuadre: { roles: ['admin'], perfil: 'analisis', maxTokens: 1500 },
  ranking: { roles: ['admin'], perfil: 'analisis', maxTokens: 1000 },
  mapa: { roles: ['admin'], perfil: 'analisis', maxTokens: 1000 },
  alertas: { roles: ['admin'], perfil: 'rapido', maxTokens: 600 },
  memoria: { roles: ['admin'], perfil: 'rapido', maxTokens: 800 },
  resumen: { roles: ['admin'], perfil: 'rapido', maxTokens: 800 },
  consejo: { roles: ['admin', 'vendedor', 'bodega'], perfil: 'rapido', maxTokens: 600 },
  vision: { roles: ['admin', 'vendedor', 'bodega'], perfil: 'vision', maxTokens: 2500 },
  busquedaWeb: { roles: ['admin', 'vendedor', 'bodega'], perfil: 'rapido', maxTokens: 1000 },
};

const LIMITE_POR_MINUTO: Record<string, number> = { admin: 60, vendedor: 20, bodega: 20 };
const MAX_MENSAJES = 40;
const MAX_CARACTERES = 120_000;

const cachePerfiles = new Map<string, { en: number; rol: string; activo: boolean }>();

async function perfilUsuario(uid: string): Promise<{ rol: string; activo: boolean }> {
  const hit = cachePerfiles.get(uid);
  if (hit && Date.now() - hit.en < 60_000) return { rol: hit.rol, activo: hit.activo };

  const snap = await db.doc(`usuarios/${uid}`).get();
  const d = snap.data();
  const rol = String(d?.['role'] ?? '').toLowerCase();
  const activo = d?.['active']?.value !== false && snap.exists;
  cachePerfiles.set(uid, { en: Date.now(), rol, activo });
  return { rol, activo };
}

/** Limita las consultas por usuario y por minuto para cuidar el costo. */
async function verificarLimite(uid: string, rol: string): Promise<void> {
  const ventana = Math.floor(Date.now() / 60_000);
  const ref = db.doc(`iaLimites/${uid}`);
  const max = LIMITE_POR_MINUTO[rol] ?? 10;

  await db.runTransaction(async (t) => {
    const s = await t.get(ref);
    const d = s.data();
    const n = d?.['ventana'] === ventana ? Number(d?.['n'] ?? 0) : 0;
    if (n >= max) {
      throw new HttpsError(
        'resource-exhausted',
        'Demasiadas consultas seguidas. Espera un momento e intenta de nuevo.',
      );
    }
    t.set(ref, { ventana, n: n + 1 });
  });
}

function tamano(mensajes: any[]): number {
  try {
    return JSON.stringify(mensajes).length;
  } catch {
    return Infinity;
  }
}

/**
 * Puerta única de IA. El navegador manda la pregunta y recibe la respuesta;
 * las llaves de Groq y Gemini nunca salen del servidor.
 */
export const iaChat = onCall(
  {
    secrets: [GROQ_API_KEY, GEMINI_API_KEY],
    region: 'us-central1',
    timeoutSeconds: 180,
    memory: '512MiB',
    maxInstances: 10,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    const uid = request.auth.uid;

    const data = (request.data ?? {}) as {
      funcion?: Funcion;
      messages?: any[];
      tools?: any[];
      temperature?: number;
      max_tokens?: number;
      json?: boolean;
      modelo?: string;
    };

    const funcion = data.funcion;
    const politica = funcion ? POLITICAS[funcion] : undefined;
    if (!funcion || !politica) {
      throw new HttpsError('invalid-argument', 'Función de IA no válida.');
    }

    const { rol, activo } = await perfilUsuario(uid);
    if (!activo || !politica.roles.includes(rol)) {
      throw new HttpsError('permission-denied', 'No tienes permiso para usar esta función.');
    }

    if (!Array.isArray(data.messages) || data.messages.length === 0) {
      throw new HttpsError('invalid-argument', 'Faltan los mensajes.');
    }
    if (data.messages.length > MAX_MENSAJES || tamano(data.messages) > MAX_CARACTERES) {
      throw new HttpsError('invalid-argument', 'La conversación es demasiado larga.');
    }
    if (data.tools && (!Array.isArray(data.tools) || data.tools.length > 60)) {
      throw new HttpsError('invalid-argument', 'Herramientas no válidas.');
    }

    await verificarLimite(uid, rol);

    const peticion: IaPeticion = {
      perfil: politica.perfil,
      messages: data.messages,
      tools: data.tools,
      temperature:
        typeof data.temperature === 'number'
          ? Math.min(Math.max(data.temperature, 0), 1.2)
          : undefined,
      max_tokens: Math.min(Number(data.max_tokens) || politica.maxTokens, politica.maxTokens),
      json: !!data.json,
      modeloPreferido: funcion === 'chat' ? data.modelo : undefined,
    };

    const inicio = Date.now();
    try {
      const r = await llamarIA(peticion, {
        groq: GROQ_API_KEY.value(),
        gemini: GEMINI_API_KEY.value(),
      });

      // Registro de uso para controlar costos (no bloquea la respuesta)
      db.collection('iaUso')
        .add({
          uid,
          rol,
          funcion,
          proveedor: r.proveedor,
          modelo: r.modelo,
          tokensEntrada: r.usage.prompt_tokens,
          tokensSalida: r.usage.completion_tokens,
          ms: Date.now() - inicio,
          reintentos: r.intentos.length,
          ok: true,
          fecha: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch(() => undefined);

      return {
        message: r.message,
        finish_reason: r.finish_reason ?? null,
        proveedor: r.proveedor,
        modelo: r.modelo,
        usage: r.usage,
      };
    } catch (e: any) {
      db.collection('iaUso')
        .add({
          uid,
          rol,
          funcion,
          ok: false,
          error: String(e?.message ?? e).slice(0, 400),
          ms: Date.now() - inicio,
          fecha: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch(() => undefined);
      console.error('[iaChat] error:', e?.message ?? e);
      throw new HttpsError(
        'unavailable',
        'La IA no está disponible en este momento. Intenta de nuevo en unos segundos.',
      );
    }
  },
);
