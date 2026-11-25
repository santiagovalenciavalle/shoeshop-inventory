import {
  Injectable,
  inject,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  doc,
  setDoc,
  getDoc,
} from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';
import { IaGatewayService } from './ia-gateway.service';

export interface RankingVendedor {
  nombre: string;
  ventas: number;
  ingresos: number;
  ventasPrecioBajo: number;
  porcentajePrecioBajo: number;
  locales: string[];
}

export interface RankingSemana {
  id: string;
  semanaInicio: string;
  semanaFin: string;
  generadoEn: string;
  vendedores: RankingVendedor[];
  localMasActivo: { local: string; ventas: number };
  referenciaMasVendida: {
    zapatoId: number;
    marca: string;
    referencia: string;
    ventas: number;
  } | null;
  totalVentasSemana: number;
  totalIngresosSemana: number;
  narrativa: string;
}

@Injectable({ providedIn: 'root' })
export class RankingSemanalService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);

  private gateway = inject(IaGatewayService);

  private rankingActualSubject = new BehaviorSubject<RankingSemana | null>(
    null,
  );
  rankingActual$ = this.rankingActualSubject.asObservable();

  private historialSubject = new BehaviorSubject<RankingSemana[]>([]);
  historial$ = this.historialSubject.asObservable();

  private cargandoSubject = new BehaviorSubject<boolean>(false);
  cargando$ = this.cargandoSubject.asObservable();

  async cargarRankingActual(): Promise<void> {
    return runInInjectionContext(this.injector, async () => {
      const semanaId = this.getSemanaId();
      const ref = doc(this.firestore, 'rankingSemanal', semanaId);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        this.rankingActualSubject.next(snap.data() as RankingSemana);
      } else {
        this.rankingActualSubject.next(null);
      }
    });
  }

  async cargarHistorial(cantidadSemanas: number = 8): Promise<void> {
    return runInInjectionContext(this.injector, async () => {
      const q = query(
        collection(this.firestore, 'rankingSemanal'),
        orderBy('semanaInicio', 'desc'),
        limit(cantidadSemanas),
      );
      const snap = await getDocs(q);
      const historial = snap.docs.map((d) => d.data() as RankingSemana);
      this.historialSubject.next(historial);
    });
  }

  async generarYGuardarRanking(): Promise<RankingSemana> {
    return runInInjectionContext(this.injector, async () => {
      this.cargandoSubject.next(true);

      try {
        const inicio = this.getInicioSemana();
        const fin = this.getFinSemana();

        const q = query(
          collection(this.firestore, 'ventas'),
          where('fechaVenta', '>=', Timestamp.fromDate(inicio)),
          where('fechaVenta', '<=', Timestamp.fromDate(fin)),
          orderBy('fechaVenta', 'desc'),
        );

        const snap = await getDocs(q);
        const ventas = snap.docs
          .map((d) => d.data())
          .filter((v) => {
            const tipo = (v['tipoVenta'] ?? '').toLowerCase();
            if (tipo === 'devuelto por bono' || tipo === 'devuelto por cambio')
              return false;
            if (
              (tipo === 'cambio' || tipo === 'cambio exhibicion') &&
              v['esMismoDia'] === false
            )
              return false;
            return true;
          });

        const mapaVendedores = new Map<string, RankingVendedor>();
        for (const v of ventas) {
          const nombre = v['vendedor'] ?? 'Sin especificar';
          if (!mapaVendedores.has(nombre)) {
            mapaVendedores.set(nombre, {
              nombre,
              ventas: 0,
              ingresos: 0,
              ventasPrecioBajo: 0,
              porcentajePrecioBajo: 0,
              locales: [],
            });
          }
          const item = mapaVendedores.get(nombre)!;
          item.ventas += 1;
          item.ingresos += Number(v['precio'] || 0);
          if (v['precioBajo'] === true) item.ventasPrecioBajo += 1;
          if (v['local'] && !item.locales.includes(v['local'])) {
            item.locales.push(v['local']);
          }
        }

        const vendedores = Array.from(mapaVendedores.values())
          .map((v) => ({
            ...v,
            porcentajePrecioBajo:
              v.ventas > 0
                ? Math.round((v.ventasPrecioBajo / v.ventas) * 100)
                : 0,
          }))
          .sort((a, b) => b.ingresos - a.ingresos);

        const mapaLocales: Record<string, number> = {};
        for (const v of ventas) {
          const local = v['local'] ?? 'Sin especificar';
          mapaLocales[local] = (mapaLocales[local] || 0) + 1;
        }
        const localMasActivo = Object.entries(mapaLocales).sort(
          (a, b) => b[1] - a[1],
        )[0] ?? ['N/A', 0];

        const mapaReferencias = new Map<
          number,
          {
            zapatoId: number;
            marca: string;
            referencia: string;
            ventas: number;
          }
        >();
        for (const v of ventas) {
          const id = Number(v['zapatoId']);
          if (!id) continue;
          if (!mapaReferencias.has(id)) {
            mapaReferencias.set(id, {
              zapatoId: id,
              marca: v['marca'] ?? '',
              referencia: v['referencia'] ?? '',
              ventas: 0,
            });
          }
          mapaReferencias.get(id)!.ventas += 1;
        }
        const referenciaMasVendida =
          Array.from(mapaReferencias.values()).sort(
            (a, b) => b.ventas - a.ventas,
          )[0] ?? null;

        const totalVentasSemana = ventas.length;
        const totalIngresosSemana = ventas.reduce(
          (sum, v) => sum + Number(v['precio'] || 0),
          0,
        );

        const narrativa = await this.generarNarrativa({
          inicio,
          fin,
          vendedores,
          localMasActivo: {
            local: localMasActivo[0],
            ventas: localMasActivo[1],
          },
          referenciaMasVendida,
          totalVentasSemana,
          totalIngresosSemana,
        });

        const semanaId = this.getSemanaId(inicio);
        const ranking: RankingSemana = {
          id: semanaId,
          semanaInicio: inicio.toISOString(),
          semanaFin: fin.toISOString(),
          generadoEn: new Date().toISOString(),
          vendedores,
          localMasActivo: {
            local: localMasActivo[0],
            ventas: localMasActivo[1],
          },
          referenciaMasVendida,
          totalVentasSemana,
          totalIngresosSemana,
          narrativa,
        };

        await setDoc(doc(this.firestore, 'rankingSemanal', semanaId), ranking);

        this.rankingActualSubject.next(ranking);
        return ranking;
      } finally {
        this.cargandoSubject.next(false);
      }
    });
  }

  private async generarNarrativa(datos: {
    inicio: Date;
    fin: Date;
    vendedores: RankingVendedor[];
    localMasActivo: { local: string; ventas: number };
    referenciaMasVendida: any;
    totalVentasSemana: number;
    totalIngresosSemana: number;
  }): Promise<string> {
    const top3 = datos.vendedores.slice(0, 3);
    const masPrecios = [...datos.vendedores]
      .sort((a, b) => b.ventasPrecioBajo - a.ventasPrecioBajo)
      .slice(0, 2);

    const prompt = `
Genera un resumen narrativo semanal para ShoeShop (tienda de calzado en Colombia, dentro de un CC con 400+ locales de zapatos).
Semana: ${datos.inicio.toLocaleDateString('es-CO')} al ${datos.fin.toLocaleDateString('es-CO')}

Datos:
- Total ventas: ${datos.totalVentasSemana}
- Total ingresos: $${datos.totalIngresosSemana.toLocaleString('es-CO')} COP
- Local más activo: Local ${datos.localMasActivo.local} (${datos.localMasActivo.ventas} ventas)
- Referencia más vendida: ${datos.referenciaMasVendida ? `${datos.referenciaMasVendida.marca} ${datos.referenciaMasVendida.referencia} (${datos.referenciaMasVendida.ventas} ventas)` : 'N/A'}
- Top 3 vendedores: ${top3.map((v, i) => `${i + 1}. ${v.nombre}: ${v.ventas} ventas, $${v.ingresos.toLocaleString('es-CO')}`).join(' | ')}
- Vendedores con más precios bajos: ${masPrecios.map((v) => `${v.nombre}: ${v.ventasPrecioBajo} (${v.porcentajePrecioBajo}%)`).join(', ')}

Escribe 3-4 párrafos cortos con:
1. Resumen general de la semana con tono motivador
2. Reconocimiento al mejor vendedor
3. Una observación sobre precios bajos o áreas de mejora
4. Una frase de cierre motivacional para la próxima semana

Usa emojis, responde en español, tono profesional y cercano.
`;

    try {
      const result = await this.gateway.crear('ranking', {
        model: 'openai/gpt-oss-120be',
        messages: [
          {
            role: 'system',
            content:
              'Eres el analista de ShoeShop. Generas resúmenes semanales motivadores y con datos reales.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 500,
      });

      return result.choices[0]?.message?.content ?? 'Semana completada.';
    } catch {
      return `Semana del ${datos.inicio.toLocaleDateString('es-CO')} al ${datos.fin.toLocaleDateString('es-CO')}. Total: ${datos.totalVentasSemana} ventas.`;
    }
  }

  private getInicioSemana(): Date {
    const hoy = new Date();
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - hoy.getDay());
    inicio.setHours(0, 0, 0, 0);
    return inicio;
  }

  private getFinSemana(): Date {
    const inicio = this.getInicioSemana();
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 6);
    fin.setHours(23, 59, 59, 999);
    return fin;
  }

  private getSemanaId(fecha?: Date): string {
    const inicio = fecha ?? this.getInicioSemana();
    return inicio.toISOString().split('T')[0];
  }
}
