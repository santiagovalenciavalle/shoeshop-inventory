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
  Timestamp,
  doc,
  setDoc,
  getDoc,
} from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';
import { IaGatewayService } from './ia-gateway.service';

export interface Alerta {
  tipo:
    | 'prestamo_viejo'
    | 'pedido_viejo'
    | 'precio_bajo'
    | 'stock_critico'
    | 'consejo';
  nivel: 'info' | 'warning' | 'danger';
  titulo: string;
  descripcion: string;
  dato?: any;
}

export interface ResumenAlertas {
  fecha: string;
  totalAlertas: number;
  alertas: Alerta[];
  mensajeIA: string;
  generadoEn: Date;
}

@Injectable({ providedIn: 'root' })
export class AlertasIaService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);

  private gateway = inject(IaGatewayService);

  private resumenSubject = new BehaviorSubject<ResumenAlertas | null>(null);
  resumen$ = this.resumenSubject.asObservable();

  private cargandoSubject = new BehaviorSubject<boolean>(false);
  cargando$ = this.cargandoSubject.asObservable();

  async verificarAlertasDelDia(nombreUsuario: string): Promise<void> {
    const hoy = new Date().toISOString().split('T')[0];
    const cacheKey = `alertas-ia-${hoy}`;

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const resumen = JSON.parse(cached) as ResumenAlertas;
        this.resumenSubject.next(resumen);
        return;
      }
    } catch {}

    this.cargandoSubject.next(true);

    try {
      const alertas = await this.recolectarAlertas();
      const mensajeIA = await this.generarMensajeIA(alertas, nombreUsuario);

      const resumen: ResumenAlertas = {
        fecha: hoy,
        totalAlertas: alertas.length,
        alertas,
        mensajeIA,
        generadoEn: new Date(),
      };

      localStorage.setItem(cacheKey, JSON.stringify(resumen));
      this.resumenSubject.next(resumen);
    } catch (error) {
      console.error('Error generando alertas:', error);
    } finally {
      this.cargandoSubject.next(false);
    }
  }

  async forzarActualizacion(nombreUsuario: string): Promise<void> {
    const hoy = new Date().toISOString().split('T')[0];
    localStorage.removeItem(`alertas-ia-${hoy}`);
    await this.verificarAlertasDelDia(nombreUsuario);
  }

  private async recolectarAlertas(): Promise<Alerta[]> {
    return runInInjectionContext(this.injector, async () => {
      const alertas: Alerta[] = [];
      const hoyInicio = new Date();
      hoyInicio.setHours(0, 0, 0, 0);

      const [prestamosSnap, pedidosSnap, ventasSnap] = await Promise.all([
        getDocs(collection(this.firestore, 'prestamos')),
        getDocs(
          query(
            collection(this.firestore, 'pedidos'),
            where('estado', '==', 'Recibido'),
            where('fechaPedido', '<', Timestamp.fromDate(hoyInicio)),
          ),
        ),
        getDocs(
          query(
            collection(this.firestore, 'ventas'),
            where(
              'fechaVenta',
              '>=',
              Timestamp.fromDate(this.getInicioSemana()),
            ),
            where('precioBajo', '==', true),
          ),
        ),
      ]);

      const prestamos = prestamosSnap.docs.map((d) => d.data());
      const prestamosViejos = prestamos.filter((p) => {
        const fecha = p['fechaPrestamo']?.seconds;
        if (!fecha) return false;
        const dias = (Date.now() - fecha * 1000) / (1000 * 60 * 60 * 24);
        return dias > 7;
      });

      if (prestamosViejos.length > 0) {
        const porVendedor: Record<string, number> = {};
        for (const p of prestamosViejos) {
          const v = p['vendedor'] ?? 'Sin especificar';
          porVendedor[v] = (porVendedor[v] || 0) + 1;
        }
        alertas.push({
          tipo: 'prestamo_viejo',
          nivel: prestamosViejos.length > 5 ? 'danger' : 'warning',
          titulo: `${prestamosViejos.length} préstamo${prestamosViejos.length > 1 ? 's' : ''} con más de 7 días`,
          descripcion: `Vendedores con préstamos viejos: ${Object.entries(
            porVendedor,
          )
            .map(([v, n]) => `${v} (${n})`)
            .join(', ')}`,
          dato: { prestamosViejos: prestamosViejos.length, porVendedor },
        });
      }

      const pedidosViejos = pedidosSnap.docs.map((d) => d.data());
      if (pedidosViejos.length > 0) {
        alertas.push({
          tipo: 'pedido_viejo',
          nivel: 'warning',
          titulo: `${pedidosViejos.length} pedido${pedidosViejos.length > 1 ? 's' : ''} recibidos de días anteriores`,
          descripcion: `Hay pedidos en estado "Recibido" de días anteriores sin confirmar.`,
          dato: { cantidad: pedidosViejos.length },
        });
      }

      const ventasBajas = ventasSnap.docs
        .map((d) => d.data())
        .filter((v) => {
          const tipo = (v['tipoVenta'] ?? '').toLowerCase();
          return tipo !== 'devuelto por bono' && tipo !== 'devuelto por cambio';
        });

      if (ventasBajas.length > 0) {
        const porVendedor: Record<string, number> = {};
        for (const v of ventasBajas) {
          const vend = v['vendedor'] ?? 'Sin especificar';
          porVendedor[vend] = (porVendedor[vend] || 0) + 1;
        }
        const topVendedor = Object.entries(porVendedor).sort(
          (a, b) => b[1] - a[1],
        )[0];
        alertas.push({
          tipo: 'precio_bajo',
          nivel: ventasBajas.length > 10 ? 'danger' : 'warning',
          titulo: `${ventasBajas.length} ventas bajo precio mínimo esta semana`,
          descripcion: `El vendedor con más ventas bajo mínimo: ${topVendedor[0]} (${topVendedor[1]} ventas).`,
          dato: { total: ventasBajas.length, porVendedor },
        });
      }

      const consejo = await this.generarConsejoDelDia(alertas);
      alertas.push({
        tipo: 'stock_critico',
        nivel: 'info',
        titulo: '💡 Consejo del día',
        descripcion: consejo,
        dato: null,
      });

      return alertas;
    });
  }

  private async generarConsejoDelDia(
    alertasActuales: Alerta[],
  ): Promise<string> {
    const productosSnap = await runInInjectionContext(this.injector, () =>
      getDocs(
        query(
          collection(this.firestore, 'productos'),
          where('stock', '>=', 1),
          where('stock', '<=', 3),
          orderBy('stock', 'asc'),
        ),
      ),
    );

    const productosPocoStock = productosSnap.docs.map((d) => d.data());
    const resumenStock =
      productosPocoStock.length > 0
        ? `Productos con stock entre 1 y 3 unidades: ${productosPocoStock
            .slice(0, 5)
            .map((p) => `${p['referencia']} (${p['stock']} uds)`)
            .join(', ')}${productosPocoStock.length > 5 ? '...' : ''}.`
        : 'El inventario está en buen nivel, sin referencias críticas por el momento.';

    const contextoAlertas =
      alertasActuales.length > 0
        ? alertasActuales.map((a) => `- ${a.titulo}`).join('\n')
        : 'Sin alertas activas hoy.';

    try {
      const result = await this.gateway.crear('alertas', {
        model: 'openai/gpt-oss-120b',
        messages: [
          {
            role: 'system',
            content: `Eres el asistente de ShoeShop, una tienda de calzado en un centro comercial de Colombia con cientos de locales de zapatos.
Genera UN consejo práctico y concreto para el administrador basado en el estado actual del negocio.
El consejo debe ser accionable hoy mismo, en máximo 2 oraciones.
Responde solo el consejo, sin saludos ni introducciones. Tono directo y profesional.`,
          },
          {
            role: 'user',
            content: `Estado del negocio hoy:
${contextoAlertas}

${resumenStock}

Dame un consejo práctico para hoy.`,
          },
        ],
        temperature: 0.8,
        max_tokens: 120,
      });

      return (
        result.choices[0]?.message?.content?.trim() ??
        'Revisa el estado de los préstamos activos y confirma los pedidos pendientes antes del mediodía.'
      );
    } catch {
      return productosPocoStock.length > 0
        ? `Tienes ${productosPocoStock.length} referencia${productosPocoStock.length > 1 ? 's' : ''} con stock entre 1 y 3 unidades. Considera hacer el pedido de reposición hoy.`
        : 'Buen día para revisar metas semanales y motivar al equipo de ventas.';
    }
  }

  private async generarMensajeIA(
    alertas: Alerta[],
    nombreUsuario: string,
  ): Promise<string> {
    if (alertas.length === 0) {
      return `¡Buenos días${nombreUsuario ? ', ' + nombreUsuario : ''}! 🎉 Todo está en orden hoy. No hay alertas pendientes. ¡A vender!`;
    }

    const resumenAlertas = alertas
      .map((a) => `- ${a.titulo}: ${a.descripcion}`)
      .join('\n');

    try {
      const result = await this.gateway.crear('alertas', {
        model: 'openai/gpt-oss-120b',
        messages: [
          {
            role: 'system',
            content: `Eres el asistente de ShoeShop, una tienda de calzado en Colombia dentro de un centro comercial con 400+ locales de zapatos. 
Genera un saludo de buenos días breve, amigable y directo para ${nombreUsuario || 'el administrador'}.
Resume las alertas del día en 3-4 líneas máximo usando emojis.
Termina con UNA recomendación concreta de qué atender primero.
Responde en español, tono profesional pero cercano.`,
          },
          {
            role: 'user',
            content: `Alertas de hoy:\n${resumenAlertas}\n\nGenera el mensaje de buenos días.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      });

      return (
        result.choices[0]?.message?.content ??
        `Buenos días${nombreUsuario ? ', ' + nombreUsuario : ''}. Tienes ${alertas.length} alertas pendientes hoy.`
      );
    } catch {
      return `Buenos días${nombreUsuario ? ', ' + nombreUsuario : ''} 👋 Tienes ${alertas.length} alerta${alertas.length > 1 ? 's' : ''} para revisar hoy.`;
    }
  }

  private getInicioSemana(): Date {
    const hoy = new Date();
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - hoy.getDay());
    inicio.setHours(0, 0, 0, 0);
    return inicio;
  }

  limpiarResumen(): void {
    this.resumenSubject.next(null);
  }
}
