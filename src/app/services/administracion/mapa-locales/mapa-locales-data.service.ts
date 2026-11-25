import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from '@angular/fire/firestore';
import { firstValueFrom, filter, take } from 'rxjs';
import { IaGatewayService } from '../ia/ia-gateway.service';
import { Local, LocalesService } from '../../locales/locales.service';

export interface VentasPorLocal {
  localId: string;
  localNombre: string;
  ventas: number;
  ingresos: number;
  vendedores: string[];
  porcentaje: number;
  ticketPromedio: number;
}

export interface HeatmapCell {
  local: string;
  fecha: string;
  ventas: number;
}

export interface ReporteLocal {
  generadoEn: string;
  texto: string;
  periodo: number;
}

const CACHE_KEY = 'shoeshop_reporte_locales';
const CACHE_HORAS = 12;

@Injectable({ providedIn: 'root' })
export class MapaLocalesDataService {
  private firestore = inject(Firestore);
  private localesService = inject(LocalesService);
  private gateway = inject(IaGatewayService);

  private filtrarVentaValida(v: any): boolean {
    const tipo = (v['tipoVenta'] ?? '').toLowerCase().trim();
    if (tipo === 'devuelto por bono') return false;
    if (tipo === 'devuelto por cambio') return false;
    if (tipo === 'bono') return false;
    if (
      (tipo === 'cambio' || tipo === 'cambio exhibicion') &&
      v['esMismoDia'] === false
    )
      return false;
    return true;
  }

  private normalizarLocal(nombre: string): string {
    return nombre.replace(/\D/g, '').replace(/^0+/, '') || '0';
  }

  private localCoincide(ventaLocal: string, localNombre: string): boolean {
    const vNorm = this.normalizarLocal(String(ventaLocal ?? ''));
    const lNorm = this.normalizarLocal(localNombre);
    return vNorm === lNorm || ventaLocal === localNombre;
  }

  async obtenerLocalesActivos(): Promise<Local[]> {
    this.localesService.reiniciarListener();

    const locales = await firstValueFrom(
      this.localesService.locales$.pipe(
        filter((lista) => lista && lista.length > 0),
        take(1),
      ),
    );

    return locales.filter((l) => {
      const estadoValido = l.estado === 'Activo';
      const noEsAdmon = !l.nombre.toLowerCase().includes('admon');
      return estadoValido && noEsAdmon;
    });
  }

  async calcularMetricasPorLocal(
    locales: Local[],
    dias: number,
  ): Promise<VentasPorLocal[]> {
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);
    desde.setHours(0, 0, 0, 0);

    const snap = await getDocs(
      query(
        collection(this.firestore, 'ventas'),
        where('fechaVenta', '>=', Timestamp.fromDate(desde)),
        orderBy('fechaVenta', 'desc'),
      ),
    );

    const ventas = snap.docs
      .map((d) => d.data())
      .filter(this.filtrarVentaValida);

    const maxVentas = { valor: 0 };
    const resultados: VentasPorLocal[] = locales.map((local) => {
      const ventasLocal = ventas.filter((v) =>
        this.localCoincide(v['local'], local.nombre),
      );
      const ingresos = ventasLocal.reduce((s, v) => s + (v['precio'] || 0), 0);
      const cantVentas = ventasLocal.length;
      if (cantVentas > maxVentas.valor) maxVentas.valor = cantVentas;

      return {
        localId: local.id ?? local.nombre,
        localNombre: local.nombre,
        ventas: cantVentas,
        ingresos,
        vendedores: [
          ...new Set(ventasLocal.map((v) => v['vendedor']).filter(Boolean)),
        ],
        porcentaje: 0,
        ticketPromedio: cantVentas > 0 ? Math.round(ingresos / cantVentas) : 0,
      };
    });

    resultados.forEach((r) => {
      r.porcentaje =
        maxVentas.valor > 0
          ? Math.round((r.ventas / maxVentas.valor) * 100)
          : 0;
    });

    return resultados.sort((a, b) => b.ventas - a.ventas);
  }

  async calcularHeatmap(
    locales: Local[],
    dias: number,
  ): Promise<HeatmapCell[]> {
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);
    desde.setHours(0, 0, 0, 0);

    const snap = await getDocs(
      query(
        collection(this.firestore, 'ventas'),
        where('fechaVenta', '>=', Timestamp.fromDate(desde)),
        orderBy('fechaVenta', 'desc'),
      ),
    );

    const ventas = snap.docs
      .map((d) => d.data())
      .filter(this.filtrarVentaValida);

    const mapa = new Map<string, number>();

    for (const v of ventas) {
      const fechaRaw = v['fechaVenta']?.seconds
        ? new Date(v['fechaVenta'].seconds * 1000)
        : new Date(v['fechaVenta']);
      const fechaStr = fechaRaw.toISOString().split('T')[0];

      for (const local of locales) {
        if (this.localCoincide(v['local'], local.nombre)) {
          const key = `${local.nombre}||${fechaStr}`;
          mapa.set(key, (mapa.get(key) ?? 0) + 1);
          break;
        }
      }
    }

    const cells: HeatmapCell[] = [];
    for (const [key, ventas] of mapa.entries()) {
      const [local, fecha] = key.split('||');
      cells.push({ local, fecha, ventas });
    }

    return cells;
  }

  obtenerReporteCacheado(): ReporteLocal | null {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const reporte: ReporteLocal = JSON.parse(raw);
      const generado = new Date(reporte.generadoEn);
      const ahoraMs = Date.now() - generado.getTime();
      const horasTranscurridas = ahoraMs / (1000 * 60 * 60);
      if (horasTranscurridas > CACHE_HORAS) return null;
      return reporte;
    } catch {
      return null;
    }
  }

  async generarReporteIA(
    metricas: VentasPorLocal[],
    periodo: number,
  ): Promise<string> {
    const cacheado = this.obtenerReporteCacheado();
    if (cacheado && cacheado.periodo === periodo) return cacheado.texto;

    const resumen = metricas.map((m, i) => ({
      posicion: i + 1,
      local: m.localNombre,
      ventas: m.ventas,
      ticketPromedio: m.ticketPromedio,
      vendedoresActivos: m.vendedores.length,
    }));

    const totalVentas = metricas.reduce((s, m) => s + m.ventas, 0);
    const totalIngresos = metricas.reduce((s, m) => s + m.ingresos, 0);
    const ticketPromedioGlobal =
      totalVentas > 0 ? Math.round(totalIngresos / totalVentas) : 0;

    const mejorLocal = metricas[0];
    const peorLocal = metricas[metricas.length - 1];

    const result = await this.gateway.crear('mapa', {
      model: 'openai/gpt-oss-120b',
      messages: [
        {
          role: 'system',
          content: `Eres el consultor comercial de ShoeShop, una marca colombiana de calzado y moda urbana que opera en centros comerciales con más de 400 locales de competencia directa en el mismo mall.

Tu trabajo es hablarle directamente al dueño o gerente de la marca — como si estuvieras sentado frente a él tomando un café — y darle recomendaciones concretas, humanas y accionables para esta semana.

CÓMO DEBES HABLAR:
- Como un consultor de confianza, no como un sistema de BI.
- Sin tablas, sin listas de bullets técnicos, sin repetir los números del dashboard.
- En párrafos cortos, fluidos, conversacionales. Máximo 3 párrafos en total.
- Usa lenguaje de negocio colombiano: directo, claro, sin rodeos.
- Habla de oportunidades reales: qué hacer esta semana, cómo mover más par, cómo subir el ticket, cómo motivar al equipo.
- Puedes mencionar los locales por nombre cuando sea necesario, pero no te dediques a describirlos uno por uno.
- NUNCA uses encabezados, secciones, guiones ni bullets. Solo prosa fluida.
- El ticket promedio de la marca estos días es $${ticketPromedioGlobal.toLocaleString('es-CO')} COP. Úsalo como referencia de salud del negocio, no lo repitas.
- El mejor local es ${mejorLocal?.localNombre} y el que más necesita apoyo es ${peorLocal?.localNombre}. Dales protagonismo estratégico en tu análisis.
- Cierra siempre con una frase motivadora y accionable, como lo haría un buen asesor de negocios.`,
        },
        {
          role: 'user',
          content: `Datos de los últimos ${periodo} días para que me des tu lectura del negocio:

Total vendido: ${totalVentas} pares en toda la cadena.
Ticket promedio de la marca: $${ticketPromedioGlobal.toLocaleString('es-CO')} COP.

Comportamiento de cada local (de mejor a peor):
${resumen
  .map(
    (r) =>
      `${r.posicion}. ${r.local}: ${r.ventas} ventas, ticket promedio $${r.ticketPromedio.toLocaleString('es-CO')}, ${r.vendedoresActivos} vendedor(es) activo(s)`,
  )
  .join('\n')}

Dame tu lectura honesta del negocio y dime qué haría esta semana para mover la aguja.`,
        },
      ],
      max_tokens: 420,
      temperature: 0.55,
    });

    const texto =
      result.choices[0]?.message?.content ??
      'Sin análisis disponible en este momento. Intenta de nuevo.';

    const reporte: ReporteLocal = {
      generadoEn: new Date().toISOString(),
      texto,
      periodo,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(reporte));

    return texto;
  }

  forzarRegeneracionReporte(): void {
    localStorage.removeItem(CACHE_KEY);
  }
}
