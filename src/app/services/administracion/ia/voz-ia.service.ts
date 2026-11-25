import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class VozIaService {
  private recognition: any = null;
  private synth = window.speechSynthesis;
  private vozSeleccionada: SpeechSynthesisVoice | null = null;

  readonly soportaVoz =
    'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

  constructor() {
    this.inicializarVoz();
  }

  private inicializarVoz(): void {
    const elegirVoz = () => {
      const voces = this.synth.getVoices();
      if (voces.length === 0) return;

      this.vozSeleccionada =
        voces.find((v) => v.lang === 'es-CO' && v.name.includes('Google')) ??
        voces.find((v) => v.lang === 'es-MX' && v.name.includes('Google')) ??
        voces.find((v) => v.lang === 'es-ES' && v.name.includes('Google')) ??
        voces.find(
          (v) => v.lang.startsWith('es') && v.name.includes('Microsoft'),
        ) ??
        voces.find((v) => v.lang === 'es-MX') ??
        voces.find((v) => v.lang === 'es-CO') ??
        voces.find((v) => v.lang === 'es-US') ??
        voces.find((v) => v.lang.startsWith('es')) ??
        null;
    };

    elegirVoz();
    this.synth.onvoiceschanged = elegirVoz;

    setTimeout(elegirVoz, 500);
    setTimeout(elegirVoz, 1500);
  }

  escuchar(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.soportaVoz) {
        reject('Tu navegador no soporta reconocimiento de voz');
        return;
      }

      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'es-CO';
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;

      let resuelto = false;

      this.recognition.onresult = (event: any) => {
        if (resuelto) return;
        resuelto = true;
        const texto = event.results[0][0].transcript;
        resolve(texto);
      };

      this.recognition.onerror = (event: any) => {
        if (resuelto) return;
        resuelto = true;
        if (event.error === 'no-speech') {
          reject('No se detectó voz. Intenta de nuevo.');
        } else if (event.error === 'not-allowed') {
          reject('Permiso de micrófono denegado.');
        } else {
          reject(`Error: ${event.error}`);
        }
      };

      this.recognition.onend = () => {
        if (!resuelto) {
          resuelto = true;
          resolve('');
        }
      };

      this.recognition.start();
    });
  }

  detenerEscucha(): void {
    this.recognition?.stop();
  }

  hablar(texto: string): Promise<void> {
    return new Promise((resolve) => {
      this.synth.cancel();

      const textoLimpio = texto
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
        .replace(/[\u{2600}-\u{27BF}]/gu, '')
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
        .replace(/\$\s*([\d.,]+)/g, (_, num) => {
          const valor = parseInt(num.replace(/[.,]/g, ''), 10);
          return isNaN(valor) ? '' : this.numeroALetras(valor) + ' pesos';
        })
        .replace(/\b(\d{1,3}(?:[.,]\d{3})+)\b/g, (_, num) => {
          const valor = parseInt(num.replace(/[.,]/g, ''), 10);
          return isNaN(valor) ? num : this.numeroALetras(valor);
        })

        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/_(.*?)_/g, '$1')
        .replace(/#{1,6}\s+/g, '')
        .replace(/^\s*[\*\-]\s+/gm, '')
        .replace(/^\s*\d+\.\s+/gm, '')
        .replace(/<br\s*\/?>/gi, '. ')
        .replace(/<[^>]+>/g, '')
        .replace(/[+]/g, ' más ')
        .replace(/[-–—]/g, ' ')
        .replace(/[_~`>|\\]/g, '')
        .replace(/[%]/g, ' por ciento')
        .replace(/[#]/g, '')
        .replace(/[@]/g, ' arroba ')
        .replace(/[=]/g, ' igual ')
        .replace(/[<]/g, ' ')
        .replace(/[>]/g, ' ')
        .replace(/[{}[\]()]/g, '')
        .replace(/[/]/g, ' ')
        .replace(/\.{2,}/g, '.')
        .replace(/\n{2,}/g, '. ')
        .replace(/\n/g, '. ')
        .replace(/[^\S\r\n]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();

      if (!textoLimpio) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(textoLimpio);
      utterance.lang = 'es-CO';
      utterance.rate = 1.1;
      utterance.pitch = 1;
      utterance.volume = 1;

      if (this.vozSeleccionada) {
        utterance.voice = this.vozSeleccionada;
      }

      let resuelto = false;
      const resolver = () => {
        if (!resuelto) {
          resuelto = true;
          resolve();
        }
      };

      utterance.onend = resolver;
      utterance.onerror = resolver;

      const timeoutId = setTimeout(resolver, 30000);
      utterance.onend = () => {
        clearTimeout(timeoutId);
        resolver();
      };
      utterance.onerror = () => {
        clearTimeout(timeoutId);
        resolver();
      };

      const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (esIOS) {
        const keepAlive = setInterval(() => {
          if (!this.synth.speaking) {
            clearInterval(keepAlive);
            return;
          }
          this.synth.pause();
          this.synth.resume();
        }, 5000);

        const originalResolver = resolver;
        utterance.onend = () => {
          clearInterval(keepAlive);
          clearTimeout(timeoutId);
          originalResolver();
        };
        utterance.onerror = () => {
          clearInterval(keepAlive);
          clearTimeout(timeoutId);
          originalResolver();
        };
      }

      this.synth.speak(utterance);
    });
  }

  private numeroALetras(n: number): string {
    if (n === 0) return 'cero';
    if (n < 0) return 'menos ' + this.numeroALetras(-n);

    const unidades = [
      '',
      'un',
      'dos',
      'tres',
      'cuatro',
      'cinco',
      'seis',
      'siete',
      'ocho',
      'nueve',
      'diez',
      'once',
      'doce',
      'trece',
      'catorce',
      'quince',
      'dieciséis',
      'diecisiete',
      'dieciocho',
      'diecinueve',
    ];
    const decenas = [
      '',
      'diez',
      'veinte',
      'treinta',
      'cuarenta',
      'cincuenta',
      'sesenta',
      'setenta',
      'ochenta',
      'noventa',
    ];
    const centenas = [
      '',
      'cien',
      'doscientos',
      'trescientos',
      'cuatrocientos',
      'quinientos',
      'seiscientos',
      'setecientos',
      'ochocientos',
      'novecientos',
    ];

    if (n < 20) return unidades[n];
    if (n < 100) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      if (u === 0) return decenas[d];
      if (d === 2) return 'veinti' + unidades[u];
      return decenas[d] + ' y ' + unidades[u];
    }
    if (n < 1000) {
      const c = Math.floor(n / 100);
      const resto = n % 100;
      if (resto === 0) return centenas[c];
      if (c === 1) return 'ciento ' + this.numeroALetras(resto);
      return centenas[c] + ' ' + this.numeroALetras(resto);
    }
    if (n < 1000000) {
      const miles = Math.floor(n / 1000);
      const resto = n % 1000;
      const prefijo = miles === 1 ? 'mil' : this.numeroALetras(miles) + ' mil';
      return resto === 0 ? prefijo : prefijo + ' ' + this.numeroALetras(resto);
    }
    if (n < 1000000000) {
      const millones = Math.floor(n / 1000000);
      const resto = n % 1000000;
      const prefijo =
        millones === 1
          ? 'un millón'
          : this.numeroALetras(millones) + ' millones';
      return resto === 0 ? prefijo : prefijo + ' ' + this.numeroALetras(resto);
    }
    return n.toString();
  }

  detenerVoz(): void {
    this.synth.cancel();
  }

  estaHablando(): boolean {
    return this.synth.speaking;
  }

  obtenerVozSeleccionada(): string {
    return this.vozSeleccionada?.name ?? 'Voz del sistema';
  }
}
