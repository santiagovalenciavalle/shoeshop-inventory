import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';

/**
 * Reglas y datos del negocio que la IA debe recordar siempre (por usuario).
 * Se guardan al escribirle en el chat: "Recuerda que ...".
 */
@Injectable({ providedIn: 'root' })
export class IaMemoriaNegocioService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  private cache: string[] | null = null;
  private cacheUid: string | null = null;
  private readonly MAX_REGLAS = 30;
  private readonly MAX_LARGO = 400;

  private get uid(): string | null {
    return this.auth.currentUser?.uid ?? null;
  }

  private ref() {
    return doc(this.firestore, `iaMemoria/${this.uid}`);
  }

  async reglas(): Promise<string[]> {
    const uid = this.uid;
    if (!uid) return [];
    if (this.cache && this.cacheUid === uid) return this.cache;
    try {
      const snap = await getDoc(this.ref());
      const lista = snap.data()?.['reglas'];
      this.cache = Array.isArray(lista) ? lista.map(String) : [];
    } catch {
      this.cache = [];
    }
    this.cacheUid = uid;
    return this.cache;
  }

  private async guardar(reglas: string[]): Promise<void> {
    await setDoc(this.ref(), { reglas, actualizado: new Date() });
    this.cache = reglas;
  }

  async agregar(texto: string): Promise<{ ok: boolean; mensaje: string }> {
    const limpio = texto.trim().replace(/\s+/g, ' ');
    if (limpio.length < 5) {
      return { ok: false, mensaje: 'Dime qué quieres que recuerde, con un poco más de detalle.' };
    }
    if (limpio.length > this.MAX_LARGO) {
      return { ok: false, mensaje: `Es muy largo. Resúmelo en menos de ${this.MAX_LARGO} caracteres.` };
    }
    const actuales = await this.reglas();
    if (actuales.some((r) => r.toLowerCase() === limpio.toLowerCase())) {
      return { ok: true, mensaje: 'Eso ya lo tenía anotado.' };
    }
    if (actuales.length >= this.MAX_REGLAS) {
      return {
        ok: false,
        mensaje: `Ya tengo ${this.MAX_REGLAS} reglas guardadas. Pídeme que olvide alguna primero (por ejemplo: "olvida la regla 3").`,
      };
    }
    await this.guardar([...actuales, limpio]);
    return { ok: true, mensaje: `Listo, lo recordaré: «${limpio}»` };
  }

  async olvidar(numero: number): Promise<{ ok: boolean; mensaje: string }> {
    const actuales = await this.reglas();
    if (!Number.isInteger(numero) || numero < 1 || numero > actuales.length) {
      return { ok: false, mensaje: `No existe la regla ${numero}. Escribe "qué recuerdas" para verlas.` };
    }
    const quitada = actuales[numero - 1];
    await this.guardar(actuales.filter((_, i) => i !== numero - 1));
    return { ok: true, mensaje: `Olvidada la regla ${numero}: «${quitada}»` };
  }

  async listar(): Promise<string> {
    const actuales = await this.reglas();
    if (!actuales.length) {
      return 'Aún no tengo nada guardado. Escríbeme "Recuerda que ..." para enseñarme algo de tu negocio.';
    }
    return `Esto es lo que recuerdo de tu negocio:\n${actuales.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;
  }

  /**
   * Interpreta comandos de memoria escritos en el chat.
   * Devuelve la respuesta si el mensaje era un comando, o null si es una pregunta normal.
   */
  async procesarComando(mensaje: string): Promise<string | null> {
    const m = mensaje.trim();

    const guardar = m.match(/^(?:recuerda|ten en cuenta|guarda|anota)\s*(?:que|:)?\s+(.{5,})$/i);
    if (guardar) return (await this.agregar(guardar[1])).mensaje;

    const olvidar = m.match(/^olvida\s+(?:la\s+)?regla\s+(?:n[uú]mero\s+)?(\d+)\s*[.!]?$/i);
    if (olvidar) return (await this.olvidar(Number(olvidar[1]))).mensaje;

    if (/^(?:qu[eé]\s+recuerdas|mu[eé]strame\s+(?:tus\s+)?reglas|qu[eé]\s+reglas\s+tienes)\??$/i.test(m)) {
      return this.listar();
    }
    return null;
  }

  /** Texto que se agrega al prompt de sistema. */
  async paraPrompt(): Promise<string> {
    const r = await this.reglas();
    if (!r.length) return '';
    return `\nREGLAS DEL NEGOCIO QUE EL ADMINISTRADOR TE PIDIÓ RECORDAR (tienen prioridad sobre tus suposiciones):\n${r
      .map((x, i) => `${i + 1}. ${x}`)
      .join('\n')}\n`;
  }
}
