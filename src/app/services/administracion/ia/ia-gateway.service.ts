import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';

export type FuncionIA =
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

export interface IaMensajeGateway {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: any;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

export interface IaParametros {
  messages: IaMensajeGateway[];
  tools?: any[];
  temperature?: number;
  max_tokens?: number;
  /** Pide respuesta en JSON (no se combina con tools). */
  json?: boolean;
  /** Ignorado: el modelo lo elige el servidor según la función. Se acepta por compatibilidad. */
  model?: string;
  /** Modelo preferido (solo para chat del administrador, validado en el servidor). */
  modelo?: string;
}

export interface IaRespuestaGateway {
  message: IaMensajeGateway & { content: string | null };
  finish_reason: string | null;
  proveedor: string;
  modelo: string;
  usage: { prompt_tokens: number; completion_tokens: number };
}

/** Error de IA con un mensaje listo para mostrar al usuario. */
export class IaError extends Error {
  constructor(
    mensaje: string,
    public codigo: string,
  ) {
    super(mensaje);
  }
}

/**
 * Único punto por el que la app habla con la IA.
 * Las llaves de Groq y Gemini viven en el servidor (función `iaChat`).
 */
@Injectable({ providedIn: 'root' })
export class IaGatewayService {
  private functions = inject(Functions);
  private injector = inject(Injector);

  async chat(
    funcion: FuncionIA,
    params: IaParametros,
  ): Promise<IaRespuestaGateway> {
    const { model: _ignorado, ...resto } = params;
    try {
      const resultado = await runInInjectionContext(this.injector, () =>
        httpsCallable<any, IaRespuestaGateway>(this.functions, 'iaChat', {
          timeout: 180_000,
        })({ funcion, ...resto }),
      );
      return resultado.data;
    } catch (e: any) {
      const codigo = String(e?.code ?? 'desconocido').replace('functions/', '');
      const mensaje =
        codigo === 'resource-exhausted'
          ? 'Demasiadas consultas seguidas. Espera unos segundos e intenta de nuevo.'
          : codigo === 'permission-denied'
            ? 'No tienes permiso para usar esta función de IA.'
            : codigo === 'unauthenticated'
              ? 'Tu sesión expiró. Vuelve a iniciar sesión.'
              : (e?.message ?? 'La IA no está disponible en este momento.');
      throw new IaError(mensaje, codigo);
    }
  }

  /** Compatible con el formato de respuesta que usaban los servicios antes (`choices[0].message`). */
  async crear(funcion: FuncionIA, params: IaParametros) {
    const r = await this.chat(funcion, params);
    return { choices: [{ message: r.message }], usage: r.usage, modelo: r.modelo };
  }

  /** Atajo: devuelve solo el texto de la respuesta. */
  async texto(funcion: FuncionIA, params: IaParametros): Promise<string> {
    const r = await this.chat(funcion, params);
    return r.message.content ?? '';
  }
}
