import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { IaGatewayService } from './ia-gateway.service';
import { Products } from '../../../pages/interfaces';

export interface VisionResultado {
  marca: string;
  colores: string[];
  tipo: string;
  descriptores: string[];
  textoCompleto: string;
}

export interface ProductoCoincidencia {
  producto: Products;
  puntuacion: number;
  razon: string;
}

@Injectable({ providedIn: 'root' })
export class VisionBusquedaService {
  private gateway = inject(IaGatewayService);
  private _analizando$ = new BehaviorSubject<boolean>(false);
  analizando$ = this._analizando$.asObservable();

  private _resultado$ = new BehaviorSubject<VisionResultado | null>(null);
  resultado$ = this._resultado$.asObservable();

  private equivalenciasReferencias: { [key: string]: string[] } = {
    af1: ['air force 1', 'air force one', 'air force', 'af1', 'af-1'],
    p6000: ['p-6000', 'p6000', 'p 6000'],
    'jordan 1': [
      'retro 1',
      'jordan retro 1',
      'jordan 1 high',
      'jordan 1 low',
      'jordan 1 mid',
    ],
    '97': ['air max 97', 'air max retro 97', 'am97'],
    tn: ['air max plus', 'nike tn', 'tn air'],
    superstar: ['super star', 'adidas superstar'],
    nb550: ['new balance 550', 'nb 550', '550'],
  };

  async analizarImagen(imagenBase64: string): Promise<VisionResultado> {
    this._analizando$.next(true);
    this._resultado$.next(null);

    try {
      const imagen = imagenBase64.startsWith('data:')
        ? imagenBase64
        : `data:image/jpeg;base64,${imagenBase64}`;

      const respuesta = await this.gateway.chat('vision', {
        temperature: 0.2,
        max_tokens: 2000,
        json: true,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analiza este zapato y extrae la información de forma precisa.
Los descriptores deben incluir obligatoriamente: modelo si lo reconoces (Air Max, Samba, Chuck Taylor, etc), materiales visibles, estilo (retro, moderno, etc) y uso sugerido (running, lifestyle, etc).

Responde SOLO con un JSON con esta forma exacta:
{
  "marca": "marca exacta (Nike, Adidas, Puma, Vans, Converse, New Balance, Reebok, Fila, etc) o \"Desconocida\" si no se identifica",
  "colores": ["color1", "color2"],
  "tipo": "tipo de zapato (deportivo, casual, bota, sandalia, mocasin, etc)",
  "descriptores": ["modelo", "material", "estilo", "uso"],
  "textoCompleto": "descripción breve en español incluyendo marca, modelo si lo identificas, colores y estilo"
}`,
              },
              { type: 'image_url', image_url: { url: imagen } },
            ],
          },
        ],
      });

      let texto = respuesta.message.content ?? '';

      if (!texto) {
        throw new Error('No se recibió texto de respuesta desde la API.');
      }

      try {
        const jsonMatch = texto.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No se encontró JSON en la respuesta.');
        }

        let jsonLimpio = jsonMatch[0];

        try {
          const resultado: VisionResultado = JSON.parse(jsonLimpio);
          this._resultado$.next(resultado);
          return resultado;
        } catch {}

        const abiertos: string[] = [];
        let dentroDeString = false;
        let escape = false;

        for (const char of jsonLimpio) {
          if (escape) {
            escape = false;
            continue;
          }
          if (char === '\\') {
            escape = true;
            continue;
          }
          if (char === '"') {
            dentroDeString = !dentroDeString;
            continue;
          }
          if (dentroDeString) continue;
          if (char === '{') abiertos.push('}');
          else if (char === '[') abiertos.push(']');
          else if (char === '}' || char === ']') abiertos.pop();
        }

        jsonLimpio = jsonLimpio
          .replace(/,\s*$/, '')
          .replace(/[^}\]"'\d\w]*$/, '');

        if (dentroDeString) jsonLimpio += '"';

        jsonLimpio += abiertos.reverse().join('');

        const resultado: VisionResultado = JSON.parse(jsonLimpio);
        this._resultado$.next(resultado);
        return resultado;
      } catch (parseError) {
        console.error('Error al parsear respuesta de Gemini:', parseError);
        console.log('Texto original:', texto);
        throw new Error(
          'La respuesta del asistente no pudo ser procesada correctamente.',
        );
      }
    } catch (error) {
      console.error('Error en el servicio de búsqueda visual:', error);
      throw error;
    } finally {
      this._analizando$.next(false);
    }
  }

  filtrarProductos(
    productos: Products[],
    resultado: VisionResultado,
  ): ProductoCoincidencia[] {
    const coincidencias: ProductoCoincidencia[] = [];

    const marcaV = resultado.marca.toLowerCase().trim();
    const coloresV = resultado.colores.map((c) => c.toLowerCase());
    const descV = resultado.descriptores.map((d) => d.toLowerCase());
    const tipoV = resultado.tipo.toLowerCase();
    const textoV = resultado.textoCompleto.toLowerCase();

    const universoDescriptoresIA = `${marcaV} ${tipoV} ${textoV} ${descV.join(' ')}`;

    for (const producto of productos) {
      const marcaP = producto.marca.toLowerCase().trim();
      const refP = producto.referencia
        .toLowerCase()
        .replace(/[-_]/g, ' ')
        .trim();
      const textoP = `${marcaP} ${refP}`;

      let puntuacion = 0;
      const razones: string[] = [];

      if (marcaV !== 'desconocida' && marcaV !== '') {
        if (marcaP === marcaV) {
          puntuacion += 60;
          razones.push(`Marca exacta: ${producto.marca}`);
        } else if (marcaP.includes(marcaV) || marcaV.includes(marcaP)) {
          puntuacion += 35;
          razones.push(`Marca relacionada`);
        }
      }

      let matchPorDiccionario = false;

      for (const [miCodigoLocal, sinonimosInternet] of Object.entries(
        this.equivalenciasReferencias,
      )) {
        if (refP.includes(miCodigoLocal)) {
          const coincideConSinonimo = sinonimosInternet.some((sinonimo) =>
            universoDescriptoresIA.includes(sinonimo),
          );

          if (coincideConSinonimo) {
            puntuacion += 80;
            razones.push(`Modelo detectado: ${miCodigoLocal.toUpperCase()}`);
            matchPorDiccionario = true;
            break;
          }
        }
      }

      if (!matchPorDiccionario) {
        for (const desc of descV) {
          const palabrasDesc = desc.split(/\s+/).filter((p) => p.length > 3);
          for (const palabra of palabrasDesc) {
            if (refP.includes(palabra)) {
              puntuacion += 30;
              razones.push(`Coincidencia ref: "${palabra}"`);
              break;
            }
          }
        }
      }

      let coloresCoincidentes = 0;
      for (const color of coloresV) {
        if (textoP.includes(color)) {
          coloresCoincidentes++;
          puntuacion += 10;
        }
      }
      if (coloresCoincidentes > 0) {
        razones.push(`${coloresCoincidentes} color(es) coincidente(s)`);
      }

      if ((producto.stock ?? 0) > 0) {
        puntuacion += 5;
      }

      if (puntuacion > 25) {
        coincidencias.push({
          producto,
          puntuacion,
          razon:
            razones.length > 0
              ? razones.slice(0, 2).join(' · ')
              : 'Similitud visual',
        });
      }
    }

    return coincidencias
      .sort((a, b) => b.puntuacion - a.puntuacion)
      .slice(0, 15);
  }

  limpiar(): void {
    this._resultado$.next(null);
  }
}
