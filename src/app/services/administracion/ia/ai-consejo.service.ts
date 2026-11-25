import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import { Firestore, collection, getDocs, query, where, Timestamp } from '@angular/fire/firestore';
import { IaGatewayService } from './ia-gateway.service';
import { AuthService } from '../../auth/auth.service';
import { cajaDeVenta } from '../../vendedorServices/ventas/caja-calculo';

export interface ConsejoIA {
  frase: string;
  consejo: string;
  generadoEn: string;
}

const STORAGE_KEY = 'mu_consejo_ia';

@Injectable({ providedIn: 'root' })
export class AiConsejoService {
  private gateway = inject(IaGatewayService);
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private authService = inject(AuthService);

  /**
   * Datos reales del vendedor (últimos 14 días) para que el consejo sea personal.
   * Todo se calcula aquí con reglas exactas; la IA solo lo redacta.
   */
  private async estadisticasVendedor(): Promise<string> {
    const user = this.authService.getCurrentUser();
    if (!user?.id) return '';

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const desde = new Date(hoy);
    desde.setDate(hoy.getDate() - 13);

    const snap = await runInInjectionContext(this.injector, () =>
      getDocs(
        query(
          collection(this.firestore, 'ventas'),
          where('vendedorId', '==', user.id),
          where('fechaVenta', '>=', Timestamp.fromDate(desde)),
        ),
      ),
    );

    const corte = new Date(hoy);
    corte.setDate(hoy.getDate() - 6); // últimos 7 días: desde 'corte'
    let ult7 = 0;
    let prev7 = 0;
    const refs = new Map<string, number>();
    const tallas = new Map<string, number>();
    const dias = [0, 0, 0, 0, 0, 0, 0];
    const nombresDia = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

    snap.forEach((d) => {
      const v: any = d.data();
      if (cajaDeVenta(v).unidades !== 1) return;
      const f: Date = v.fechaVenta?.toDate ? v.fechaVenta.toDate() : new Date(v.fechaVenta);
      if (isNaN(f.getTime())) return;
      if (f >= corte) ult7++;
      else prev7++;
      dias[f.getDay()]++;
      const ref = [v.marca, v.referencia].filter(Boolean).join(' ').trim();
      if (ref) refs.set(ref, (refs.get(ref) ?? 0) + 1);
      if (v.talla) tallas.set(String(v.talla), (tallas.get(String(v.talla)) ?? 0) + 1);
    });

    if (ult7 + prev7 === 0) return '';

    const top = (m: Map<string, number>, n: number) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, c]) => `${k} (${c})`).join(', ');
    const mejorDia = dias.indexOf(Math.max(...dias));

    const tendencia =
      prev7 === 0
        ? 'no hay semana anterior para comparar'
        : ult7 > prev7
          ? `subió frente a la semana anterior (${prev7})`
          : ult7 < prev7
            ? `bajó frente a la semana anterior (${prev7})`
            : `igual que la semana anterior (${prev7})`;

    return [
      `- Pares vendidos en los últimos 7 días: ${ult7} (${tendencia}).`,
      refs.size ? `- Referencias que más vende: ${top(refs, 3)}.` : '',
      tallas.size ? `- Tallas que más vende: ${top(tallas, 3)}.` : '',
      `- Su mejor día de la semana: ${nombresDia[mejorDia]}.`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  async getConsejoDelDia(
    nombreVendedor: string,
    metaVentas?: number,
    metaIngresos?: number,
    ventasActuales?: number,
    ingresosActuales?: number,
  ): Promise<ConsejoIA> {
    const cached = this.getCached();
    const hoy = new Date().toISOString().split('T')[0];

    if (cached && cached.generadoEn === hoy) {
      return cached;
    }

    let datosReales = '';
    try {
      datosReales = await this.estadisticasVendedor();
    } catch (e) {
      console.warn('[Consejo] no se pudieron calcular las estadísticas', e);
    }

    return this.fetchFromGroq(
      nombreVendedor,
      metaVentas,
      metaIngresos,
      ventasActuales,
      ingresosActuales,
      datosReales,
    );
  }

  private getCached(): ConsejoIA | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as ConsejoIA;
    } catch {
      return null;
    }
  }

  private saveCache(data: ConsejoIA): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }

  private buildPrompt(
    nombre: string,
    metaVentas?: number,
    metaIngresos?: number,
    ventasActuales?: number,
    ingresosActuales?: number,
    datosReales = '',
  ): string {
    const hoy = new Date().toLocaleDateString('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    const tips = [
      'revisar que el local esté ordenado y limpio antes de abrir: la primera impresión lo es todo',
      'saludar a cada cliente con una sonrisa genuina y contacto visual — eso rompe cualquier barrera',
      'cuando un cliente dude entre dos modelos, ayudarlo a decidir preguntando para qué ocasión lo va a usar',
      'si un cliente se va sin comprar, despedirlo con buena energía — muchos regresan ese mismo día',
      'mantener los modelos más nuevos al frente de la vitrina y a la altura de los ojos',
      'conocer bien los modelos del local permite recomendar con seguridad y eso genera confianza en el cliente',
      'una buena actitud en el piso de venta es contagiosa — el cliente lo siente y se queda más tiempo',
      'si el local está tranquilo, aprovecha para reorganizar la exhibición y dejarla impecable',
      'el cliente que regresa es el mejor cliente — trata cada venta como si fuera la primera impresión',
      'tomarse un momento para conocer el nombre del cliente cambia toda la dinámica de la venta',
    ];

    const tip = tips[Math.floor(Math.random() * tips.length)];

    let contextoMeta = '';
    if (metaVentas && ventasActuales !== undefined) {
      const faltan = Math.max(0, metaVentas - ventasActuales);
      const pct = Math.round((ventasActuales / metaVentas) * 100);

      if (pct >= 100) {
        contextoMeta = `Ya superó su meta esta semana. Está en un gran momento.`;
      } else if (pct >= 75) {
        contextoMeta = `Está muy cerca de su meta, le faltan solo ${faltan} pares.`;
      } else if (pct >= 40) {
        contextoMeta = `Va por buen camino, lleva la mitad del recorrido semanal.`;
      } else {
        contextoMeta = `Está construyendo su semana con todo por delante.`;
      }
    }

    return `Eres el asistente de bienestar del equipo de ShoeShop, una tienda de calzado en Medellín. Hoy es ${hoy}.

Escríbele un mensaje de inicio de día a ${nombre}.
${contextoMeta ? `Su momento actual: ${contextoMeta}` : ''}
Tip del día: ${tip}
${datosReales ? `
DATOS REALES DE ${nombre} (últimos días):
${datosReales}
` : ''}
INSTRUCCIONES:
- "frase": Saludo cálido y personal. Que lo haga sentir valorado como persona, no solo como vendedor. Incluye su nombre. Máximo 12 palabras. Sin exclamaciones exageradas.
- "consejo": Tip del día redactado de forma natural y amigable, como lo diría un compañero con experiencia. Máximo 2 líneas. Sin listas, sin puntos, sin estructura rígida. Solo una idea clara y útil para hoy.

${datosReales ? '- Si hay DATOS REALES, apoya el consejo en UNO solo de esos datos (por ejemplo su referencia más vendida o su mejor día) de forma natural. Usa solo los datos entregados, no inventes cifras y no menciones dinero ni comparaciones con otros vendedores.' : ''}

PROHIBIDO: mencionar medias, kits, combos, productos adicionales o cualquier accesorio. Solo calzado y experiencia de venta.

Responde solo con JSON puro sin markdown:
{"frase": "...", "consejo": "..."}`;
  }

  private async fetchFromGroq(
    nombre: string,
    metaVentas?: number,
    metaIngresos?: number,
    ventasActuales?: number,
    ingresosActuales?: number,
    datosReales = '',
  ): Promise<ConsejoIA> {
    const hoy = new Date().toISOString().split('T')[0];

    try {
      const raw = await this.gateway.texto('consejo', {
        messages: [
          {
            role: 'user',
            content: this.buildPrompt(
              nombre,
              metaVentas,
              metaIngresos,
              ventasActuales,
              ingresosActuales,
              datosReales,
            ),
          },
        ],
        temperature: 0.85,
        max_tokens: 300,
        json: true,
      });

      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON in response');

      const parsed = JSON.parse(match[0]);
      const result: ConsejoIA = {
        frase: parsed.frase ?? `¡Hoy es un gran día para brillar, ${nombre}!`,
        consejo:
          parsed.consejo ??
          'Enfócate en conectar con cada cliente y ofrecer lo mejor.',
        generadoEn: hoy,
      };

      this.saveCache(result);
      return result;
    } catch (err) {
      console.warn(
        '[AiConsejoService] Groq call failed:',
        err?.status,
        err?.message,
        err?.error,
      );

      console.warn('[AiConsejoService] Groq call failed, using fallback', err);
      const fallback: ConsejoIA = {
        frase: `¡${nombre}, hoy tienes todo para lograr resultados increíbles!`,
        consejo:
          'Recuerda que cada cliente es una oportunidad. Escúchalos, entiende qué necesitan y muéstrales el par perfecto.',
        generadoEn: hoy,
      };
      this.saveCache(fallback);
      return fallback;
    }
  }
}
