import * as admin from 'firebase-admin';

/**
 * Núcleo de IA en el servidor.
 *
 * - Habla con Groq y Gemini usando el mismo formato (OpenAI-compatible).
 * - Elige el modelo según el "perfil" de la tarea y, si uno falla (límite de
 *   uso, caída, modelo retirado), pasa automáticamente al siguiente.
 * - Las llaves viven solo aquí (secretos de Firebase), nunca en el navegador.
 */

export type Proveedor = 'groq' | 'gemini';
export type Perfil = 'rapido' | 'analisis' | 'vision';

export interface ModeloCadena {
  proveedor: Proveedor;
  modelo: string;
}

export interface IaMensaje {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: any; // string o partes (texto + imagen)
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

export interface IaPeticion {
  perfil: Perfil;
  messages: IaMensaje[];
  tools?: any[];
  tool_choice?: any;
  temperature?: number;
  max_tokens?: number;
  json?: boolean;
  /** Modelo de Groq que se prefiere probar primero (debe estar en MODELOS_PERMITIDOS). */
  modeloPreferido?: string;
}

export const MODELOS_PERMITIDOS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'llama-3.3-70b-versatile',
];

export interface IaResultado {
  message: IaMensaje & { content: string | null };
  finish_reason?: string;
  proveedor: Proveedor;
  modelo: string;
  usage: { prompt_tokens: number; completion_tokens: number };
  intentos: { proveedor: Proveedor; modelo: string; error: string }[];
}

export interface Llaves {
  groq?: string;
  gemini?: string;
}

/** Modelos por perfil, en orden de preferencia. Se pueden cambiar en Firestore: config/ia */
export const CADENAS_POR_DEFECTO: Record<Perfil, ModeloCadena[]> = {
  // Respuestas cortas y baratas: consejos, resúmenes, clasificaciones
  rapido: [
    { proveedor: 'groq', modelo: 'llama-3.3-70b-versatile' },
    { proveedor: 'gemini', modelo: 'gemini-2.5-flash' },
    { proveedor: 'groq', modelo: 'openai/gpt-oss-20b' },
  ],
  // Razonamiento y análisis con datos: chat del administrador, cuadre, finanzas
  analisis: [
    { proveedor: 'groq', modelo: 'openai/gpt-oss-120b' },
    { proveedor: 'gemini', modelo: 'gemini-2.5-flash' },
    { proveedor: 'groq', modelo: 'llama-3.3-70b-versatile' },
  ],
  // Imágenes
  vision: [
    { proveedor: 'gemini', modelo: 'gemini-2.5-flash' },
    { proveedor: 'groq', modelo: 'meta-llama/llama-4-scout-17b-16e-instruct' },
  ],
};

const ENDPOINTS: Record<Proveedor, string> = {
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
};

let cacheConfig: { en: number; cadenas: Partial<Record<Perfil, ModeloCadena[]>> } | null = null;

/** Lee los modelos configurados en Firestore (config/ia), con caché de 60 s. */
export async function obtenerCadena(perfil: Perfil): Promise<ModeloCadena[]> {
  const ahora = Date.now();
  if (!cacheConfig || ahora - cacheConfig.en > 60_000) {
    let cadenas: Partial<Record<Perfil, ModeloCadena[]>> = {};
    try {
      const snap = await admin.firestore().doc('config/ia').get();
      const c = snap.data()?.['cadenas'];
      if (c && typeof c === 'object') cadenas = c;
    } catch (e) {
      console.warn('config/ia no disponible, se usan los modelos por defecto');
    }
    cacheConfig = { en: ahora, cadenas };
  }
  const personalizada = cacheConfig.cadenas[perfil];
  const valida =
    Array.isArray(personalizada) &&
    personalizada.length > 0 &&
    personalizada.every(
      (m) => (m.proveedor === 'groq' || m.proveedor === 'gemini') && typeof m.modelo === 'string',
    );
  return valida ? (personalizada as ModeloCadena[]) : CADENAS_POR_DEFECTO[perfil];
}

async function llamarUno(
  paso: ModeloCadena,
  peticion: IaPeticion,
  llaves: Llaves,
): Promise<Omit<IaResultado, 'intentos'>> {
  const llave = llaves[paso.proveedor];
  if (!llave) throw new Error(`Falta la llave de ${paso.proveedor}`);

  const body: Record<string, any> = {
    model: paso.modelo,
    messages: peticion.messages,
    temperature: peticion.temperature ?? 0.4,
    max_tokens: peticion.max_tokens ?? 1200,
  };
  if (peticion.tools?.length) {
    body['tools'] = peticion.tools;
    body['tool_choice'] = peticion.tool_choice ?? 'auto';
  }
  if (peticion.json && !peticion.tools?.length) {
    body['response_format'] = { type: 'json_object' };
  }
  // Gemini 2.5 "piensa" antes de responder y eso consume tokens de salida
  if (paso.proveedor === 'gemini' && paso.modelo.includes('flash')) {
    body['reasoning_effort'] = 'none';
  }

  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), 60_000);
  let res: Response;
  try {
    res = await fetch(ENDPOINTS[paso.proveedor], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${llave}`,
      },
      body: JSON.stringify(body),
      signal: control.signal,
    });
  } finally {
    clearTimeout(temporizador);
  }

  if (!res.ok) {
    const texto = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`HTTP ${res.status} ${texto}`);
  }

  const data: any = await res.json();
  const eleccion = data?.choices?.[0];
  if (!eleccion?.message) throw new Error('Respuesta vacía del modelo');

  return {
    message: {
      role: 'assistant',
      content: eleccion.message.content ?? null,
      ...(eleccion.message.tool_calls?.length
        ? { tool_calls: eleccion.message.tool_calls }
        : {}),
    },
    finish_reason: eleccion.finish_reason,
    proveedor: paso.proveedor,
    modelo: paso.modelo,
    usage: {
      prompt_tokens: Number(data?.usage?.prompt_tokens ?? 0),
      completion_tokens: Number(data?.usage?.completion_tokens ?? 0),
    },
  };
}

/** Llama al primer modelo disponible de la cadena del perfil. */
export async function llamarIA(
  peticion: IaPeticion,
  llaves: Llaves,
): Promise<IaResultado> {
  let cadena = await obtenerCadena(peticion.perfil);
  if (peticion.modeloPreferido && MODELOS_PERMITIDOS.includes(peticion.modeloPreferido)) {
    cadena = [
      { proveedor: 'groq', modelo: peticion.modeloPreferido },
      ...cadena.filter((c) => c.modelo !== peticion.modeloPreferido),
    ];
  }
  const intentos: IaResultado['intentos'] = [];

  for (const paso of cadena) {
    if (!llaves[paso.proveedor]) {
      intentos.push({ ...paso, error: 'sin llave configurada' });
      continue;
    }
    try {
      const resultado = await llamarUno(paso, peticion, llaves);
      return { ...resultado, intentos };
    } catch (e: any) {
      const error = String(e?.name === 'AbortError' ? 'tiempo agotado' : (e?.message ?? e));
      intentos.push({ ...paso, error });
      console.warn(`[IA] ${paso.proveedor}/${paso.modelo} falló: ${error}`);
    }
  }

  const detalle = intentos.map((i) => `${i.proveedor}/${i.modelo}: ${i.error}`).join(' | ');
  throw new Error(`Ningún modelo respondió. ${detalle}`);
}

/** Atajo para tareas de texto sin herramientas (resúmenes, redacción). */
export async function generarTexto(
  perfil: Perfil,
  system: string,
  user: string,
  llaves: Llaves,
  opciones: { temperature?: number; max_tokens?: number } = {},
): Promise<string> {
  const r = await llamarIA(
    {
      perfil,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: opciones.temperature ?? 0.4,
      max_tokens: opciones.max_tokens ?? 800,
    },
    llaves,
  );
  return r.message.content ?? '';
}
