import {
  FuncionIA,
  IaGatewayService,
  IaMensajeGateway,
} from './ia-gateway.service';

/**
 * Agente con herramientas ("function calling").
 *
 * En vez de adivinar qué datos hacen falta buscando palabras clave en la
 * pregunta, el modelo decide qué herramientas llamar (ventas, stock, caja,
 * préstamos...), lee los resultados reales y responde con ellos.
 */
export interface Herramienta {
  nombre: string;
  descripcion: string;
  /** JSON Schema de los parámetros. */
  parametros: Record<string, any>;
  ejecutar: (args: any) => Promise<any>;
}

export interface OpcionesAgente {
  gateway: IaGatewayService;
  funcion: FuncionIA;
  system: string;
  /** Mensajes previos de la conversación (ya limpios). */
  historial: IaMensajeGateway[];
  pregunta: string;
  herramientas: Herramienta[];
  modelo?: string;
  /** Limpia los datos antes de enviarlos al modelo (quita campos innecesarios). */
  limpiar?: (datos: any) => any;
  maxIteraciones?: number;
  maxCaracteresResultado?: number;
}

export interface RespuestaAgente {
  texto: string;
  herramientasUsadas: { nombre: string; args: any }[];
}

/** Reduce arreglos largos hasta que el resultado quepa, avisando al modelo que fue recortado. */
export function recortarResultado(datos: any, maxCaracteres: number): string {
  let actual = datos;
  let recortado = false;

  const medir = () => {
    try {
      return JSON.stringify(actual).length;
    } catch {
      return Infinity;
    }
  };

  const reducir = (valor: any): any => {
    if (Array.isArray(valor)) {
      const base = valor.length > 3 ? valor.slice(0, Math.ceil(valor.length / 2)) : valor;
      if (base.length !== valor.length) recortado = true;
      return base.map(reducir);
    }
    if (valor && typeof valor === 'object') {
      const salida: any = {};
      for (const k of Object.keys(valor)) salida[k] = reducir(valor[k]);
      return salida;
    }
    return valor;
  };

  for (let i = 0; i < 10 && medir() > maxCaracteres; i++) {
    actual = reducir(actual);
  }

  let texto = JSON.stringify(actual) ?? 'null';
  if (texto.length > maxCaracteres) {
    texto = texto.slice(0, maxCaracteres);
    recortado = true;
  }
  return recortado
    ? `${texto}\n[AVISO: el resultado fue recortado por tamaño. Si el usuario necesita el detalle completo, dile que hay más datos y pregunta si quiere filtrarlos.]`
    : texto;
}

export async function ejecutarAgente(
  o: OpcionesAgente,
): Promise<RespuestaAgente> {
  const maxIter = o.maxIteraciones ?? 5;
  const maxChars = o.maxCaracteresResultado ?? 9000;
  const limpiar = o.limpiar ?? ((d: any) => d);

  const definiciones = o.herramientas.map((h) => ({
    type: 'function',
    function: {
      name: h.nombre,
      description: h.descripcion,
      parameters: h.parametros,
    },
  }));

  const mensajes: IaMensajeGateway[] = [
    { role: 'system', content: o.system },
    ...o.historial,
    { role: 'user', content: o.pregunta },
  ];
  const usadas: { nombre: string; args: any }[] = [];

  for (let i = 0; i < maxIter; i++) {
    const r = await o.gateway.chat(o.funcion, {
      messages: mensajes,
      tools: definiciones,
      temperature: 0.3,
      max_tokens: 2500,
      modelo: o.modelo,
    });
    const msg = r.message;

    if (!msg.tool_calls?.length) {
      return { texto: msg.content ?? 'Sin respuesta', herramientasUsadas: usadas };
    }

    mensajes.push({
      role: 'assistant',
      content: msg.content ?? '',
      tool_calls: msg.tool_calls,
    });

    const resultados = await Promise.all(
      msg.tool_calls.map(async (llamada: any) => {
        const nombre: string = llamada?.function?.name ?? '';
        const herramienta = o.herramientas.find((h) => h.nombre === nombre);
        let args: any = {};
        try {
          args = llamada?.function?.arguments
            ? JSON.parse(llamada.function.arguments)
            : {};
        } catch {
          args = {};
        }
        usadas.push({ nombre, args });

        let contenido: string;
        if (!herramienta) {
          contenido = JSON.stringify({ error: `La herramienta "${nombre}" no existe.` });
        } else {
          try {
            const datos = await herramienta.ejecutar(args);
            contenido = recortarResultado(limpiar(datos), maxChars);
          } catch (e: any) {
            contenido = JSON.stringify({
              error: `No se pudo obtener "${nombre}": ${e?.message ?? 'error desconocido'}`,
            });
          }
        }
        return {
          role: 'tool' as const,
          tool_call_id: llamada.id,
          name: nombre,
          content: contenido,
        };
      }),
    );
    mensajes.push(...resultados);
  }

  // Si el modelo siguió pidiendo herramientas, se le pide que cierre con lo que ya tiene
  mensajes.push({
    role: 'user',
    content:
      'Con la información que ya tienes, responde ahora de forma completa. No pidas más herramientas.',
  });
  const final = await o.gateway.chat(o.funcion, {
    messages: mensajes,
    temperature: 0.3,
    max_tokens: 2500,
    modelo: o.modelo,
  });
  return {
    texto: final.message.content ?? 'Sin respuesta',
    herramientasUsadas: usadas,
  };
}
