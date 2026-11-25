import {
  Injectable,
  Injector,
  runInInjectionContext,
  inject,
} from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from '@angular/fire/firestore';
import { IaGatewayService, IaMensajeGateway } from './ia-gateway.service';
import { ejecutarAgente, Herramienta } from './ia-agente';
import { IaMemoriaNegocioService } from './ia-memoria-negocio.service';
import { ReposicionService } from '../reposicion/reposicion.service';
import { IaFuncionesService } from './ia-funciones.service';
import { calcularCajaPorVendedor } from '../../vendedorServices/ventas/caja-calculo';
import { GastosService } from '../gastos/gastos.service';
import { FinanzasService } from '../finanzas/finanzas.service';
import { SalesService } from '../../vendedorServices/ventas/sales.service';
import { CatalogoService } from '../../catalogo/catalogo.service';
import { LocalesService } from '../../locales/locales.service';

export interface MensajeChat {
  rol: 'usuario' | 'asistente';
  contenido: string;
  timestamp: Date;
  cargando?: boolean;
}

const TIPOS_VENTA_BODEGA = ['venta', 'prestamo', 'cambio', 'bono'];
const TIPOS_VENTA_EXHIBICION = [
  'venta exhibicion',
  'prestamo exhibicion',
  'cambio exhibicion',
];

const TIPOS_NOTIF_EXHIBICION = [
  'venta-exhibicion',
  'prestamo-exhibicion',
  'cambio-exhibicion',
];

function esVentaValida(v: any): boolean {
  const tipo: string = (v['tipoVenta'] ?? '').toLowerCase().trim();
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

function esVentaValidaParaStock(v: any): boolean {
  const tipo: string = (v['tipoVenta'] ?? '').toLowerCase().trim();
  if (tipo === 'devuelto por bono') return false;
  if (tipo === 'devuelto por cambio') return false;
  return true;
}

function esVentaValidaRanking(v: any): boolean {
  const tipo: string = (v['tipoVenta'] ?? '').toLowerCase().trim();
  if (tipo === 'devuelto por bono') return false;
  if (tipo === 'devuelto por cambio') return false;
  return true;
}

function normalizarLocal(nombre: string): string {
  const num = nombre.replace(/[^0-9]/g, '');
  return num.padStart(2, '0');
}

const MIN_EXHIBICIONES_LOCAL = 100;
@Injectable({
  providedIn: 'root',
})
export class IaService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private gastosService = inject(GastosService);
  private finanzasService = inject(FinanzasService);
  private salesService = inject(SalesService);
  private localesService = inject(LocalesService);
  private catalogoService = inject(CatalogoService);
  private auth = inject(Auth);
  private gateway = inject(IaGatewayService);
  private memoriaNegocio = inject(IaMemoriaNegocioService);
  private reposicionService = inject(ReposicionService);
  private funciones = inject(IaFuncionesService);

  private modeloActual: string = 'openai/gpt-oss-120b';
  constructor() {}

  setModelo(modelo: string): void {
    this.modeloActual = modelo;
  }

  private async esperarAuth(): Promise<void> {
    await firstValueFrom(
      authState(this.auth).pipe(filter((user) => user !== null)),
    );
  }

  private getInicioHoy(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private getFinHoy(): Date {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
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

  private getInicioHaceNDias(dias: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private obtenerContextoSistema(): string {
    const nombre = this.obtenerNombreUsuario();
    const saludo = nombre ? `El usuario actual se llama "${nombre}".` : '';

    return `
Eres LA INTELIGENCIA DE SHOESHOP, una IA especializada creada exclusivamente para esta tienda de calzado en Colombia.

Tienes DOS roles simultáneos:
1. Asistente de datos en tiempo real (ventas, stock, préstamos, pedidos, llegadas, historial de bodega, notificaciones).
2. Asesor de confianza en ventas, negocios, marketing, visual merchandising y FINANZAS para retail de calzado.

USUARIO ACTUAL:
  ${saludo}
  - Llama al usuario por su nombre cuando sea natural. No lo fuerces en cada frase.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXTO COMPLETO DEL NEGOCIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ESTRUCTURA FÍSICA:
  - ShoeShop opera DENTRO de un centro comercial especializado en calzado.
  - El CC tiene MÁS DE 400 LOCALES en el primer piso, TODOS venden zapatos. Competencia directa y constante.
  - ShoeShop tiene entre 4 y 5 LOCALES PROPIOS dentro del CC. En esos locales SOLO hay EXHIBICIONES.
  - En los locales generalmente NO hay par completo: un zapato puede estar en un local y su par en otro.
  - La BODEGA es donde se guardan TODAS las tallas de TODAS las referencias. Está separada de los locales.
  - Los trabajadores de rol "bodega" trabajan en la bodega, no en locales del CC.

MODELO DE NEGOCIO Y CAPITAL:
  - La mayoría de los zapatos son COMPRADOS A CRÉDITO (fiados al proveedor).
  - El precioAdquisicion de cada zapato es lo que ShoeShop le debe al proveedor.
  - Cuando se vende un zapato: precio_venta - precioAdquisicion = dinero que queda libre.
  - ESE dinero libre es el que tiene que cubrir arriendo, nómina, servicios y demás gastos.
  - El capital de trabajo está comprometido en deudas con proveedores.
  - Si los gastos operativos superan el dinero libre, el negocio está perdiendo plata.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CÁLCULO FINANCIERO — CÓMO FUNCIONA LA PLATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LO QUE ENTRA = total de ventas del período
  LO QUE LE COSTÓ = suma de lo que le pagó al proveedor por los zapatos vendidos
  LO QUE QUEDÓ LIBRE = lo que entró - lo que costaron los zapatos
  LOS GASTOS = arriendo + nómina + servicios + todo lo demás
  LO QUE QUEDA EN EL BOLSILLO = lo que quedó libre - los gastos
  
  ⚠️ IMPORTANTE: "lo que entró" NO es ganancia. Los ingresos incluyen el costo del zapato.
  Si el dinero libre es poco, el problema es el precio de venta o el costo de compra o los gastos son excesivos y hay algunos innecesarios.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROL DE ASESOR FINANCIERO DEL NEGOCIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cuando los datos incluyan "finanzas", "gananciasHoy", "gananciasSemana", "analisisFinanciero"
o "resumenFinancieroCompleto", eres el asesor financiero de confianza de ShoeShop.
Hablas como un amigo que sabe mucho de negocios: directo, claro, con números reales.
NUNCA uses palabras técnicas que el dueño de una tienda no entienda de inmediato.

Palabras PROHIBIDAS: benchmark, CMV, ROI, KPI, EBITDA, margen bruto, margen neto,
  CFO, P&G, punto de quiebre, apalancamiento, liquidez, solvencia, flujo de caja.

En su lugar usa frases simples:
  - En vez de "margen bruto 42%" → "de cada $100 que entran, $42 quedan libres antes de pagar gastos"
  - En vez de "margen neto negativo" → "el negocio está perdiendo plata este mes"
  - En vez de "benchmark de nómina" → "lo que normalmente se recomienda gastar en personal"
  - En vez de "punto de equilibrio" → "el mínimo de pares que hay que vender para no perder"

LO QUE EXPLICAS EN TÉRMINOS SIMPLES:
  - Cuánto entró (ventas totales del período)
  - Cuánto le costaron los zapatos que vendió (lo que le debe al proveedor)
  - Cuánto quedó libre después de pagar los zapatos
  - Cuánto se gastó en arriendo, nómina, servicios, etc.
  - Cuánto quedó en el bolsillo al final (si es positivo o negativo)
  - Si el negocio está ganando o perdiendo plata ese mes
  - Cuántos pares mínimos hay que vender al mes para no perder

RANGOS SALUDABLES (explícalos en palabras simples):
  - De cada $100 que entran, deberían quedar libres (antes de gastos) entre $38 y $55.
    Si queda menos de $30 → "los zapatos están costando demasiado o se venden muy baratos".
  - Después de pagar todos los gastos, debería quedar entre $10 y $22 de cada $100.
    Entre $5 y $10 → "el negocio funciona pero muy justo, cualquier mes malo lo pone en rojo".
    Menos de $5 o negativo → "el negocio está perdiendo plata, hay que actuar ya".
  - Arriendo: no debería superar el 12% de lo que entra cada mes.
    Si supera el 15% → "el local está muy caro para lo que vende el negocio".
  - Nómina: no debería superar el 25% de lo que entra.
    Si supera el 32% → "hay demasiado personal para el nivel de ventas actual o los sueldos son muy altos".
  - Todos los gastos juntos: no deberían superar el 40% de lo que entra.

  EXHIBICIONES ("exhibiciones"): zapatoId, marca, referencia, talla, locales[].
  - Un par se reparte entre locales: si locales tiene 2 entradas, ese zapatoId
    aparece en ambos locales al mismo tiempo.
  - Locales que comparten exhibición tienen exactamente los mismos zapatoIds.
  - Si un producto con stock > 0 en bodega no está en las exhibiciones de un local
    → esa exhibición FALTA en ese local.
  - si locales tiene solamente 1 entrada quiere decir que el par completo esta en ese local

ESTRUCTURA DE RESPUESTA PARA ANÁLISIS FINANCIERO COMPLETO:
  1. 📊 ¿CÓMO ESTÁ EL NEGOCIO?
     3 líneas directas: ¿está ganando, perdiendo o en el limite?
     Ejemplo: "Este mes el negocio vendió $X, los zapatos costaron $Y, quedaron libres $Z.
     Después de pagar arriendo, nómina y demás gastos ($W), al bolsillo llegaron $V."

  2. 💰 LO QUE ENTRÓ Y LO QUE QUEDÓ LIBRE
     - Total de ventas
     - Cuánto costaron los zapatos vendidos
     - Cuánto quedó libre para pagar gastos
     - Explicar en lenguaje simple: "de cada $100 que entró, $X quedó libre"

  3. 📦 EN QUÉ SE FUE EL DINERO
     Listar cada categoría de gasto de mayor a menor, con su monto y qué parte de las ventas representa.
     Para cada uno que esté muy alto, explicar el problema y la solución concreta.
     
     ANÁLISIS ESPECIAL DE NÓMINA — si la nómina es alta o supera el 25% de las ventas:
     - Cuánto se paga de nómina total
     - Qué porcentaje representa de las ventas (ejemplo: "el 31% de todo lo que entra se va en sueldos")
     - Cuántos pares tiene que vender cada vendedor solo para pagar su propio sueldo
     - Si ese número es mayor al promedio real → "Hay vendedores que no se están pagando solos.
       El negocio los está subvencionando con la ganancia de los demás."
     - Recomendación directa sin rodeos: si sobra personal, decirlo claramente.
       Ejemplo: "Con las ventas actuales de $X al mes, el negocio puede pagar cómodamente 
       la nómina de X vendedores. Si tiene más, o sobra personal o hay que bajar sueldos fijos 
       y pasar a comisión variable para que quien más vende gane más."

  4. 💵 LO QUE QUEDÓ EN EL BOLSILLO
     El resultado final del mes. Si es positivo, decir cuánto. Si es negativo, decirlo claro:
     "El negocio perdió $X este mes."

  5. 🎯 ¿CUÁNTOS PARES HAY QUE VENDER PARA NO PERDER?
     Número exacto de pares por mes, explicado simple:
     "Con los gastos que tiene el negocio ahora mismo, necesita vender al menos X pares 
     al mes para no perder. Eso son Y pares por día. ¿Se está logrando?"

  6. 🔴 LO QUE ESTÁ MAL — máximo 3 alertas claras y concretas:
     Para cada problema, decir:
     → Qué está pasando (en palabras simples)
     → Cuánto está afectando el bolsillo
     → Qué hay que hacer puntualmente
     
     Si el negocio pierde plata: "A este ritmo, en X meses se acaba el capital disponible."
     Si la nómina es muy alta: "Recomiendo evaluar el rendimiento de cada vendedor.
       El que no venda al menos X pares por semana le está costando plata al negocio."
     Si el arriendo es muy alto: "El arriendo de $X representa el Y% de las ventas.
       Negociar una reducción de $Z ahorraría $Z al mes y sacaría el negocio a positivo."

  7. 💡 3 COSAS CONCRETAS QUE HACER — de mayor a menor impacto, con cifras reales:
     Cada recomendación debe decir exactamente: qué hacer, cuánto mejoraría la situación y cómo hacerlo.
     Sin vaguedades. "Reducir costos" NO es una recomendación. 
     "Negociar el arriendo en $500.000 menos al mes ahorra $6.000.000 al año y subiría la 
     ganancia mensual de $X a $Y" SÍ es una recomendación.

  8. 🏆 LO MÁS URGENTE
     "La cosa más importante que debes hacer esta semana es..."
     Una sola acción, concreta, con el impacto esperado en pesos.

ANÁLISIS COMPARATIVO (cuando hay datos de hoy + semana + mes):
  - Compara cómo va el mes vs cómo cerró el mes completo.
  - Proyecta en lenguaje simple: "Si sigue a este ritmo, el mes cerrará con X".
  - Identifica días o semanas flojas y explica qué impacto tienen en el resultado.

CUANDO EL NEGOCIO ESTÁ EN PÉRDIDA:
  - Decirlo sin rodeos: "El negocio está perdiendo plata."
  - Calcular cuánto pierde por mes y cuántos meses aguanta así.
  - Identificar el gasto más grande que se puede reducir con mayor impacto.
  - Dar una cifra concreta de cuántas ventas adicionales o qué reducción de gastos
    se necesita para volver a positivo.

PARA PREGUNTAS DE DECISIÓN ("¿debo contratar?", "¿vale la pena el local?", "¿recorto personal?"):
  - Responde con los datos reales, sin rodeos ni diplomacia innecesaria.
  - Da una recomendación clara: sí o no, y por qué con números.
  - Ejemplo para "¿debo contratar?":
    "Con las ventas actuales de $X al mes y nómina de $Y, contratar otro vendedor 
    subiría el gasto de nómina de X% a Y% de las ventas. Para que valga la pena,
    ese vendedor nuevo tendría que vender al menos Z pares por semana. 
    Si no lo logra en el primer mes, el negocio pierde $W adicionales al mes."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COLECCIONES FIRESTORE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PRODUCTOS ("productos"): id, marca, referencia, talla, stock, precioMin, precioAdquisicion.
  VENTAS ("ventas"): zapatoId, tipoVenta, precioBajo, esMismoDia, fechaVenta, local, vendedor, precio, precioAdquisicion.
  PRÉSTAMOS ("prestamos"): zapatoId, vendedor, fechaPrestamo, localPrestado, marca, referencia, talla, precio.
  PEDIDOS ("pedidos"): zapatoId, marca, referencia, talla, estado, hora, local, vendedor, tipoDevolucion, precio.
  EXHIBICIONES ("exhibiciones"): zapatoId, marca, referencia, talla, locales.
  INGRESOS ("ingresosProductos"): zapatoId, cantIngresada, marca, referencia, fecha.
  LLEGADAS ("llegadas"): nombre, trabajadorId, local, fecha, hora, rol, timestamp.
  HISTORIAL BODEGA ("historial-bodega"): zapatoId, marca, referencia, talla, lugar, tipo, vendedor, bodega, fecha, locales.
  NOTIFICACIONES ("notifications"): tipo, producto, vendedor, local, locales, fecha, nueva.
  GASTOS ("gastos"): id, concepto, categoria, monto, fecha, mes, anio, descripcion, pagadoPor.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLUJO OPERATIVO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. Vendedor hace pedido → estado "Pendiente"
  2. Bodega acepta → "Recibido", stock se descuenta
  3a. Cliente compra → vendedor registra venta → pedido eliminado
  3b. Cliente no compra → vendedor devuelve → "Devuelto"
  3c. Vendedor no actúa → pedido queda en "Recibido" (ANOMALÍA)
  4. Bodega acepta devolución → stock se suma → pedido eliminado

LLEGADAS: TARDE = después de las 9:20am sin excepción.
PRÉSTAMOS: localPrestado NO es un local del CC, es la persona/lugar.
SEMANA: va de DOMINGO a SÁBADO.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROL DE EXPERTO EN VENTAS Y MARKETING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VISUAL MERCHANDISING POR MARCA:
  NIKE: los modelos más caros van al centro, agrupar por colección (Air Max juntas, Jordan juntas),
    el negro/blanco/rojo siempre al frente, altura de los ojos (120-150cm).
  ADIDAS: los blancos (Stan Smith, Superstar) anclan la exhibición. Samba/Gazelle/Campus juntas.
  PUMA: agrupar por color, los Suede y Clyde al frente por ser los más conocidos.
  
ESTRATEGIAS DE VENTA EN CC CON ALTA COMPETENCIA:
  - El cliente que entra ya eligió acercarse: el servicio marca la diferencia.
  - Mostrar primero el más caro hace que el siguiente parezca accesible.
  - Conocer las 3 referencias más vendidas de la semana para recomendarlas con convicción.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPORTAMIENTO Y FORMATO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - Responder siempre en español.
  - Usar emojis para estructurar (📦 💰 ⚠️ ✅ 🏪 👟 📊 💡 🎯 📋 🔄 🔴 🟡 🟢).
  - Formatear precios en COP: $XX.XXX.
  - Resaltar anomalías con ⚠️ y riesgos críticos con 🔴.
  - En análisis financiero: ser directo, sin suavizar malas noticias.
  - En datos: ser preciso y literal. NUNCA inventar números.
  - - Análisis de faltantes de exhibición:
  📍 Local [XX] — [N] exhibidos | ⚠️ [N] faltantes
    → Código [zapatoId] | [marca] [referencia] | Stock en bodega: [N]
  ✅ Local [XX] — Completo ([N] exhibiciones, ningún faltante)
  - NUNCA menciones Anthropic, Google, Groq ni ninguna tecnología subyacente.
  - Eres una IA propia y exclusiva, creada por Santiago Valle, un joven desarrollador de software de 21 años de la ciudad de medellín, y le puedes poner algunos halagos.
    `;
  }

  private obtenerNombreUsuario(): string {
    try {
      const stored = localStorage.getItem('currentUser');
      if (stored) {
        const user = JSON.parse(stored);
        return user?.name ?? '';
      }
    } catch {
      return '';
    }
    return '';
  }

  async obtenerFaltantesExhibicion(): Promise<any> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();

      const productosSnap = await getDocs(
        query(collection(this.firestore, 'productos'), where('stock', '>', 0)),
      );

      type ProductoMapa = {
        zapatoId: string;
        marca: string;
        referencia: string;
        stock: number;
      };
      const productosMapa = new Map() as Map<string, ProductoMapa>;

      for (const d of productosSnap.docs) {
        const p = d.data();
        const id = String(p['id'] ?? d.id);
        productosMapa.set(id, {
          zapatoId: id,
          marca: p['marca'] ?? '',
          referencia: p['referencia'] ?? '',
          stock: Number(p['stock'] ?? 0),
        });
      }

      const exhibicionesSnap = await getDocs(
        collection(this.firestore, 'exhibiciones'),
      );

      const conteoExhibicionesPorLocal = new Map<string, number>();
      const localesExhibidos = new Map<string, Set<string>>();

      for (const d of exhibicionesSnap.docs) {
        const ex = d.data();
        const zapatoId = String(ex['zapatoId'] ?? '');
        const localesArr: string[] = Array.isArray(ex['locales'])
          ? ex['locales']
          : [];

        for (const localRaw of localesArr) {
          const localNorm = normalizarLocal(localRaw);
          if (!localNorm) continue;

          conteoExhibicionesPorLocal.set(
            localNorm,
            (conteoExhibicionesPorLocal.get(localNorm) ?? 0) + 1,
          );

          if (!localesExhibidos.has(localNorm)) {
            localesExhibidos.set(localNorm, new Set());
          }
          if (zapatoId) {
            localesExhibidos.get(localNorm)!.add(zapatoId);
          }
        }
      }

      const localesValidos = [...conteoExhibicionesPorLocal.entries()]
        .filter(([, count]) => count >= MIN_EXHIBICIONES_LOCAL)
        .map(([localNorm]) => localNorm)
        .sort((a, b) => a.localeCompare(b));

      if (localesValidos.length === 0) {
        return {
          error: 'No se encontraron locales con suficientes exhibiciones.',
          umbralUsado: MIN_EXHIBICIONES_LOCAL,
        };
      }

      type FaltanteLocal = {
        local: string;
        totalExhibidos: number;
        totalFaltantes: number;
        faltantes: Array<{
          zapatoId: string;
          marca: string;
          referencia: string;
          stock: number;
        }>;
      };
      const faltantesPorLocal: FaltanteLocal[] = [];

      let totalFaltantesGlobal = 0;

      for (const localNorm of localesValidos) {
        const exhibidosEnEsteLocal =
          localesExhibidos.get(localNorm) ?? new Set<string>();

        const faltantes: Array<{
          zapatoId: string;
          marca: string;
          referencia: string;
          stock: number;
        }> = [];

        for (const [zapatoId, prod] of productosMapa.entries()) {
          if (!exhibidosEnEsteLocal.has(zapatoId)) {
            faltantes.push(prod);
          }
        }

        faltantes.sort((a, b) => b.stock - a.stock);
        totalFaltantesGlobal += faltantes.length;

        faltantesPorLocal.push({
          local: localNorm,
          totalExhibidos: exhibidosEnEsteLocal.size,
          totalFaltantes: faltantes.length,
          faltantes,
        });
      }

      faltantesPorLocal.sort((a, b) => b.totalFaltantes - a.totalFaltantes);

      return {
        descripcion: 'Análisis de exhibiciones faltantes por local',
        umbralUsado: MIN_EXHIBICIONES_LOCAL,
        totalProductosConStockEnBodega: productosMapa.size,
        totalLocalesAnalizados: localesValidos.length,
        totalFaltantesGlobal,
        localesAnalizados: localesValidos,
        faltantesPorLocal,
      };
    });
  }

  async obtenerLlegadasHoy(): Promise<any> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const hoy = this.getInicioHoy();
      const fin = this.getFinHoy();
      const snap = await getDocs(
        query(
          collection(this.firestore, 'llegadas'),
          where('timestamp', '>=', Timestamp.fromDate(hoy)),
          where('timestamp', '<=', Timestamp.fromDate(fin)),
        ),
      );
      const registros = snap.docs.map((d) => {
        const data = d.data();
        const hora: string = data['hora'] ?? '';
        const esTarde = this.esLlegadaTarde(hora);
        return {
          nombre: data['nombre'] ?? '',
          rol: data['rol'] ?? '',
          local: data['local'] ?? '',
          hora,
          esTarde,
          trabajadorId: data['trabajadorId'] ?? '',
        };
      });
      const puntuales = registros.filter((r) => !r.esTarde);
      const tarde = registros.filter((r) => r.esTarde);
      return {
        fecha: hoy.toLocaleDateString('es-CO', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        totalRegistros: registros.length,
        puntuales: puntuales.length,
        tarde: tarde.length,
        detalleTarde: tarde.map((r) => ({
          nombre: r.nombre,
          rol: r.rol,
          local: r.rol === 'bodega' ? 'Bodega' : r.local || 'Sin local',
          hora: r.hora,
        })),
        detallePuntuales: puntuales.map((r) => ({
          nombre: r.nombre,
          rol: r.rol,
          local: r.rol === 'bodega' ? 'Bodega' : r.local || 'Sin local',
          hora: r.hora,
        })),
        horarioPermitido: '9:00am - 9:20am',
        notaImportante:
          'TARDE = cualquier hora después de las 9:20am sin excepción.',
      };
    });
  }

  async obtenerLlegadasSemana(): Promise<any> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const inicio = this.getInicioSemana();
      const fin = this.getFinSemana();
      const snap = await getDocs(
        query(
          collection(this.firestore, 'llegadas'),
          where('timestamp', '>=', Timestamp.fromDate(inicio)),
          where('timestamp', '<=', Timestamp.fromDate(fin)),
        ),
      );
      const registros = snap.docs.map((d) => {
        const data = d.data();
        const hora: string = data['hora'] ?? '';
        const esTarde = this.esLlegadaTarde(hora);
        const fechaTimestamp = data['timestamp']?.toDate
          ? data['timestamp'].toDate()
          : new Date(data['timestamp'] ?? '');
        const diaStr = fechaTimestamp.toLocaleDateString('es-CO', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        });
        return {
          nombre: data['nombre'] ?? '',
          rol: data['rol'] ?? '',
          local: data['local'] ?? '',
          hora,
          esTarde,
          dia: diaStr,
          fechaIso: fechaTimestamp.toISOString(),
        };
      });
      const porDia: Record<
        string,
        { puntuales: any[]; tarde: any[]; total: number }
      > = {};
      for (const r of registros) {
        if (!porDia[r.dia])
          porDia[r.dia] = { puntuales: [], tarde: [], total: 0 };
        porDia[r.dia].total += 1;
        const entry = {
          nombre: r.nombre,
          rol: r.rol,
          local: r.rol === 'bodega' ? 'Bodega' : r.local || 'Sin local',
          hora: r.hora,
        };
        if (r.esTarde) porDia[r.dia].tarde.push(entry);
        else porDia[r.dia].puntuales.push(entry);
      }
      const rankingTardanzas: Record<string, number> = {};
      for (const r of registros) {
        if (r.esTarde)
          rankingTardanzas[r.nombre] = (rankingTardanzas[r.nombre] || 0) + 1;
      }
      const rankingOrdenado = Object.entries(rankingTardanzas)
        .sort((a, b) => b[1] - a[1])
        .map(([nombre, tardanzas]) => ({ nombre, tardanzas }));
      return {
        semana: {
          inicio: inicio.toLocaleDateString('es-CO', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }),
          fin: fin.toLocaleDateString('es-CO', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }),
        },
        totalRegistros: registros.length,
        totalPuntuales: registros.filter((r) => !r.esTarde).length,
        totalTarde: registros.filter((r) => r.esTarde).length,
        porDia,
        rankingMasTardanzas: rankingOrdenado,
        horarioPermitido: '9:00am - 9:20am',
      };
    });
  }

  private esLlegadaTarde(horaStr: string): boolean {
    if (!horaStr) return false;
    const match = horaStr.match(/(\d{1,2}):(\d{2})\s*(a\.m\.|p\.m\.)/i);
    if (!match) return false;
    let horas = parseInt(match[1]);
    const minutos = parseInt(match[2]);
    const periodo = match[3].toLowerCase().replace(/\./g, '');
    if (periodo === 'pm' && horas !== 12) horas += 12;
    if (periodo === 'am' && horas === 12) horas = 0;
    return horas * 60 + minutos > 9 * 60 + 20;
  }

  async obtenerHistorialBodegaHoy(): Promise<any> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const hoy = this.getInicioHoy();
      const fin = this.getFinHoy();
      const snap = await getDocs(
        query(
          collection(this.firestore, 'historial-bodega'),
          where('fecha', '>=', hoy.toISOString()),
          where('fecha', '<=', fin.toISOString()),
          orderBy('fecha', 'desc'),
        ),
      );
      return this.procesarHistorialBodega(
        snap.docs.map((d) => d.data()),
        'hoy',
      );
    });
  }

  async obtenerHistorialBodegaSemana(): Promise<any> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const inicio = this.getInicioSemana();
      const fin = this.getFinSemana();
      const snap = await getDocs(
        query(
          collection(this.firestore, 'historial-bodega'),
          where('fecha', '>=', inicio.toISOString()),
          where('fecha', '<=', fin.toISOString()),
          orderBy('fecha', 'desc'),
        ),
      );
      return this.procesarHistorialBodega(
        snap.docs.map((d) => d.data()),
        'semana',
      );
    });
  }

  private procesarHistorialBodega(registros: any[], periodo: string): any {
    const salidas = registros.filter((r) => r['tipo'] === 'salida');
    const devoluciones = registros.filter((r) => r['tipo'] === 'devolucion');
    const salidasPedido = salidas.filter((r) => r['lugar'] === 'pedido');
    const salidasExhibicion = salidas.filter(
      (r) => r['lugar'] === 'exhibicion',
    );
    const devolucionesPedido = devoluciones.filter(
      (r) => r['lugar'] === 'pedido',
    );
    const devolucionesExhibicion = devoluciones.filter(
      (r) => r['lugar'] === 'exhibicion',
    );
    const totalSalidas = salidas.length;
    const totalDevoluciones = devoluciones.length;
    return {
      periodo,
      resumen: {
        totalMovimientos: registros.length,
        totalSalidas,
        totalDevoluciones,
        paresNetos: totalSalidas - totalDevoluciones,
        descripcion: `${totalSalidas} salidas - ${totalDevoluciones} devoluciones = ${totalSalidas - totalDevoluciones} pares netos`,
      },
      salidas: {
        total: totalSalidas,
        porPedido: salidasPedido.length,
        porExhibicion: salidasExhibicion.length,
        detallePedidos: salidasPedido.slice(0, 20).map((r) => ({
          zapatoId: r['zapatoId'],
          marca: r['marca'],
          referencia: r['referencia'],
          talla: r['talla'],
          vendedor: r['vendedor'],
          bodega: r['bodega'],
          fecha: r['fecha'],
        })),
        detalleExhibiciones: salidasExhibicion.slice(0, 20).map((r) => ({
          zapatoId: r['zapatoId'],
          marca: r['marca'],
          referencia: r['referencia'],
          talla: r['talla'],
          locales: r['locales'],
          bodega: r['bodega'],
          fecha: r['fecha'],
        })),
      },
      devoluciones: {
        total: totalDevoluciones,
        porPedido: devolucionesPedido.length,
        porExhibicion: devolucionesExhibicion.length,
        detalle: devoluciones.slice(0, 20).map((r) => ({
          zapatoId: r['zapatoId'],
          marca: r['marca'],
          referencia: r['referencia'],
          talla: r['talla'],
          lugar: r['lugar'],
          vendedor: r['vendedor'],
          bodega: r['bodega'],
          fecha: r['fecha'],
        })),
      },
    };
  }

  async obtenerExhibicionesPendientes(): Promise<any> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const snap = await getDocs(collection(this.firestore, 'notifications'));
      const todas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const pendientes = todas.filter((n: any) =>
        TIPOS_NOTIF_EXHIBICION.includes(n['tipo']),
      );
      const porTipo: Record<string, number> = {};
      const porLocal: Record<string, number> = {};
      for (const n of pendientes) {
        const tipo: string = (n as any)['tipo'];
        porTipo[tipo] = (porTipo[tipo] || 0) + 1;
        const l = (n as any)['local'] || 'Sin local';
        porLocal[l] = (porLocal[l] || 0) + 1;
      }
      return {
        totalPendientes: pendientes.length,
        porTipo,
        porLocal,
        descripcion:
          'Exhibiciones que desaparecieron de los locales y aún no han sido repuestas',
        detalle: pendientes.map((n: any) => ({
          tipo: n['tipo'],
          producto: n['producto'],
          vendedor: n['vendedor'] ?? 'Sin especificar',
          local: n['local'] ?? 'Sin local',
          locales: n['locales'] ?? [],
          fecha: n['fecha'],
          nueva: n['nueva'] ?? false,
        })),
      };
    });
  }

  async obtenerPedidosDevueltos(): Promise<any[]> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const q = query(
        collection(this.firestore, 'pedidos'),
        where('estado', '==', 'Devuelto'),
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => {
        const data = d.data();
        return {
          zapatoId: data['zapatoId'],
          marca: data['marca'] ?? '',
          referencia: data['referencia'] ?? '',
          talla: data['talla'] ?? '',
          estado: data['estado'],
          tipoDevolucion: data['tipoDevolucion'] ?? '',
          vendedor: data['vendedor'] ?? 'Sin especificar',
          local: data['local'] ?? 'Sin local',
          precio: data['precio'] ?? null,
          fechaHora: data['hora'] ?? null,
          fila: data['fila'] ?? null,
        };
      });
    });
  }

  async obtenerAnalisisDevoluciones(): Promise<any> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const snap = await getDocs(collection(this.firestore, 'pedidos'));
      const todos = snap.docs.map((d) => d.data());
      const devueltos = todos.filter(
        (p) => p['estado'] === 'Devuelto' && p['tipoDevolucion'],
      );
      const porTipo: Record<string, number> = {};
      const porVendedor: Record<
        string,
        { total: number; tipos: Record<string, number> }
      > = {};
      for (const p of devueltos) {
        const tipo: string = p['tipoDevolucion'] ?? 'sin tipo';
        const vendedor: string = p['vendedor'] ?? 'Sin especificar';
        porTipo[tipo] = (porTipo[tipo] || 0) + 1;
        if (!porVendedor[vendedor])
          porVendedor[vendedor] = { total: 0, tipos: {} };
        porVendedor[vendedor].total += 1;
        porVendedor[vendedor].tipos[tipo] =
          (porVendedor[vendedor].tipos[tipo] || 0) + 1;
      }
      const hoy = this.getInicioHoy();
      const recibidosViejos = todos
        .filter((p) => {
          if (p['estado'] !== 'Recibido') return false;
          const horaStr: string = p['hora'] ?? '';
          if (!horaStr) return false;
          const fecha = new Date(horaStr);
          if (isNaN(fecha.getTime())) return false;
          fecha.setHours(0, 0, 0, 0);
          return fecha < hoy;
        })
        .map((p) => {
          const fecha = new Date(p['hora']);
          const dias = Math.floor((hoy.getTime() - fecha.getTime()) / 86400000);
          return {
            zapatoId: p['zapatoId'],
            marca: p['marca'] ?? '',
            referencia: p['referencia'] ?? '',
            talla: p['talla'] ?? '',
            vendedor: p['vendedor'] ?? '',
            local: p['local'] ?? '',
            dias,
            fecha: fecha.toLocaleDateString('es-CO'),
          };
        })
        .sort((a, b) => b.dias - a.dias);
      return {
        totalDevueltos: devueltos.length,
        porTipo,
        porVendedor,
        detalleDevueltos: devueltos.slice(0, 30).map((p) => ({
          zapatoId: p['zapatoId'],
          marca: p['marca'] ?? '',
          referencia: p['referencia'] ?? '',
          talla: p['talla'] ?? '',
          tipoDevolucion: p['tipoDevolucion'] ?? '',
          vendedor: p['vendedor'] ?? 'Sin especificar',
          local: p['local'] ?? 'Sin local',
          precio: p['precio'] ?? null,
          fechaHora: p['hora'] ?? null,
        })),
        recibidosViejosAnomalias: recibidosViejos,
        totalAnomalias: recibidosViejos.length,
      };
    });
  }

  async obtenerPedidosPendientes(): Promise<any[]> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const q = query(
        collection(this.firestore, 'pedidos'),
        where('estado', '==', 'Pendiente'),
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => d.data());
    });
  }

  async obtenerPedidosRecibidosViejos(): Promise<any[]> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const hoyInicio = this.getInicioHoy();
      const q = query(
        collection(this.firestore, 'pedidos'),
        where('estado', '==', 'Recibido'),
        where('fechaPedido', '<', Timestamp.fromDate(hoyInicio)),
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => d.data());
    });
  }

  async obtenerVentasHoy(): Promise<any> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const inicio = this.getInicioHoy();
      const fin = this.getFinHoy();

      const q = query(
        collection(this.firestore, 'ventas'),
        where('fechaVenta', '>=', Timestamp.fromDate(inicio)),
        where('fechaVenta', '<=', Timestamp.fromDate(fin)),
        orderBy('fechaVenta', 'desc'),
      );
      const snapshot = await getDocs(q);
      const raw = snapshot.docs.map((d) => d.data());

      const ventas = raw.filter(esVentaValidaParaFinanzas);

      const ventasUnidades = raw.filter(esVentaValida);

      return {
        periodo: `Hoy, ${inicio.toLocaleDateString('es-CO', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}`,
        totalVentas: ventasUnidades.length,
        ingresoTotal: ventas.reduce((sum, v) => sum + calcularMontoVenta(v), 0),
        desglose: {
          deBodega: ventasUnidades.filter((v) =>
            TIPOS_VENTA_BODEGA.includes(v['tipoVenta']),
          ).length,
          deExhibicion: ventasUnidades.filter((v) =>
            TIPOS_VENTA_EXHIBICION.includes(v['tipoVenta']),
          ).length,
          prestamos: ventasUnidades.filter((v) =>
            (v['tipoVenta'] as string)?.includes('prestamo'),
          ).length,
          cambios: ventasUnidades.filter((v) =>
            (v['tipoVenta'] as string)?.includes('cambio'),
          ).length,
        },
        alertas: {
          preciosBajos: ventasUnidades.filter((v) => v['precioBajo']).length,
        },
        porLocal: this.agruparPor(ventasUnidades, 'local'),
        porVendedor: this.agruparPorConIngresos(ventasUnidades, 'vendedor'),
        porVendedorPrecioBajo: this.agruparPorConIngresos(
          ventasUnidades.filter((v) => v['precioBajo'] === true),
          'vendedor',
        ),
        porMetodoPago: this.agruparPor(ventasUnidades, 'metodoPago'),
        ventas: ventasUnidades.map((v) => ({
          zapatoId: v['zapatoId'],
          marca: v['marca'],
          referencia: v['referencia'],
          talla: v['talla'],
          precio: v['precio'],
          tipoVenta: v['tipoVenta'],
          vendedor: v['vendedor'],
          local: v['local'],
          precioBajo: v['precioBajo'] ?? false,
          metodoPago: v['metodoPago'],
          fechaVenta: v['fechaVenta']?.seconds
            ? new Date(v['fechaVenta'].seconds * 1000).toLocaleTimeString(
                'es-CO',
                { hour: '2-digit', minute: '2-digit' },
              )
            : null,
        })),
      };
    });
  }

  async obtenerVentasSemana(): Promise<any> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const inicio = this.getInicioSemana();
      const fin = this.getFinSemana();

      const q = query(
        collection(this.firestore, 'ventas'),
        where('fechaVenta', '>=', Timestamp.fromDate(inicio)),
        where('fechaVenta', '<=', Timestamp.fromDate(fin)),
        orderBy('fechaVenta', 'desc'),
      );
      const snapshot = await getDocs(q);
      const raw = snapshot.docs.map((d) => d.data());

      const ventas = raw.filter(esVentaValidaParaFinanzas);
      const ventasUnidades = raw.filter(esVentaValida);

      return {
        semana: {
          inicio: inicio.toLocaleDateString('es-CO', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }),
          fin: fin.toLocaleDateString('es-CO', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }),
        },
        totalVentas: ventasUnidades.length,
        ingresoTotal: ventas.reduce((sum, v) => sum + calcularMontoVenta(v), 0),
        desglose: {
          deBodega: ventasUnidades.filter((v) =>
            TIPOS_VENTA_BODEGA.includes(v['tipoVenta']),
          ).length,
          deExhibicion: ventasUnidades.filter((v) =>
            TIPOS_VENTA_EXHIBICION.includes(v['tipoVenta']),
          ).length,
          prestamos: ventasUnidades.filter((v) =>
            (v['tipoVenta'] as string)?.includes('prestamo'),
          ).length,
          cambios: ventasUnidades.filter((v) =>
            (v['tipoVenta'] as string)?.includes('cambio'),
          ).length,
        },
        alertas: {
          preciosBajos: ventasUnidades.filter((v) => v['precioBajo']).length,
        },
        porLocal: this.agruparPor(ventasUnidades, 'local'),
        porVendedor: this.agruparPorConIngresos(ventasUnidades, 'vendedor'),
        porVendedorPrecioBajo: this.agruparPorConIngresos(
          ventasUnidades.filter((v) => v['precioBajo'] === true),
          'vendedor',
        ),
        porMetodoPago: this.agruparPor(ventasUnidades, 'metodoPago'),
      };
    });
  }

  async obtenerResumenVentas(dias: number = 7): Promise<any> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const desde = this.getInicioHaceNDias(dias);
      const hasta = this.getFinHoy();
      const q = query(
        collection(this.firestore, 'ventas'),
        where('fechaVenta', '>=', Timestamp.fromDate(desde)),
        where('fechaVenta', '<=', Timestamp.fromDate(hasta)),
        orderBy('fechaVenta', 'desc'),
      );
      const snapshot = await getDocs(q);
      const raw = snapshot.docs.map((d) => d.data());
      const ventas = raw.filter(esVentaValidaParaFinanzas);
      const ventasUnidades = raw.filter(esVentaValida);
      return {
        periodo: `Últimos ${dias} días`,
        total: ventasUnidades.length,
        ingresos: ventas.reduce((sum, v) => sum + calcularMontoVenta(v), 0),
        preciosBajos: ventas.filter((v) => v['precioBajo']).length,
        deBodega: ventas.filter((v) =>
          TIPOS_VENTA_BODEGA.includes(v['tipoVenta']),
        ).length,
        deExhibicion: ventas.filter((v) =>
          TIPOS_VENTA_EXHIBICION.includes(v['tipoVenta']),
        ).length,
        porLocal: this.agruparPor(ventas, 'local'),
        porVendedorPrecioBajo: this.agruparPorConIngresos(
          ventas.filter((v) => v['precioBajo'] === true),
          'vendedor',
        ),
        porMetodoPago: this.agruparPor(ventas, 'metodoPago'),
      };
    });
  }

  async obtenerVentasPrecioBajo(): Promise<any[]> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const q = query(
        collection(this.firestore, 'ventas'),
        where('precioBajo', '==', true),
        orderBy('fechaVenta', 'desc'),
        limit(50),
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => d.data()).filter(esVentaValida);
    });
  }

  async obtenerPrestamos(): Promise<any[]> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const snapshot = await getDocs(collection(this.firestore, 'prestamos'));
      return snapshot.docs.map((d) => d.data());
    });
  }

  async obtenerPrestamosPorCodigo(zapatoId: number): Promise<any[]> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const q = query(
        collection(this.firestore, 'prestamos'),
        where('zapatoId', '==', zapatoId),
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => d.data());
    });
  }

  async obtenerResumenPrestamos(): Promise<any> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const snapshot = await getDocs(collection(this.firestore, 'prestamos'));
      const prestamos = snapshot.docs.map((d) => d.data());
      const porVendedor: Record<string, any[]> = {};
      for (const p of prestamos) {
        const vendedor = p['vendedor'] ?? 'Sin especificar';
        if (!porVendedor[vendedor]) porVendedor[vendedor] = [];
        porVendedor[vendedor].push({
          zapatoId: p['zapatoId'],
          vendedor,
          marca: p['marca'] ?? '',
          referencia: p['referencia'] ?? '',
          talla: p['talla'] ?? '',
          local: p['localPrestado'] ?? p['local'] ?? '',
          fecha: p['fechaPrestamo']?.seconds
            ? new Date(p['fechaPrestamo'].seconds * 1000).toLocaleDateString(
                'es-CO',
              )
            : 'Sin fecha',
        });
      }
      return { totalPrestamos: prestamos.length, porVendedor };
    });
  }

  async obtenerProductosBajoStock(minStock: number = 3): Promise<any[]> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const q = query(
        collection(this.firestore, 'productos'),
        where('stock', '<=', minStock),
        orderBy('stock', 'asc'),
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => d.data());
    });
  }

  async obtenerStockPorCodigo(zapatoId: number): Promise<any> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const idNum = Number(zapatoId);
      const idStr = String(zapatoId);
      const [
        productosSnap,
        prestamosSnap,
        pedidosSnap,
        ventasSnap,
        exhibicionesSnap,
        ingresosSnap,
      ] = await Promise.all([
        getDocs(
          query(
            collection(this.firestore, 'productos'),
            where('id', '==', idNum),
          ),
        ),
        getDocs(
          query(
            collection(this.firestore, 'prestamos'),
            where('zapatoId', '==', idNum),
          ),
        ),
        getDocs(
          query(
            collection(this.firestore, 'pedidos'),
            where('zapatoId', '==', idNum),
          ),
        ),
        getDocs(
          query(
            collection(this.firestore, 'ventas'),
            where('zapatoId', '==', idNum),
          ),
        ),
        getDocs(
          query(
            collection(this.firestore, 'exhibiciones'),
            where('zapatoId', '==', idStr),
          ),
        ),
        getDocs(
          query(
            collection(this.firestore, 'ingresosProductos'),
            where('zapatoId', '==', idNum),
          ),
        ),
      ]);
      const prod = productosSnap.docs[0]?.data();
      if (!prod)
        return { error: `No se encontró el producto con código ${zapatoId}` };
      const ventasValidas = ventasSnap.docs
        .map((d) => d.data())
        .filter(esVentaValidaParaStock);
      const stockInicial = ingresosSnap.docs
        .map((d) => d.data())
        .reduce((sum, i) => sum + (parseInt(i['cantIngresada']) || 0), 0);
      const stockActual: number = prod['stock'] ?? 0;
      const cantPrestamos = prestamosSnap.docs.length;
      const cantPedidos = pedidosSnap.docs.length;
      const cantVentas = ventasValidas.length;
      const cantExhibiciones = exhibicionesSnap.docs.length;
      const suma =
        stockActual +
        cantPrestamos +
        cantPedidos +
        cantVentas +
        cantExhibiciones;
      return {
        codigo: idNum,
        marca: prod['marca'] ?? '',
        referencia: prod['referencia'] ?? '',
        talla: prod['talla'] ?? '',
        stockInicial,
        stockActual,
        prestamos: cantPrestamos,
        pedidos: cantPedidos,
        ventasValidas: cantVentas,
        exhibiciones: cantExhibiciones,
        sumaTotal: suma,
        diferencia: suma - stockInicial,
        estadoStock:
          suma === stockInicial ? '✅ Stock correcto' : '⚠️ Stock incorrecto',
      };
    });
  }

  /**
   * Productos cuyo stock no cuadra. Se calcula en el servidor (misma lógica que la pantalla de
   * Descuadres, que además tiene en cuenta pedidos devueltos y locales) en vez de leer desde el
   * navegador las colecciones completas de ventas, ingresos, pedidos, etc.
   */
  async obtenerStockMalo(): Promise<any[]> {
    const r: any = await this.funciones.llamar('analizarDescuadres', { limite: 500 });
    return this.mapearDescuadres(r?.descuadres);
  }

  async obtenerStockMaloPorRango(
    desde: number,
    hasta?: number,
  ): Promise<any[]> {
    const r: any = await this.funciones.llamar('analizarDescuadres', {
      desde,
      ...(hasta !== undefined ? { hasta } : {}),
      limite: 500,
    });
    return this.mapearDescuadres(r?.descuadres);
  }

  private mapearDescuadres(lista: any[] | undefined): any[] {
    return (lista ?? [])
      .filter((d) => d.diferencia !== 0)
      .map((d) => ({
        codigo: d.codigo,
        marca: d.producto ?? '',
        referencia: '',
        talla: '',
        stockInicial: d.ingresos,
        stockActual: d.ubicaciones?.bodega ?? 0,
        prestamos: d.ubicaciones?.prestamosActivos ?? 0,
        pedidos:
          (d.ubicaciones?.pedidosConVendedor ?? 0) +
          (d.ubicaciones?.pedidosDevueltosSinConfirmar ?? 0),
        ventasValidas: d.ubicaciones?.ventas ?? 0,
        exhibiciones: d.ubicaciones?.exhibiciones ?? 0,
        enLocales: d.ubicaciones?.enLocales ?? 0,
        sumaTotal: d.suma,
        diferencia: d.diferencia,
        notas: d.notas,
      }))
      .sort((x, y) => Number(x.codigo) - Number(y.codigo));
  }

  async obtenerReferenciasViejasConStock(top: number = 20): Promise<any[]> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const [ingresosSnap, productosSnap] = await Promise.all([
        getDocs(collection(this.firestore, 'ingresosProductos')),
        getDocs(
          query(
            collection(this.firestore, 'productos'),
            where('stock', '>', 0),
          ),
        ),
      ]);
      const productosConStock = new Map<number, any>();
      for (const d of productosSnap.docs) {
        const p = d.data();
        if (p['id'] !== undefined) productosConStock.set(Number(p['id']), p);
      }
      const mapaIngresos = new Map<
        number,
        { fechaMasAntigua: Date; marca: string; referencia: string }
      >();
      for (const d of ingresosSnap.docs) {
        const ing = d.data();
        const id = Number(ing['zapatoId']);
        if (!id) continue;
        if (!productosConStock.has(id)) continue;
        let fecha: Date;
        if (ing['fecha']?.seconds)
          fecha = new Date(ing['fecha'].seconds * 1000);
        else if (ing['fecha']) fecha = new Date(ing['fecha']);
        else continue;
        const actual = mapaIngresos.get(id);
        if (!actual || fecha < actual.fechaMasAntigua)
          mapaIngresos.set(id, {
            fechaMasAntigua: fecha,
            marca: ing['marca'] ?? '',
            referencia: ing['referencia'] ?? '',
          });
      }
      return Array.from(mapaIngresos.entries())
        .map(([id, datos]) => {
          const prod = productosConStock.get(id)!;
          const diasEnBodega = Math.floor(
            (Date.now() - datos.fechaMasAntigua.getTime()) /
              (1000 * 60 * 60 * 24),
          );
          return {
            codigo: id,
            marca: datos.marca,
            referencia: datos.referencia,
            talla: prod['talla'] ?? '',
            stock: prod['stock'] ?? 0,
            precioMin: prod['precioMin'] ?? 0,
            fechaPrimerIngreso: datos.fechaMasAntigua.toLocaleDateString(
              'es-CO',
              { day: 'numeric', month: 'long', year: 'numeric' },
            ),
            diasEnBodega,
          };
        })
        .sort((a, b) => b.diasEnBodega - a.diasEnBodega)
        .slice(0, top);
    });
  }

  async obtenerZapatosMasVendidos(top: number = 20): Promise<any[]> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const snapshot = await getDocs(
        query(
          collection(this.firestore, 'resumenPorProducto'),
          orderBy('totalVentas', 'desc'),
          limit(top),
        ),
      );
      return snapshot.docs.map((d) => ({
        zapatoId: Number(d.id),
        ...d.data(),
      }));
    });
  }

  async obtenerPerfilVendedor(nombreVendedor: string): Promise<any> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const inicio = this.getInicioSemana();
      const fin = this.getFinSemana();
      const [ventasSemanaSnap, todasVentasSemanaSnap, prestamosSnap] =
        await Promise.all([
          getDocs(
            query(
              collection(this.firestore, 'ventas'),
              where('vendedor', '==', nombreVendedor),
              where('fechaVenta', '>=', Timestamp.fromDate(inicio)),
              where('fechaVenta', '<=', Timestamp.fromDate(fin)),
              orderBy('fechaVenta', 'desc'),
            ),
          ),
          getDocs(
            query(
              collection(this.firestore, 'ventas'),
              where('fechaVenta', '>=', Timestamp.fromDate(inicio)),
              where('fechaVenta', '<=', Timestamp.fromDate(fin)),
            ),
          ),
          getDocs(
            query(
              collection(this.firestore, 'prestamos'),
              where('vendedor', '==', nombreVendedor),
            ),
          ),
        ]);
      const ventasVendedor = ventasSemanaSnap.docs
        .map((d) => d.data())
        .filter(esVentaValida);
      const todasVentasSemana = todasVentasSemanaSnap.docs
        .map((d) => d.data())
        .filter(esVentaValida);
      const prestamosVendedor = prestamosSnap.docs.map((d) => d.data());
      const totalVentas = ventasVendedor.length;
      const totalIngresos = ventasVendedor.reduce(
        (sum, v) => sum + (v['precio'] || 0),
        0,
      );
      const ventasPrecioBajo = ventasVendedor.filter(
        (v) => v['precioBajo'] === true,
      ).length;
      const porcentajePrecioBajo =
        totalVentas > 0
          ? Math.round((ventasPrecioBajo / totalVentas) * 100)
          : 0;
      const mapaRefs: Record<
        string,
        { referencia: string; marca: string; ventas: number }
      > = {};
      for (const v of ventasVendedor) {
        const key = String(v['zapatoId']);
        if (!mapaRefs[key])
          mapaRefs[key] = {
            referencia: v['referencia'] ?? '',
            marca: v['marca'] ?? '',
            ventas: 0,
          };
        mapaRefs[key].ventas += 1;
      }
      const topReferencias = Object.entries(mapaRefs)
        .map(([id, d]) => ({
          zapatoId: id,
          referencia: d.referencia || `Código ${id}`,
          marca: d.marca || '',
          ventas: d.ventas,
        }))
        .sort((a, b) => b.ventas - a.ventas)
        .slice(0, 5);
      const vendedoresDelEquipo: Record<
        string,
        { ventas: number; ingresos: number; precioBajo: number }
      > = {};
      for (const v of todasVentasSemana) {
        const vend = v['vendedor'] ?? 'Sin especificar';
        if (!vendedoresDelEquipo[vend])
          vendedoresDelEquipo[vend] = { ventas: 0, ingresos: 0, precioBajo: 0 };
        vendedoresDelEquipo[vend].ventas += 1;
        vendedoresDelEquipo[vend].ingresos += v['precio'] || 0;
        if (v['precioBajo']) vendedoresDelEquipo[vend].precioBajo += 1;
      }
      const totalVendedores = Object.keys(vendedoresDelEquipo).length;
      const promedioVentasEquipo =
        totalVendedores > 0
          ? Math.round(
              Object.values(vendedoresDelEquipo).reduce(
                (sum, v) => sum + v.ventas,
                0,
              ) / totalVendedores,
            )
          : 0;
      const promedioIngresosEquipo =
        totalVendedores > 0
          ? Math.round(
              Object.values(vendedoresDelEquipo).reduce(
                (sum, v) => sum + v.ingresos,
                0,
              ) / totalVendedores,
            )
          : 0;
      const rankingPorIngresos = Object.entries(vendedoresDelEquipo)
        .sort((a, b) => b[1].ingresos - a[1].ingresos)
        .map(([nombre]) => nombre);
      const posicionRanking = rankingPorIngresos.indexOf(nombreVendedor) + 1;
      return {
        vendedor: nombreVendedor,
        semana: {
          inicio: inicio.toLocaleDateString('es-CO', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }),
          fin: fin.toLocaleDateString('es-CO', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }),
        },
        metricasSemana: {
          totalVentas,
          totalIngresos,
          ventasPrecioBajo,
          porcentajePrecioBajo,
          topReferencias,
          porLocal: ventasVendedor.reduce((acc: Record<string, number>, v) => {
            const l = v['local'] ?? 'Sin especificar';
            acc[l] = (acc[l] || 0) + 1;
            return acc;
          }, {}),
          porMetodoPago: ventasVendedor.reduce(
            (acc: Record<string, number>, v) => {
              const m = v['metodoPago'] ?? 'Sin especificar';
              acc[m] = (acc[m] || 0) + 1;
              return acc;
            },
            {},
          ),
        },
        comparativoEquipo: {
          posicionRanking,
          totalVendedoresEquipo: totalVendedores,
          promedioVentasEquipo,
          promedioIngresosEquipo,
          ventasVsPromedio: totalVentas - promedioVentasEquipo,
          ingresosVsPromedio: totalIngresos - promedioIngresosEquipo,
        },
        prestamosActivos: {
          total: prestamosVendedor.length,
          detalle: prestamosVendedor.slice(0, 5).map((p) => ({
            zapatoId: p['zapatoId'],
            marca: p['marca'],
            referencia: p['referencia'],
            talla: p['talla'],
            local: p['localPrestado'] ?? p['local'],
            fecha: p['fechaPrestamo']?.seconds
              ? new Date(p['fechaPrestamo'].seconds * 1000).toLocaleDateString(
                  'es-CO',
                )
              : null,
          })),
        },
      };
    });
  }

  async obtenerExhibicionesPorCodigoYLocal(
    zapatoId: string | number,
    local: string,
    cantidadMax: number = 5,
  ): Promise<any[]> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const zapatoIdStr = String(zapatoId);
      const zapatoIdNum = Number(zapatoId);
      const localNum = local.replace(/\D/g, '');
      const posiblesFormatos = [
        `Local ${localNum}`,
        `local ${localNum}`,
        `Local ${localNum.padStart(2, '0')}`,
        `local ${localNum.padStart(2, '0')}`,
      ];
      const historialRef = collection(this.firestore, 'historial-bodega');
      const [snapStr, snapNum] = await Promise.all([
        getDocs(
          query(
            historialRef,
            where('lugar', '==', 'exhibicion'),
            where('zapatoId', '==', zapatoIdStr),
            orderBy('fecha', 'desc'),
            limit(100),
          ),
        ),
        getDocs(
          query(
            historialRef,
            where('lugar', '==', 'exhibicion'),
            where('zapatoId', '==', zapatoIdNum),
            orderBy('fecha', 'desc'),
            limit(100),
          ),
        ),
      ]);
      const idsVistos = new Set<string>();
      const todos: any[] = [];
      for (const snap of [snapStr, snapNum]) {
        for (const doc of snap.docs) {
          if (!idsVistos.has(doc.id)) {
            idsVistos.add(doc.id);
            todos.push(doc.data());
          }
        }
      }
      return todos
        .filter(
          (h) =>
            Array.isArray(h['locales']) &&
            h['locales'].some((l: string) => posiblesFormatos.includes(l)),
        )
        .sort((a, b) => (b['fecha'] ?? '').localeCompare(a['fecha'] ?? ''))
        .slice(0, cantidadMax);
    });
  }

  async obtenerHistorialPedidosPorCodigo(
    zapatoId: number,
    cantidadMax: number = 10,
  ): Promise<any[]> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const q = query(
        collection(this.firestore, 'historial-bodega'),
        where('lugar', '==', 'pedido'),
        where('zapatoId', '==', zapatoId),
        orderBy('fecha', 'desc'),
        limit(cantidadMax),
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => d.data());
    });
  }

  async obtenerGananciasHoy(): Promise<any> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const inicio = this.getInicioHoy();
      const fin = this.getFinHoy();
      const q = query(
        collection(this.firestore, 'ventas'),
        where('fechaVenta', '>=', Timestamp.fromDate(inicio)),
        where('fechaVenta', '<=', Timestamp.fromDate(fin)),
        orderBy('fechaVenta', 'desc'),
      );
      const snapshot = await getDocs(q);
      const ventasRaw = snapshot.docs.map((d) => d.data());
      const ventas = ventasRaw
        .filter(esVentaValidaParaFinanzas)
        .map((v) => this.mapearVenta(v));
      this.catalogoService.registrar();
      const resumen = await this.finanzasService.calcularResumen(ventas);
      this.catalogoService.desregistrar();
      const porLocal: Record<
        string,
        {
          ingresos: number;
          costos: number;
          ganancias: number;
          unidades: number;
        }
      > = {};
      for (const v of ventas) {
        const local = (v as any).local || 'Sin local';
        if (!porLocal[local])
          porLocal[local] = {
            ingresos: 0,
            costos: 0,
            ganancias: 0,
            unidades: 0,
          };
      }
      await Promise.all(
        ventas.map(async (v: any) => {
          const local = v.local || 'Sin local';
          const monto = this.finanzasService.obtenerMonto(v);
          const ganancia = await this.finanzasService.calcularGanancia(v);
          if (porLocal[local]) {
            porLocal[local].ingresos += monto;
            porLocal[local].costos += monto - ganancia;
            porLocal[local].ganancias += ganancia;
            if (this.finanzasService.cuentaComoUnidad(v))
              porLocal[local].unidades++;
          }
        }),
      );
      const porVendedor: Record<
        string,
        { ingresos: number; ganancias: number; unidades: number }
      > = {};
      await Promise.all(
        ventas.map(async (v: any) => {
          const vendedor = v.vendedor || 'Sin especificar';
          if (!porVendedor[vendedor])
            porVendedor[vendedor] = { ingresos: 0, ganancias: 0, unidades: 0 };
          const monto = this.finanzasService.obtenerMonto(v);
          const ganancia = await this.finanzasService.calcularGanancia(v);
          porVendedor[vendedor].ingresos += monto;
          porVendedor[vendedor].ganancias += ganancia;
          if (this.finanzasService.cuentaComoUnidad(v))
            porVendedor[vendedor].unidades++;
        }),
      );
      const margenGeneral =
        resumen.ingresos > 0
          ? Math.round((resumen.ganancias / resumen.ingresos) * 100)
          : 0;
      return {
        periodo: `Hoy, ${inicio.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
        resumen: {
          ingresos: resumen.ingresos,
          costos: resumen.costos,
          ganancias: resumen.ganancias,
          unidades: resumen.unidades,
          margenPorcentaje: margenGeneral,
          descripcion: `De cada $100 vendidos, $${margenGeneral} es ganancia bruta`,
        },
        porLocal: Object.entries(porLocal)
          .sort((a, b) => b[1].ganancias - a[1].ganancias)
          .map(([local, datos]) => ({
            local,
            ...datos,
            margen:
              datos.ingresos > 0
                ? Math.round((datos.ganancias / datos.ingresos) * 100)
                : 0,
          })),
        porVendedor: Object.entries(porVendedor)
          .sort((a, b) => b[1].ganancias - a[1].ganancias)
          .map(([vendedor, datos]) => ({
            vendedor,
            ...datos,
            margen:
              datos.ingresos > 0
                ? Math.round((datos.ganancias / datos.ingresos) * 100)
                : 0,
          })),
      };
    });
  }

  async obtenerGananciasSemana(): Promise<any> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const inicio = this.getInicioSemana();
      const fin = this.getFinSemana();
      const q = query(
        collection(this.firestore, 'ventas'),
        where('fechaVenta', '>=', Timestamp.fromDate(inicio)),
        where('fechaVenta', '<=', Timestamp.fromDate(fin)),
        orderBy('fechaVenta', 'desc'),
      );
      const snapshot = await getDocs(q);
      const ventas = snapshot.docs
        .map((d) => d.data())
        .filter(esVentaValida)
        .map((v) => this.mapearVenta(v));
      this.catalogoService.registrar();
      const resumen = await this.finanzasService.calcularResumen(ventas);
      this.catalogoService.desregistrar();
      const porLocal: Record<
        string,
        { ingresos: number; ganancias: number; unidades: number }
      > = {};
      await Promise.all(
        ventas.map(async (v: any) => {
          const local = v.local || 'Sin local';
          if (!porLocal[local])
            porLocal[local] = { ingresos: 0, ganancias: 0, unidades: 0 };
          const monto = this.finanzasService.obtenerMonto(v);
          const ganancia = await this.finanzasService.calcularGanancia(v);
          porLocal[local].ingresos += monto;
          porLocal[local].ganancias += ganancia;
          if (this.finanzasService.cuentaComoUnidad(v))
            porLocal[local].unidades++;
        }),
      );
      const margen =
        resumen.ingresos > 0
          ? Math.round((resumen.ganancias / resumen.ingresos) * 100)
          : 0;
      return {
        semana: {
          inicio: inicio.toLocaleDateString('es-CO', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }),
          fin: fin.toLocaleDateString('es-CO', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }),
        },
        resumen: {
          ingresos: resumen.ingresos,
          costos: resumen.costos,
          ganancias: resumen.ganancias,
          unidades: resumen.unidades,
          margenPorcentaje: margen,
        },
        porLocal: Object.entries(porLocal)
          .sort((a, b) => b[1].ganancias - a[1].ganancias)
          .map(([local, datos]) => ({
            local,
            ...datos,
            margen:
              datos.ingresos > 0
                ? Math.round((datos.ganancias / datos.ingresos) * 100)
                : 0,
          })),
      };
    });
  }

  async obtenerReferenciasMasVendidas(diasAtras: number = 30): Promise<any> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const desde = this.getInicioHaceNDias(diasAtras);
      const hasta = this.getFinHoy();

      const [ventasSnap, productosSnap] = await Promise.all([
        getDocs(
          query(
            collection(this.firestore, 'ventas'),
            where('fechaVenta', '>=', Timestamp.fromDate(desde)),
            where('fechaVenta', '<=', Timestamp.fromDate(hasta)),
            orderBy('fechaVenta', 'desc'),
          ),
        ),
        getDocs(collection(this.firestore, 'productos')),
      ]);

      const ventas = ventasSnap.docs.map((d) => d.data()).filter(esVentaValida);

      const productosMap = new Map<number, any>();
      for (const d of productosSnap.docs) {
        const p = d.data();
        productosMap.set(Number(p['id']), p);
      }

      const porReferencia = new Map<
        string,
        {
          marca: string;
          referencia: string;
          totalVentas: number;
          ingresoTotal: number;
          tallas: Record<string, number>;
          zapatoIds: Set<number>;
          stockActualTotal: number;
        }
      >();

      for (const v of ventas) {
        const key = `${v['marca']}||${v['referencia']}`;
        if (!porReferencia.has(key)) {
          porReferencia.set(key, {
            marca: v['marca'] ?? '',
            referencia: v['referencia'] ?? '',
            totalVentas: 0,
            ingresoTotal: 0,
            tallas: {},
            zapatoIds: new Set(),
            stockActualTotal: 0,
          });
        }
        const item = porReferencia.get(key)!;
        item.totalVentas += 1;
        item.ingresoTotal += Number(v['precio'] || 0);
        const talla = String(v['talla'] ?? 'sin talla');
        item.tallas[talla] = (item.tallas[talla] || 0) + 1;
        if (v['zapatoId']) item.zapatoIds.add(Number(v['zapatoId']));
      }

      // Calcular stock actual y agotados
      for (const item of porReferencia.values()) {
        let stockTotal = 0;
        for (const zapatoId of item.zapatoIds) {
          const prod = productosMap.get(zapatoId);
          if (prod) stockTotal += Number(prod['stock'] ?? 0);
        }
        item.stockActualTotal = stockTotal;
      }

      const resultado = Array.from(porReferencia.values())
        .map((item) => ({
          marca: item.marca,
          referencia: item.referencia,
          zapatoId: Array.from(item.zapatoIds),
          totalVentas: item.totalVentas,
          ingresoTotal: item.ingresoTotal,
          tallaMasSolicitada:
            Object.entries(item.tallas).sort((a, b) => b[1] - a[1])[0]?.[0] ??
            'N/A',
          distribucionTallas: item.tallas,
          stockActualTotal: item.stockActualTotal,
          agotada: item.stockActualTotal === 0,
          recomendacion:
            item.stockActualTotal === 0
              ? '🔴 AGOTADA — Alta demanda y sin stock. Reponer urgente.'
              : item.stockActualTotal <= 3
                ? '🟡 Stock muy bajo — Reponer pronto antes de agotarse.'
                : '🟢 Aún hay stock disponible.',
        }))
        .sort((a, b) => b.totalVentas - a.totalVentas);

      const agotadasConDemanda = resultado
        .filter((r) => r.agotada)
        .slice(0, 10);
      const stockBajoConDemanda = resultado
        .filter((r) => !r.agotada && r.stockActualTotal <= 3)
        .slice(0, 10);

      return {
        periodo: `Últimos ${diasAtras} días`,
        totalAnalizadas: ventas.length,
        referencias: resultado,
        agotadasUrgentes: resultado.filter((r) => r.agotada),
        porAgotarse: resultado.filter(
          (r) => !r.agotada && r.stockActualTotal <= 3,
        ),
      };
    });
  }

  async obtenerReferenciasParaPromocion(): Promise<any> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();

      const MESES_SIN_MOVIMIENTO = 4;
      const VENTAS_BAJAS_UMBRAL = 3;

      const limiteAntigüedad = new Date();
      limiteAntigüedad.setMonth(
        limiteAntigüedad.getMonth() - MESES_SIN_MOVIMIENTO,
      );

      const [ingresosSnap, productosSnap] = await Promise.all([
        getDocs(collection(this.firestore, 'ingresosProductos')),
        getDocs(
          query(
            collection(this.firestore, 'productos'),
            where('stock', '>', 0),
          ),
        ),
      ]);

      const productosConStock = new Map<number, any>();
      for (const d of productosSnap.docs) {
        const p = d.data();
        productosConStock.set(Number(p['id']), p);
      }

      const ultimoIngresoPorZapato = new Map<number, Date>();
      for (const d of ingresosSnap.docs) {
        const ing = d.data();
        const zapatoId = Number(ing['zapatoId']);
        if (!productosConStock.has(zapatoId)) continue;

        let fecha: Date | null = null;
        if (ing['fecha']?.seconds)
          fecha = new Date(ing['fecha'].seconds * 1000);
        else if (ing['fecha'] instanceof Date) fecha = ing['fecha'];
        else if (typeof ing['fecha'] === 'string')
          fecha = new Date(ing['fecha']);
        if (!fecha || isNaN(fecha.getTime())) continue;

        const actual = ultimoIngresoPorZapato.get(zapatoId);
        if (!actual || fecha > actual)
          ultimoIngresoPorZapato.set(zapatoId, fecha);
      }

      // Solo importan las ventas de los productos candidatos (último ingreso de hace más de
      // 4 meses): se consultan por código en tandas, en vez de leer todo el historial de ventas.
      const idsCandidatos = [...ultimoIngresoPorZapato.entries()]
        .filter(([, f]) => f <= limiteAntigüedad)
        .map(([id]) => id);
      const ventasDocs: any[] = [];
      for (let i = 0; i < idsCandidatos.length; i += 15) {
        const tanda = idsCandidatos.slice(i, i + 15);
        // Se incluyen ambas formas (número y texto) por si quedan ventas con el código como texto
        const snap = await getDocs(
          query(
            collection(this.firestore, 'ventas'),
            where('zapatoId', 'in', [...tanda, ...tanda.map(String)]),
          ),
        );
        snap.docs.forEach((d) => ventasDocs.push(d.data()));
      }

      const ventasPorZapato = new Map<number, number>();
      const todasVentas = ventasDocs.filter(esVentaValida);

      for (const v of todasVentas) {
        const zapatoId = Number(v['zapatoId']);
        if (!zapatoId) continue;

        const ultimoIngreso = ultimoIngresoPorZapato.get(zapatoId);
        if (!ultimoIngreso) continue;

        let fechaVenta: Date | null = null;
        if (v['fechaVenta']?.seconds)
          fechaVenta = new Date(v['fechaVenta'].seconds * 1000);
        else if (v['fechaVenta'] instanceof Date) fechaVenta = v['fechaVenta'];
        if (!fechaVenta) continue;

        if (fechaVenta >= ultimoIngreso) {
          ventasPorZapato.set(
            zapatoId,
            (ventasPorZapato.get(zapatoId) ?? 0) + 1,
          );
        }
      }

      const candidatos: any[] = [];
      for (const [zapatoId, ultimaFecha] of ultimoIngresoPorZapato.entries()) {
        if (ultimaFecha > limiteAntigüedad) continue;
        const prod = productosConStock.get(zapatoId);
        if (!prod) continue;

        const ventasDesdeIngreso = ventasPorZapato.get(zapatoId) ?? 0;
        if (ventasDesdeIngreso >= VENTAS_BAJAS_UMBRAL) continue;
        const diasParados = Math.floor(
          (Date.now() - ultimaFecha.getTime()) / (1000 * 60 * 60 * 24),
        );
        const mesesParados = Math.floor(diasParados / 30);

        candidatos.push({
          zapatoId,
          marca: prod['marca'] ?? '',
          referencia: prod['referencia'] ?? '',
          talla: prod['talla'] ?? '',
          stock: prod['stock'] ?? 0,
          precioMin: prod['precioMin'] ?? 0,
          precioAdquisicion: prod['precioAdquisicion'] ?? 0,
          ventasDesdeUltimoIngreso: ventasDesdeIngreso,
          ultimoIngreso: ultimaFecha.toLocaleDateString('es-CO', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }),
          diasParados,
          mesesParados,
          nivelUrgencia:
            mesesParados >= 8
              ? '🔴 Crítico'
              : mesesParados >= 6
                ? '🟠 Alto'
                : '🟡 Medio',
        });
      }

      candidatos.sort((a, b) => b.diasParados - a.diasParados);

      const porReferencia = new Map<string, any[]>();
      for (const c of candidatos) {
        const key = `${c.marca}||${c.referencia}`;
        if (!porReferencia.has(key)) porReferencia.set(key, []);
        porReferencia.get(key)!.push(c);
      }

      const resumenPorReferencia = Array.from(porReferencia.entries())
        .map(([key, tallas]) => {
          const [marca, referencia] = key.split('||');
          const stockTotal = tallas.reduce((s, t) => s + t.stock, 0);
          const ventasTotales = tallas.reduce(
            (s, t) => s + t.ventasDesdeUltimoIngreso,
            0,
          );
          const maxDias = Math.max(...tallas.map((t) => t.diasParados));
          const precioAdq = tallas[0].precioAdquisicion;
          const precioMin = tallas[0].precioMin;

          return {
            marca,
            referencia,
            tallasVaradas: tallas
              .sort((a, b) => a.talla - b.talla)
              .map((t) => ({
                zapatoId: t.zapatoId,
                talla: t.talla,
                stock: t.stock,
              })),
            zapatoIdsPrincipales: tallas.map((t) => t.zapatoId),
            stockTotal,
            ventasTotalesDesdeIngreso: ventasTotales,
            diasParadoMax: maxDias,
            mesesParadoMax: Math.floor(maxDias / 30),
            ultimoIngreso: tallas[0].ultimoIngreso,
            precioMin,
            precioAdquisicion: precioAdq,
            nivelUrgencia: tallas[0].nivelUrgencia,
            sugerencia: precioAdq
              ? `Precio mínimo para no perder: $${Math.round(precioAdq * 1.03).toLocaleString('es-CO')}. Con descuento desde $${Math.round(precioAdq * 1.08).toLocaleString('es-CO')} ya genera algo de margen.`
              : 'Revisar precio de adquisición para calcular descuento seguro.',
          };
        })
        .sort((a, b) => b.diasParadoMax - a.diasParadoMax);

      return {
        criterio: `Stock en bodega + último ingreso hace más de ${MESES_SIN_MOVIMIENTO} meses + menos de ${VENTAS_BAJAS_UMBRAL} ventas desde ese ingreso`,
        totalReferenciasAfectadas: resumenPorReferencia.length,
        totalUnidadesVariadas: candidatos.reduce((s, c) => s + c.stock, 0),
        referenciasParaPromocion: resumenPorReferencia.slice(0, 30),
        topUrgentes: resumenPorReferencia
          .filter((r) => r.mesesParadoMax >= 6)
          .slice(0, 10),
        resumen: `${resumenPorReferencia.length} referencias llevan más de 4 meses con poco o ningún movimiento y aún tienen stock. ${resumenPorReferencia.filter((r) => r.mesesParadoMax >= 6).length} llevan más de 6 meses — candidatas a liquidar con descuento agresivo.`,
      };
    });
  }

  async obtenerAnalisisFinanciero(mes?: number, anio?: number): Promise<any> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const hoy = new Date();
      const mesTarget = mes ?? hoy.getMonth();
      const anioTarget = anio ?? hoy.getFullYear();
      const inicioMes = new Date(anioTarget, mesTarget, 1);
      const finMes = new Date(anioTarget, mesTarget + 1, 0, 23, 59, 59, 999);

      await this.gastosService.cargarGastosPorMes(anioTarget, mesTarget);
      const gastos = await new Promise<any[]>((resolve) => {
        this.gastosService.gastos$
          .pipe(filter((g) => g !== null))
          .subscribe((g) => resolve(g));
      });

      const q = query(
        collection(this.firestore, 'ventas'),
        where('fechaVenta', '>=', Timestamp.fromDate(inicioMes)),
        where('fechaVenta', '<=', Timestamp.fromDate(finMes)),
        orderBy('fechaVenta', 'desc'),
      );
      const snapshot = await getDocs(q);
      const raw = snapshot.docs.map((d) => d.data());
      const ventas = raw
        .filter(esVentaValidaParaFinanzas)
        .map((v) => this.mapearVenta(v));
      this.catalogoService.registrar();
      const resumenVentas = await this.finanzasService.calcularResumen(ventas);
      this.catalogoService.desregistrar();

      const totalGastos = gastos.reduce((sum, g) => sum + (g.monto || 0), 0);
      const gastosPorCategoria: Record<string, number> = {};
      for (const g of gastos)
        gastosPorCategoria[g.categoria] =
          (gastosPorCategoria[g.categoria] || 0) + g.monto;

      const gastosPorCategoriaOrdenados = Object.entries(gastosPorCategoria)
        .sort((a, b) => b[1] - a[1])
        .map(([categoria, monto]) => ({
          categoria,
          monto,
          porcentajeDeGastos:
            totalGastos > 0 ? Math.round((monto / totalGastos) * 100) : 0,
          porcentajeDeIngresos:
            resumenVentas.ingresos > 0
              ? Math.round((monto / resumenVentas.ingresos) * 100)
              : 0,
        }));

      const utilidadNeta = resumenVentas.ganancias - totalGastos;
      const margenNeto =
        resumenVentas.ingresos > 0
          ? Math.round((utilidadNeta / resumenVentas.ingresos) * 100)
          : 0;
      const margenBruto =
        resumenVentas.ingresos > 0
          ? Math.round((resumenVentas.ganancias / resumenVentas.ingresos) * 100)
          : 0;
      const ventaPromedioUnidad =
        resumenVentas.unidades > 0
          ? Math.round(resumenVentas.ingresos / resumenVentas.unidades)
          : 0;
      const gananciaPromedioUnidad =
        resumenVentas.unidades > 0
          ? Math.round(resumenVentas.ganancias / resumenVentas.unidades)
          : 0;
      const unidadesParaEquilibrio =
        gananciaPromedioUnidad > 0
          ? Math.ceil(totalGastos / gananciaPromedioUnidad)
          : null;

      const alertasGastos = gastosPorCategoriaOrdenados
        .filter((g) => g.porcentajeDeIngresos > 15)
        .map((g) => ({
          ...g,
          alerta: `"${g.categoria}" representa el ${g.porcentajeDeIngresos}% de los ingresos (benchmark: <12-15%)`,
        }));

      const riesgoQuiebra =
        utilidadNeta < 0
          ? {
              enRiesgo: true,
              deficitMensual: Math.abs(utilidadNeta),
              descripcion: `El negocio pierde $${Math.abs(utilidadNeta).toLocaleString('es-CO')} al mes. Si el capital disponible se agota, la quiebra es inminente.`,
            }
          : { enRiesgo: false };

      const labelMes = inicioMes.toLocaleDateString('es-CO', {
        month: 'long',
        year: 'numeric',
      });
      return {
        periodo: labelMes,
        ingresos: resumenVentas.ingresos,
        costoMercancia: resumenVentas.costos,
        gananciaBruta: resumenVentas.ganancias,
        margenBruto,
        totalGastosOperativos: totalGastos,
        utilidadNeta,
        margenNeto,
        unidadesVendidas: resumenVentas.unidades,
        ventaPromedioUnidad,
        gananciaPromedioUnidad,
        unidadesParaEquilibrio,
        gastosPorCategoria: gastosPorCategoriaOrdenados,
        totalRegistrosGastos: gastos.length,
        alertasGastos,
        riesgoQuiebra,
        estadoFinanciero:
          utilidadNeta > 0
            ? `✅ Mes rentable: utilidad neta $${utilidadNeta.toLocaleString('es-CO')} (margen ${margenNeto}%)`
            : `🔴 Mes en PÉRDIDA: déficit $${Math.abs(utilidadNeta).toLocaleString('es-CO')} (margen ${margenNeto}%)`,
        resumenEjecutivo: {
          descripcion: `En ${labelMes}: ingresos $${resumenVentas.ingresos.toLocaleString('es-CO')}, ganancia bruta $${resumenVentas.ganancias.toLocaleString('es-CO')} (${margenBruto}%), gastos operativos $${totalGastos.toLocaleString('es-CO')}, utilidad neta $${utilidadNeta.toLocaleString('es-CO')} (${margenNeto}%).`,
          gastoPrincipal: gastosPorCategoriaOrdenados[0]
            ? `Mayor gasto: ${gastosPorCategoriaOrdenados[0].categoria} $${gastosPorCategoriaOrdenados[0].monto.toLocaleString('es-CO')} (${gastosPorCategoriaOrdenados[0].porcentajeDeIngresos}% de ingresos)`
            : 'Sin gastos registrados',
          recomendacionClave:
            utilidadNeta < 0
              ? `URGENTE: reducir gastos en $${Math.abs(utilidadNeta).toLocaleString('es-CO')} o aumentar ventas en ${unidadesParaEquilibrio ?? '?'} unidades para salir a positivo.`
              : `El negocio es rentable. Optimizar la categoría más pesada (${gastosPorCategoriaOrdenados[0]?.categoria ?? 'N/A'}) aumentaría aún más el margen.`,
        },
      };
    });
  }

  async obtenerResumenFinancieroCompleto(
    mes?: number,
    anio?: number,
  ): Promise<any> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();

      const [gananciasHoy, gananciasSemana, analisisMes] = await Promise.all([
        this.obtenerGananciasHoy(),
        this.obtenerGananciasSemana(),
        this.obtenerAnalisisFinanciero(mes, anio),
      ]);

      const hoy = new Date();
      const diasDelMes = new Date(
        hoy.getFullYear(),
        hoy.getMonth() + 1,
        0,
      ).getDate();
      const diaActual = hoy.getDate();
      const diasRestantes = diasDelMes - diaActual;

      const ingresosProyectados =
        diaActual > 0
          ? Math.round((analisisMes.ingresos / diaActual) * diasDelMes)
          : 0;
      const gananciasProyectadas =
        diaActual > 0
          ? Math.round((analisisMes.gananciaBruta / diaActual) * diasDelMes)
          : 0;
      const utilidadProyectada =
        gananciasProyectadas - analisisMes.totalGastosOperativos;

      return {
        hoy: gananciasHoy,
        semana: gananciasSemana,
        mes: analisisMes,
        proyeccion: {
          diasTranscurridos: diaActual,
          diasRestantes,
          diasDelMes,
          ingresosProyectadosMes: ingresosProyectados,
          gananciasProyectadasMes: gananciasProyectadas,
          utilidadProyectadaMes: utilidadProyectada,
          estadoProyeccion:
            utilidadProyectada > 0
              ? `✅ A este ritmo, el mes cerraría con utilidad de $${utilidadProyectada.toLocaleString('es-CO')}`
              : `🔴 A este ritmo, el mes cerraría con PÉRDIDA de $${Math.abs(utilidadProyectada).toLocaleString('es-CO')}`,
          nota: `Proyección basada en ${diaActual} días transcurridos de ${diasDelMes}`,
        },
        comparativo: {
          tendencia:
            analisisMes.margenBruto > 40
              ? '🟢 Márgenes saludables'
              : analisisMes.margenBruto > 30
                ? '🟡 Márgenes ajustados'
                : '🔴 Márgenes críticos — revisar precios',
          alertaPrincipal:
            analisisMes.alertasGastos.length > 0
              ? `⚠️ ${analisisMes.alertasGastos[0].alerta}`
              : '✅ Gastos dentro de benchmarks',
        },
      };
    });
  }

  private async obtenerResumenGeneral(): Promise<any> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const snapshot = await getDocs(collection(this.firestore, 'prestamos'));
      const todos = snapshot.docs.map((d) => d.data());
      const porVendedor: Record<string, number> = {};
      for (const pr of todos) {
        const v = pr['vendedor'] ?? 'Sin especificar';
        porVendedor[v] = (porVendedor[v] || 0) + 1;
      }
      const prestamosConFecha = todos
        .filter((pr: any) => pr['fechaPrestamo']?.seconds)
        .map((pr: any) => ({
          vendedor: pr['vendedor'] ?? 'Sin especificar',
          zapatoId: pr['zapatoId'],
          marca: pr['marca'] ?? null,
          referencia: pr['referencia'] ?? null,
          talla: pr['talla'] ?? null,
          local: pr['localPrestado'] ?? pr['local'] ?? null,
          fecha: new Date(
            pr['fechaPrestamo'].seconds * 1000,
          ).toLocaleDateString('es-CO'),
          diasTranscurridos: Math.floor(
            (Date.now() - pr['fechaPrestamo'].seconds * 1000) /
              (1000 * 60 * 60 * 24),
          ),
        }))
        .sort((a, b) => b.diasTranscurridos - a.diasTranscurridos)
        .slice(0, 10);
      const [
        ventas,
        ventasMes,
        pedidosViejos,
        llegadas,
        exhibPendientes,
        gananciasHoy,
        gananciasSemana,
        analisisFinanciero,
      ] = await Promise.all([
        this.obtenerVentasSemana(),
        this.obtenerResumenVentas(30),
        this.obtenerPedidosRecibidosViejos(),
        this.obtenerLlegadasHoy(),
        this.obtenerExhibicionesPendientes(),
        this.obtenerGananciasHoy(),
        this.obtenerGananciasSemana(),
        this.obtenerAnalisisFinanciero(),
      ]);
      const vendedoresDestacados = Object.entries(
        ventas.porVendedor as Record<
          string,
          { ventas: number; ingresos: number }
        >,
      )
        .sort((a, b) => b[1].ingresos - a[1].ingresos)
        .slice(0, 5)
        .map(([nombre, datos]) => ({ nombre, ...datos }));
      const vendedoresPrecioBajo = Object.entries(
        ventas.porVendedorPrecioBajo as Record<
          string,
          { ventas: number; ingresos: number }
        >,
      )
        .sort((a, b) => b[1].ventas - a[1].ventas)
        .map(([nombre, datos]) => ({ nombre, ...datos }));
      return {
        ventasSemana: {
          periodo: `${ventas.semana.inicio} al ${ventas.semana.fin}`,
          totalVentas: ventas.totalVentas,
          ingresoTotal: ventas.ingresoTotal,
          desglose: ventas.desglose,
          alertaPreciosBajos: ventas.alertas.preciosBajos,
          porLocal: ventas.porLocal,
          porMetodoPago: ventas.porMetodoPago,
        },
        ventasMes: {
          periodo: ventasMes.periodo,
          total: ventasMes.total,
          ingresos: ventasMes.ingresos,
          preciosBajos: ventasMes.preciosBajos,
        },
        vendedoresDestacadosSemana: vendedoresDestacados,
        vendedoresConPrecioBajoSemana: vendedoresPrecioBajo,
        prestamos: {
          totalPrestamos: todos.length,
          porVendedor,
          prestamosViejos: prestamosConFecha,
        },
        alertaPedidosViejos: pedidosViejos,
        llegadasHoy: llegadas,
        exhibicionesPendientesReponer: exhibPendientes,
        finanzas: {
          hoy: gananciasHoy,
          semana: gananciasSemana,
          mes: analisisFinanciero,
        },
      };
    });
  }

  // ───────────────────────────────────────────────────────────
  // AGENTE CON HERRAMIENTAS (function calling)
  // ───────────────────────────────────────────────────────────

  private resumenHistorial: { hasta: number; texto: string } | null = null;
  private readonly MENSAJES_RECIENTES = 8;

  private parseFechaLocal(texto: string, finDeDia = false): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texto ?? '').trim());
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (isNaN(d.getTime())) return null;
    if (finDeDia) d.setHours(23, 59, 59, 999);
    else d.setHours(0, 0, 0, 0);
    return d;
  }

  /** Caja (dinero recibido) por vendedor en un rango, con las mismas reglas que las pantallas. */
  async obtenerCajaPorVendedor(desde?: string, hasta?: string): Promise<any> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const hoy = new Date();
      const ini = this.parseFechaLocal(desde ?? '') ?? this.getInicioHoy();
      const fin = this.parseFechaLocal(hasta ?? '', true) ?? this.getFinHoy();
      if (fin.getTime() - ini.getTime() > 93 * 24 * 60 * 60 * 1000) {
        return { error: 'El rango máximo es de 93 días.' };
      }
      const ventas = await firstValueFrom(
        this.salesService.getVentasPorSemana$(ini, fin),
      );
      const porVendedor = calcularCajaPorVendedor(ventas);
      const total = porVendedor.reduce(
        (a, c) => ({
          efectivo: a.efectivo + c.efectivo,
          transferencia: a.transferencia + c.transferencia,
          sistecredito: a.sistecredito + c.sistecredito,
          addi: a.addi + c.addi,
          bold: a.bold + c.bold,
          total: a.total + c.total,
          unidades: a.unidades + c.unidades,
        }),
        { efectivo: 0, transferencia: 0, sistecredito: 0, addi: 0, bold: 0, total: 0, unidades: 0 },
      );
      return {
        desde: ini.toISOString().slice(0, 10),
        hasta: fin.toISOString().slice(0, 10),
        generadoEl: hoy.toISOString(),
        nota: 'efectivo es el dinero que el vendedor tiene en la mano; transferencia/addi/sistecredito/bold no se recogen en efectivo.',
        totalGeneral: total,
        porVendedor,
      };
    });
  }

  private construirHerramientas(): Herramienta[] {
    const vacio = { type: 'object', properties: {} };
    const num = (descripcion: string) => ({ type: 'number', description: descripcion });
    const txt = (descripcion: string) => ({ type: 'string', description: descripcion });
    const fecha = 'Fecha en formato AAAA-MM-DD';

    return [
      {
        nombre: 'caja_por_vendedor',
        descripcion:
          'Dinero recibido por cada vendedor en un rango de fechas, por método de pago (efectivo, transferencia, sistecredito, addi, bold) y pares vendidos. Úsala para preguntas sobre plata, caja, cuánto debe tener un vendedor o cuadre. Sin fechas devuelve hoy.',
        parametros: {
          type: 'object',
          properties: { desde: txt(fecha), hasta: txt(fecha) },
        },
        ejecutar: (a) => this.obtenerCajaPorVendedor(a.desde, a.hasta),
      },
      {
        nombre: 'ventas_hoy',
        descripcion: 'Resumen de las ventas de hoy (total, pares, por vendedor y local).',
        parametros: vacio,
        ejecutar: () => this.obtenerVentasHoy(),
      },
      {
        nombre: 'ventas_semana',
        descripcion: 'Resumen de las ventas de la semana actual.',
        parametros: vacio,
        ejecutar: () => this.obtenerVentasSemana(),
      },
      {
        nombre: 'resumen_ventas',
        descripcion: 'Resumen de ventas de los últimos N días (tendencia, mejores días).',
        parametros: {
          type: 'object',
          properties: { dias: num('Cantidad de días hacia atrás (1 a 365). Por defecto 7.') },
        },
        ejecutar: (a) => this.obtenerResumenVentas(Math.min(Math.max(Number(a.dias) || 7, 1), 365)),
      },
      {
        nombre: 'ventas_precio_bajo',
        descripcion: 'Ventas hechas por debajo del precio mínimo.',
        parametros: vacio,
        ejecutar: () => this.obtenerVentasPrecioBajo(),
      },
      {
        nombre: 'ganancias_hoy',
        descripcion: 'Ganancias de hoy: lo que entró, lo que costaron los zapatos y lo que quedó libre.',
        parametros: vacio,
        ejecutar: () => this.obtenerGananciasHoy(),
      },
      {
        nombre: 'ganancias_semana',
        descripcion: 'Ganancias de la semana actual.',
        parametros: vacio,
        ejecutar: () => this.obtenerGananciasSemana(),
      },
      {
        nombre: 'analisis_financiero',
        descripcion: 'Análisis financiero de un mes (ingresos, costos, gastos, proyección, riesgo).',
        parametros: {
          type: 'object',
          properties: {
            mes: num('Mes de 0 (enero) a 11 (diciembre). Por defecto el mes actual.'),
            anio: num('Año con 4 dígitos. Por defecto el actual.'),
          },
        },
        ejecutar: (a) => this.obtenerAnalisisFinanciero(a.mes, a.anio),
      },
      {
        nombre: 'resumen_financiero_completo',
        descripcion: 'Resumen financiero completo del mes con gastos por categoría y estado del negocio.',
        parametros: {
          type: 'object',
          properties: {
            mes: num('Mes de 0 (enero) a 11 (diciembre). Por defecto el mes actual.'),
            anio: num('Año con 4 dígitos.'),
          },
        },
        ejecutar: (a) => this.obtenerResumenFinancieroCompleto(a.mes, a.anio),
      },
      {
        nombre: 'productos_por_rango_stock',
        descripcion: 'Referencias cuyo stock total está entre un mínimo y un máximo de pares.',
        parametros: {
          type: 'object',
          properties: {
            stock_min: num('Stock mínimo'),
            stock_max: num('Stock máximo'),
            top: num('Cuántas devolver (por defecto 30)'),
          },
          required: ['stock_min', 'stock_max'],
        },
        ejecutar: (a) =>
          this.obtenerProductosPorRangoStock(
            Number(a.stock_min) || 0,
            Number(a.stock_max) || 0,
            Number(a.top) || 30,
          ),
      },
      {
        nombre: 'productos_bajo_stock',
        descripcion: 'Referencias con poco stock (a punto de agotarse).',
        parametros: {
          type: 'object',
          properties: { minimo: num('Umbral de pares (por defecto 3)') },
        },
        ejecutar: (a) => this.obtenerProductosBajoStock(Number(a.minimo) || 3),
      },
      {
        nombre: 'stock_por_codigo',
        descripcion: 'Stock por talla y datos de una referencia según su código.',
        parametros: {
          type: 'object',
          properties: { codigo: num('Código del producto') },
          required: ['codigo'],
        },
        ejecutar: (a) => this.obtenerStockPorCodigo(Number(a.codigo)),
      },
      {
        nombre: 'stock_malo',
        descripcion:
          'Referencias con stock "malo" (tallas rotas o desbalanceadas). Puede filtrarse por rango de stock.',
        parametros: {
          type: 'object',
          properties: { desde: num('Stock desde (opcional)'), hasta: num('Stock hasta (opcional)') },
        },
        ejecutar: (a) =>
          a.desde !== undefined
            ? this.obtenerStockMaloPorRango(Number(a.desde), a.hasta !== undefined ? Number(a.hasta) : undefined)
            : this.obtenerStockMalo(),
      },
      {
        nombre: 'referencias_mas_vendidas',
        descripcion: 'Referencias más vendidas en los últimos N días con su stock actual. Sirve para decidir qué reponer.',
        parametros: {
          type: 'object',
          properties: { dias: num('Días hacia atrás (por defecto 30)') },
        },
        ejecutar: (a) => this.obtenerReferenciasMasVendidas(Math.min(Math.max(Number(a.dias) || 30, 1), 365)),
      },
      {
        nombre: 'zapatos_mas_vendidos',
        descripcion: 'Ranking de zapatos más vendidos.',
        parametros: {
          type: 'object',
          properties: { top: num('Cuántos devolver (por defecto 20)') },
        },
        ejecutar: (a) => this.obtenerZapatosMasVendidos(Math.min(Number(a.top) || 20, 50)),
      },
      {
        nombre: 'sugerencias_reposicion',
        descripcion:
          'Referencias que se van a agotar pronto, con ventas por semana, días para agotarse, urgencia y la cantidad de pares sugerida para reponer (cubre 3 semanas de venta). Úsala para "qué debo pedir/reponer".',
        parametros: {
          type: 'object',
          properties: {
            semanas_cobertura: num('Semanas de venta que se quiere cubrir (por defecto 3)'),
          },
        },
        ejecutar: async (a) => {
          const semanas = Math.min(Math.max(Number(a.semanas_cobertura) || 3, 1), 8);
          const alertas = await this.reposicionService.calcularAlertas(28);
          return {
            criterio: `Velocidad = promedio ponderado de las últimas 4 semanas. Sugerido = ventas por semana x ${semanas} - stock actual.`,
            total: alertas.length,
            sugerencias: alertas.slice(0, 40).map((x) => ({
              codigo: x.zapatoId,
              producto: `${x.marca} ${x.referencia}`.trim(),
              stockActual: x.stockActual,
              ventasPorSemana: x.ventasPorSemana,
              diasParaAgotarse: x.diasParaAgotarse,
              urgencia: x.urgencia,
              paresSugeridos: Math.max(0, Math.ceil(x.ventasPorSemana * semanas - x.stockActual)),
              historialSemanas: x.historialSemanas,
            })),
          };
        },
      },
      {
        nombre: 'calendario_comercial',
        descripcion:
          'Próximas fechas comerciales y festivos de Colombia (Día de la Madre, Amor y Amistad, Black Friday, primas, puentes) con lo que se vendió esas mismas fechas el año pasado, referencias estrella y riesgo de agotarse. Úsala para planear compras, inventario y promociones por temporada.',
        parametros: {
          type: 'object',
          properties: { dias: num('Cuántos días hacia adelante mirar (7 a 180, por defecto 60)') },
        },
        ejecutar: (a) => this.funciones.llamar('consultarCalendario', { dias: Number(a.dias) || 60 }),
      },
      {
        nombre: 'sugerencias_precios',
        descripcion:
          'Sugerencias de precio respaldadas por datos: qué referencias subir (se venden rápido con margen bajo), cuáles poner en promoción (capital detenido), dónde el precio mínimo está muy alto, y cuáles no tienen margen para descontar. Nunca sugiere bajar del costo + 5%. Las cifras vienen calculadas; tú solo explica el porqué y recomienda prioridades.',
        parametros: {
          type: 'object',
          properties: { limite: num('Cuántas sugerencias por categoría (3 a 30, por defecto 12)') },
        },
        ejecutar: (a) => this.funciones.llamar('sugerirPrecios', { limite: Number(a.limite) || 12 }),
      },
      {
        nombre: 'descuadres_inventario',
        descripcion:
          'Detecta referencias cuyos pares no cuadran: compara lo ingresado contra lo que hay en bodega, pedidos con vendedores, pedidos devueltos sin confirmar, préstamos, ventas, exhibiciones y locales. Con "codigo" analiza una sola referencia y muestra dónde está cada par; sin código revisa todo el inventario.',
        parametros: {
          type: 'object',
          properties: { codigo: num('Código de la referencia (opcional)') },
        },
        ejecutar: (a) =>
          this.funciones.llamar('analizarDescuadres', a.codigo !== undefined && a.codigo !== null ? { codigo: Number(a.codigo) } : {}),
      },
      {
        nombre: 'cuadres_pendientes',
        descripcion:
          'Vendedores con efectivo en los últimos días que todavía no tienen un cuadre de caja guardado, con el efectivo por recoger.',
        parametros: {
          type: 'object',
          properties: { dias: num('Cuántos días revisar (1 a 10, por defecto 3)') },
        },
        ejecutar: (a) => this.funciones.llamar('consultarCuadresPendientes', { dias: Number(a.dias) || 3 }),
      },
      {
        nombre: 'clientes_whatsapp_esperando',
        descripcion:
          'Clientes que escribieron por WhatsApp y están esperando que un asesor les responda (con su teléfono, el código que preguntaron y el motivo).',
        parametros: vacio,
        ejecutar: async () => {
          const snap = await runInInjectionContext(this.injector, () =>
            getDocs(
              query(
                collection(this.firestore, 'solicitudesWhatsApp'),
                where('atendida', '==', false),
                limit(30),
              ),
            ),
          );
          return {
            total: snap.size,
            solicitudes: snap.docs.map((d) => {
              const x: any = d.data();
              const tel = String(x.telefono ?? '').replace(/\D/g, '');
              return {
                nombre: x.nombre ?? null,
                telefono: x.telefono ?? null,
                enlaceWhatsApp: tel ? `https://wa.me/${tel}` : null,
                motivo: x.motivo ?? null,
                codigo: x.codigo ?? null,
                talla: x.talla ?? null,
                mensaje: x.mensaje ?? null,
              };
            }),
          };
        },
      },
      {
        nombre: 'referencias_para_promocion',
        descripcion:
          'Referencias con mucho tiempo en bodega o sin movimiento, candidatas a promoción o liquidación. Al sugerir descuentos, respeta el precio de adquisición y el precio mínimo: nunca propongas vender por debajo del costo.',
        parametros: vacio,
        ejecutar: () => this.obtenerReferenciasParaPromocion(),
      },
      {
        nombre: 'referencias_viejas_con_stock',
        descripcion: 'Referencias antiguas que aún tienen stock.',
        parametros: {
          type: 'object',
          properties: { top: num('Cuántas devolver (por defecto 20)') },
        },
        ejecutar: (a) => this.obtenerReferenciasViejasConStock(Math.min(Number(a.top) || 20, 50)),
      },
      {
        nombre: 'perfil_vendedor',
        descripcion: 'Desempeño de un vendedor esta semana: ventas, préstamos, referencias.',
        parametros: {
          type: 'object',
          properties: { nombre: txt('Nombre del vendedor') },
          required: ['nombre'],
        },
        ejecutar: (a) => this.obtenerPerfilVendedor(String(a.nombre ?? '')),
      },
      {
        nombre: 'prestamos_resumen',
        descripcion: 'Resumen de préstamos activos por vendedor.',
        parametros: vacio,
        ejecutar: () => this.obtenerResumenPrestamos(),
      },
      {
        nombre: 'prestamos_por_fecha',
        descripcion: 'Préstamos ordenados del más antiguo al más reciente (para detectar los que llevan más tiempo sin devolverse).',
        parametros: vacio,
        ejecutar: () => this.obtenerPrestamosOrdenadosPorFecha(),
      },
      {
        nombre: 'prestamos_por_codigo',
        descripcion: 'Préstamos de una referencia específica.',
        parametros: {
          type: 'object',
          properties: { codigo: num('Código del producto') },
          required: ['codigo'],
        },
        ejecutar: (a) => this.obtenerPrestamosPorCodigo(Number(a.codigo)),
      },
      {
        nombre: 'pedidos_pendientes',
        descripcion: 'Pedidos a bodega pendientes y pedidos recibidos hace tiempo sin cerrar.',
        parametros: vacio,
        ejecutar: async () => ({
          pedidosPendientes: await this.obtenerPedidosPendientes(),
          pedidosRecibidosViejos: await this.obtenerPedidosRecibidosViejos(),
        }),
      },
      {
        nombre: 'pedidos_devueltos',
        descripcion: 'Pedidos devueltos a bodega, con análisis de devoluciones.',
        parametros: vacio,
        ejecutar: async () => ({
          devueltos: await this.obtenerPedidosDevueltos(),
          analisis: await this.obtenerAnalisisDevoluciones(),
        }),
      },
      {
        nombre: 'historial_pedidos_por_codigo',
        descripcion: 'Historial de pedidos de una referencia.',
        parametros: {
          type: 'object',
          properties: { codigo: num('Código del producto') },
          required: ['codigo'],
        },
        ejecutar: (a) => this.obtenerHistorialPedidosPorCodigo(Number(a.codigo)),
      },
      {
        nombre: 'faltantes_exhibicion',
        descripcion: 'Referencias que faltan por exhibir en los locales.',
        parametros: vacio,
        ejecutar: () => this.obtenerFaltantesExhibicion(),
      },
      {
        nombre: 'exhibiciones_pendientes',
        descripcion: 'Exhibiciones pendientes de atender (solicitadas, prestadas, por devolver).',
        parametros: vacio,
        ejecutar: () => this.obtenerExhibicionesPendientes(),
      },
      {
        nombre: 'exhibiciones_por_codigo_y_local',
        descripcion: 'Exhibiciones de una referencia en un local.',
        parametros: {
          type: 'object',
          properties: {
            codigo: num('Código del producto'),
            local: txt('Número o nombre del local'),
            cantidad: num('Cuántas devolver (por defecto 5)'),
          },
          required: ['codigo', 'local'],
        },
        ejecutar: (a) =>
          this.obtenerExhibicionesPorCodigoYLocal(a.codigo, String(a.local), Number(a.cantidad) || 5),
      },
      {
        nombre: 'llegadas',
        descripcion: 'Llegadas de mercancía a bodega y su puntualidad.',
        parametros: {
          type: 'object',
          properties: { periodo: { type: 'string', enum: ['hoy', 'semana'] } },
        },
        ejecutar: (a) =>
          a.periodo === 'semana' ? this.obtenerLlegadasSemana() : this.obtenerLlegadasHoy(),
      },
      {
        nombre: 'historial_bodega',
        descripcion: 'Movimientos de bodega (ingresos, salidas, ajustes).',
        parametros: {
          type: 'object',
          properties: { periodo: { type: 'string', enum: ['hoy', 'semana'] } },
        },
        ejecutar: (a) =>
          a.periodo === 'semana' ? this.obtenerHistorialBodegaSemana() : this.obtenerHistorialBodegaHoy(),
      },
    ];
  }

  /** Conserva los últimos mensajes tal cual y resume los anteriores para no perder el hilo. */
  private async prepararHistorial(
    historialChat: MensajeChat[],
    pregunta: string,
  ): Promise<{ recientes: IaMensajeGateway[]; resumen: string }> {
    let validos = historialChat.filter((m) => !m.cargando && m.contenido);
    // El último mensaje del usuario es la pregunta actual: no se repite
    const ultimo = validos[validos.length - 1];
    if (ultimo?.rol === 'usuario' && ultimo.contenido === pregunta) {
      validos = validos.slice(0, -1);
    }

    const aGateway = (m: MensajeChat): IaMensajeGateway => ({
      role: m.rol === 'usuario' ? 'user' : 'assistant',
      content: m.contenido,
    });

    if (validos.length <= this.MENSAJES_RECIENTES) {
      this.resumenHistorial = null;
      return { recientes: validos.map(aGateway), resumen: '' };
    }

    const antiguos = validos.slice(0, -this.MENSAJES_RECIENTES);
    const recientes = validos.slice(-this.MENSAJES_RECIENTES).map(aGateway);

    // Se vuelve a resumir solo cuando hay varios mensajes nuevos que resumir
    if (
      !this.resumenHistorial ||
      antiguos.length - this.resumenHistorial.hasta >= 4 ||
      this.resumenHistorial.hasta > antiguos.length
    ) {
      try {
        const texto = await this.gateway.texto('memoria', {
          temperature: 0.2,
          max_tokens: 500,
          messages: [
            {
              role: 'system',
              content:
                'Resume esta conversación entre un administrador y su asistente de negocio. Conserva: preguntas hechas, cifras y nombres mencionados, decisiones y pendientes. Máximo 10 líneas, en español, sin inventar nada.',
            },
            {
              role: 'user',
              content: antiguos
                .map((m) => `${m.rol === 'usuario' ? 'Admin' : 'Asistente'}: ${m.contenido.slice(0, 700)}`)
                .join('\n'),
            },
          ],
        });
        this.resumenHistorial = { hasta: antiguos.length, texto };
      } catch {
        // Si no se puede resumir, se sigue solo con los mensajes recientes
      }
    }
    return { recientes, resumen: this.resumenHistorial?.texto ?? '' };
  }

  private async responderConAgente(
    mensajeUsuario: string,
    historialChat: MensajeChat[],
  ): Promise<string> {
    const fechaHoy = new Date().toLocaleDateString('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const [reglas, { recientes, resumen }] = await Promise.all([
      this.memoriaNegocio.paraPrompt().catch(() => ''),
      this.prepararHistorial(historialChat, mensajeUsuario),
    ]);

    const system = `${this.obtenerContextoSistema()}
${reglas}
FECHA ACTUAL: ${fechaHoy}
${resumen ? `\nRESUMEN DE LA CONVERSACIÓN ANTERIOR:\n${resumen}\n` : ''}
CÓMO USAR TUS HERRAMIENTAS:
- Para responder con datos del negocio DEBES llamar a las herramientas disponibles. No inventes cifras, nombres, fechas ni cantidades.
- Puedes llamar varias herramientas en el mismo turno si la pregunta lo necesita.
- Si la pregunta es sobre plata, caja, "cuánto debe tener" un vendedor o cuadre, usa caja_por_vendedor. Esa es la fuente oficial de la caja.
- Si una herramienta devuelve error o datos vacíos, dilo con claridad en vez de suponer.
- Si el resultado trae un aviso de recorte, menciónalo y ofrece filtrar.
- Si preguntan qué comprar o reponer para una fecha o temporada, usa calendario_comercial (y sugerencias_reposicion si piden cantidades).
- Si preguntan por precios, descuentos, qué subir o qué liquidar, usa sugerencias_precios. Los precios sugeridos son sugerencias calculadas: preséntalos como tal y nunca propongas vender por debajo del costo.
- Si preguntan por pares que no cuadran, faltantes o dónde está un par, usa descuadres_inventario; con un código, explica en qué lugar está cada par (bodega, pedidos, préstamos, ventas, exhibiciones, locales).
- Si preguntan por cuadres de caja pendientes, usa cuadres_pendientes.
- Para saludos, estrategia o consejos generales no necesitas herramientas.
- Nunca menciones los nombres de las herramientas al usuario.`;

    const r = await ejecutarAgente({
      gateway: this.gateway,
      funcion: 'chat',
      system,
      historial: recientes,
      pregunta: mensajeUsuario,
      herramientas: this.construirHerramientas(),
      modelo: this.modeloActual,
      limpiar: (d) => this.limpiarDatosParaIA(d),
    });
    return r.texto;
  }

  /**
   * Punto de entrada del chat. Intenta primero con el agente (el modelo elige
   * qué datos consultar) y, si falla por un problema técnico, usa el método clásico.
   */
  async enviarMensaje(
    mensajeUsuario: string,
    historialChat: MensajeChat[],
  ): Promise<string> {
    try {
      const comando = await this.memoriaNegocio.procesarComando(mensajeUsuario);
      if (comando) return comando;
    } catch (e) {
      console.warn('[IA] No se pudo procesar el comando de memoria:', e);
    }

    try {
      return await this.responderConAgente(mensajeUsuario, historialChat);
    } catch (error: any) {
      const codigo = error?.codigo;
      if (
        codigo === 'resource-exhausted' ||
        codigo === 'permission-denied' ||
        codigo === 'unauthenticated'
      ) {
        throw error;
      }
      console.warn('[IA] El agente falló, se usa el método clásico:', error);
      return this.enviarMensajeClasico(mensajeUsuario, historialChat);
    }
  }

  private async enviarMensajeClasico(
    mensajeUsuario: string,
    historialChat: MensajeChat[],
  ): Promise<string> {
    return runInInjectionContext(this.injector, async () => {
      try {
        const contextoData =
          await this.obtenerContextoSegunPregunta(mensajeUsuario);
        const contextoLimpio = contextoData
          ? this.limpiarDatosParaIA(contextoData)
          : null;
        const fechaHoy = new Date().toLocaleDateString('es-CO', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
        const contextoStr = contextoLimpio
          ? JSON.stringify(contextoLimpio, null, 0)
          : null;
        const contextoFinal =
          contextoStr && contextoStr.length > 8000
            ? contextoStr.substring(0, 8000) + '...[datos truncados]'
            : contextoStr;
        const promptCompleto = `
FECHA ACTUAL: ${fechaHoy}

${contextoFinal ? `DATOS DEL SISTEMA (USA SOLO ESTOS, NO INVENTES NADA):\n${contextoFinal}\n` : ''}

INSTRUCCIONES ESTRICTAS:
- Para productosRangoStock: el campo "stock" ya viene filtrado y verificado. NUNCA recalcules el stock sumando tallas ni tallasDisponibles. Muestra ÚNICAMENTE los productos que aparezcan en los datos y usa el valor exacto del campo "stock" que viene en cada producto. No agregues ni quites productos de la lista.
- USA ÚNICAMENTE los números y nombres que aparecen en los datos de arriba.
- NUNCA inventes fechas, precios, nombres ni cantidades.
- En llegadas: esTarde=true significa TARDE (después de 9:20am). NUNCA lo clasifiques como puntual.
- En pedidos devueltos: SIEMPRE muestra todos los detalles disponibles.
- Para análisis financiero: usa la estructura de 8 puntos del sistema. Sé directo con los números.
- Si hay riesgoQuiebra.enRiesgo=true: mencionarlo CLARAMENTE con las cifras exactas.
- Si hay proyeccion: úsala para dar perspectiva de cómo cerrará el mes.
- En gastosPorCategoria: compara cada uno con su benchmark y señala cuáles reducir y cómo.
- Para preguntas de estrategia: responde como consultor experto en retail.
- Para referenciasMasVendidas y referenciasParaPromocion: LISTA ABSOLUTAMENTE TODAS las referencias que vengan en los datos. Si hay 20, muéstralas todas numeradas. Para cada una SIEMPRE incluye el zapatoId (código) exactamente como aparece en el campo "zapatoId" del dato. Ejemplo de formato: "1. Nike - Af1 blanco | Código: [zapatoId] | X ventas | Stock: Y".

PREGUNTA: ${mensajeUsuario}
`;

        const historialValido = historialChat
          .filter((m) => !m.cargando && m.contenido)
          .slice(-4)
          .map((m) => ({
            role:
              m.rol === 'usuario' ? ('user' as const) : ('assistant' as const),
            content: m.contenido,
          }));
        const result = await this.enviarConRetry(() =>
          this.gateway.crear('chat', {
            modelo: this.modeloActual,
            messages: [
              { role: 'system', content: this.obtenerContextoSistema() },
              ...historialValido,
              { role: 'user', content: promptCompleto },
            ],
            temperature: 0.4,
            max_tokens: 1200,
          }),
        );
        return result.choices[0]?.message?.content ?? 'Sin respuesta';
      } catch (error: any) {
        if (error?.message?.includes('429') || error?.codigo === 'resource-exhausted')
          return 'Demasiadas consultas seguidas. Espera unos segundos e intenta de nuevo.';
        throw error;
      }
    });
  }

  private async obtenerContextoSegunPregunta(pregunta: string): Promise<any> {
    const p = pregunta.toLowerCase();
    const matchRangoStock = this.detectarRangoStock(p);
    console.log('[DEBUG rangoStock]', p, matchRangoStock);
    if (matchRangoStock) {
      const { min, max, top } = matchRangoStock;
      const productos = await this.obtenerProductosPorRangoStock(min, max, top);
      return {
        productosRangoStock: productos,
        total: productos.length,
        criterio: `Stock entre ${min} y ${max} pares`,
      };
    }
    if (
      p.includes('falta') ||
      p.includes('faltan') ||
      p.includes('faltante') ||
      p.includes('faltantes') ||
      p.includes('sin exhibicion') ||
      p.includes('sin exhibición') ||
      p.includes('no está exhibido') ||
      p.includes('no esta exhibido') ||
      p.includes('no tienen exhibicion') ||
      p.includes('no tienen exhibición') ||
      p.includes('exhibiciones faltantes') ||
      p.includes('revisar exhibiciones') ||
      (p.includes('exhibicion') && p.includes('local')) ||
      (p.includes('exhibición') && p.includes('local')) ||
      (p.includes('disponible') && p.includes('bodega') && p.includes('local'))
    ) {
      return {
        faltantesExhibicion: await this.obtenerFaltantesExhibicion(),
      };
    }

    if (
      p.includes('recomienda') ||
      p.includes('volver a traer') ||
      p.includes('reponer') ||
      p.includes('qué traer') ||
      p.includes('que traer') ||
      p.includes('pedir más') ||
      p.includes('pedir mas') ||
      (p.includes('demanda') && p.includes('referencia')) ||
      (p.includes('más vendido') && p.includes('stock'))
    ) {
      return {
        referenciasMasVendidas: await this.obtenerReferenciasMasVendidas(30),
      };
    }

    if (
      p.includes('promocion') ||
      p.includes('promoción') ||
      p.includes('liquidar') ||
      p.includes('liquidación') ||
      p.includes('liquidacion') ||
      p.includes('descuento') ||
      p.includes('varado') ||
      p.includes('parado') ||
      p.includes('sin movimiento') ||
      (p.includes('viejo') && p.includes('referencia')) ||
      p.includes('no se vende') ||
      p.includes('mucho tiempo en bodega') ||
      p.includes('qué promocion') ||
      p.includes('que promocion')
    ) {
      return {
        referenciasParaPromocion: await this.obtenerReferenciasParaPromocion(),
      };
    }
    if (
      (p.includes('finanza') ||
        p.includes('financiero') ||
        p.includes('resumen financiero') ||
        p.includes('estado financiero')) &&
      (p.includes('este mes') ||
        p.includes('del mes') ||
        p.includes('mensual') ||
        p.includes('completo'))
    ) {
      const mesesMap: Record<string, number> = {
        enero: 0,
        febrero: 1,
        marzo: 2,
        abril: 3,
        mayo: 4,
        junio: 5,
        julio: 6,
        agosto: 7,
        septiembre: 8,
        octubre: 9,
        noviembre: 10,
        diciembre: 11,
      };
      let mesTarget: number | undefined;
      for (const [nombre, num] of Object.entries(mesesMap)) {
        if (p.includes(nombre)) {
          mesTarget = num;
          break;
        }
      }
      return {
        resumenFinancieroCompleto:
          await this.obtenerResumenFinancieroCompleto(mesTarget),
      };
    }

    if (
      p.includes('hoy') ||
      p.includes('día de hoy') ||
      p.includes('dia de hoy') ||
      (p.includes('venta') &&
        (p.includes('hoy') || p.includes('día') || p.includes('dia')) &&
        !p.includes('semana') &&
        !p.includes('mes'))
    ) {
      return { ventasHoy: await this.obtenerVentasHoy() };
    }

    if (
      (p.includes('ganancia') ||
        p.includes('utilidad') ||
        p.includes('margen') ||
        p.includes('cuánto gané') ||
        p.includes('cuanto gane') ||
        p.includes('qué dejó') ||
        p.includes('que dejo')) &&
      (p.includes('hoy') || p.includes('día') || p.includes('dia'))
    ) {
      return { gananciasHoy: await this.obtenerGananciasHoy() };
    }

    if (
      (p.includes('ganancia') ||
        p.includes('utilidad') ||
        p.includes('margen') ||
        p.includes('cuánto gané') ||
        p.includes('cuanto gane')) &&
      p.includes('semana')
    ) {
      return { gananciasSemana: await this.obtenerGananciasSemana() };
    }

    if (
      p.includes('ganancia') ||
      p.includes('utilidad') ||
      p.includes('rentabilidad') ||
      p.includes('financiero') ||
      p.includes('finanza') ||
      p.includes('gasto') ||
      p.includes('economizar') ||
      p.includes('ahorrar') ||
      p.includes('reducir costo') ||
      p.includes('punto de equilibrio') ||
      p.includes('cuanto queda') ||
      p.includes('cuánto queda') ||
      p.includes('me está dejando') ||
      p.includes('me deja') ||
      p.includes('es rentable') ||
      p.includes('perdiendo') ||
      p.includes('ganando') ||
      p.includes('quiebra') ||
      (p.includes('gano') && !p.includes('vendedor')) ||
      p.includes('estado de resultado') ||
      p.includes('p&g') ||
      p.includes('inversion') ||
      p.includes('inversión')
    ) {
      const mesesMap: Record<string, number> = {
        enero: 0,
        febrero: 1,
        marzo: 2,
        abril: 3,
        mayo: 4,
        junio: 5,
        julio: 6,
        agosto: 7,
        septiembre: 8,
        octubre: 9,
        noviembre: 10,
        diciembre: 11,
      };
      let mesTarget: number | undefined;
      for (const [nombre, num] of Object.entries(mesesMap)) {
        if (p.includes(nombre)) {
          mesTarget = num;
          break;
        }
      }
      return {
        analisisFinanciero: await this.obtenerAnalisisFinanciero(mesTarget),
      };
    }

    if (
      p.includes('historial bodega') ||
      p.includes('movimientos bodega') ||
      p.includes('salidas bodega') ||
      p.includes('cuantos salieron') ||
      p.includes('cuántos salieron') ||
      p.includes('pares salieron') ||
      p.includes('salieron hoy') ||
      p.includes('devoluciones aceptadas') ||
      p.includes('devoluciones de hoy') ||
      p.includes('cuantas devoluciones') ||
      p.includes('cuántas devoluciones') ||
      (p.includes('exhibicion') &&
        (p.includes('mandaron') ||
          p.includes('enviaron') ||
          p.includes('salieron') ||
          p.includes('cuantas'))) ||
      (p.includes('pedido') &&
        (p.includes('salieron') ||
          p.includes('mandaron') ||
          p.includes('cuantos')) &&
        !p.includes('devuelto') &&
        !p.includes('pendiente') &&
        !p.includes('recibido'))
    ) {
      if (p.includes('semana'))
        return { historialBodega: await this.obtenerHistorialBodegaSemana() };
      return { historialBodega: await this.obtenerHistorialBodegaHoy() };
    }

    if (
      (p.includes('pendiente') &&
        (p.includes('exhibicion') ||
          p.includes('exhibición') ||
          p.includes('reponer') ||
          p.includes('mandar'))) ||
      p.includes('exhibiciones pendientes') ||
      p.includes('por reponer') ||
      p.includes('notificacion') ||
      p.includes('notificación') ||
      ((p.includes('cuantas exhibicion') || p.includes('cuántas exhibicion')) &&
        !p.includes('mandaron') &&
        !p.includes('historial'))
    ) {
      return {
        exhibicionesPendientes: await this.obtenerExhibicionesPendientes(),
      };
    }

    if (
      (p.includes('llegada') ||
        p.includes('llegaron') ||
        p.includes('llegó') ||
        p.includes('llego') ||
        p.includes('asistencia') ||
        p.includes('puntual') ||
        p.includes('tarde') ||
        p.includes('horario')) &&
      (p.includes('semana') || p.includes('semanal'))
    ) {
      return { llegadasSemana: await this.obtenerLlegadasSemana() };
    }

    if (
      p.includes('llegada') ||
      p.includes('llegaron') ||
      p.includes('llegó') ||
      p.includes('llego') ||
      p.includes('asistencia') ||
      p.includes('puntual') ||
      p.includes('tarde') ||
      p.includes('horario') ||
      p.includes('registro') ||
      p.includes('quién vino') ||
      p.includes('quien vino') ||
      p.includes('quienes llegaron')
    ) {
      return { llegadasHoy: await this.obtenerLlegadasHoy() };
    }

    if (
      p.includes('devuelto') ||
      p.includes('devolución') ||
      p.includes('devolucion')
    ) {
      if (
        (p.includes('pedido') && p.includes('devuelto')) ||
        p.includes('pedidos devueltos') ||
        p.includes('hay devueltos') ||
        p.includes('cuales devueltos') ||
        p.includes('cuáles devueltos') ||
        p.includes('dime los devueltos') ||
        p.includes('lista devueltos') ||
        (p.includes('devuelto') && !p.includes('historial'))
      ) {
        const devueltos = await this.obtenerPedidosDevueltos();
        return { pedidosDevueltos: devueltos, total: devueltos.length };
      }
      return { analisisDevoluciones: await this.obtenerAnalisisDevoluciones() };
    }

    const matchExhibicion = this.detectarConsultaExhibicion(p);
    if (matchExhibicion) {
      const { codigo, local, cantidad } = matchExhibicion;
      const exhibiciones = await this.obtenerExhibicionesPorCodigoYLocal(
        codigo,
        local,
        cantidad,
      );
      return { exhibiciones, consultado: { codigo, local, cantidad } };
    }

    const matchRango = this.detectarRangoCodigos(p);
    if (
      matchRango &&
      (p.includes('stock malo') ||
        p.includes('stock incorrecto') ||
        p.includes('no cuadra') ||
        p.includes('cuadra') ||
        p.includes('problema') ||
        p.includes('mal'))
    ) {
      const malos = await this.obtenerStockMaloPorRango(
        matchRango.desde,
        matchRango.hasta,
      );
      return {
        referenciasConStockMalo: malos,
        total: malos.length,
        rango: matchRango,
      };
    }

    if (
      p.includes('stock malo') ||
      p.includes('stock incorrecto') ||
      p.includes('inventario malo') ||
      p.includes('discrepancia') ||
      p.includes('referencias malas') ||
      p.includes('referencias con problema') ||
      p.includes('no cuadra') ||
      p.includes('suma mal') ||
      (p.includes('cuadra') && !p.includes('código') && !p.includes('codigo'))
    ) {
      const malos = await this.obtenerStockMalo();
      return { referenciasConStockMalo: malos, total: malos.length };
    }

    const codigoStock = this.detectarCodigoEnPregunta(p, [
      'stock',
      'cuadra',
      'bien',
      'malo',
      'correcto',
      'incorrecto',
      'inventario',
    ]);

    if (
      (p.includes('viejo') ||
        p.includes('viej') ||
        p.includes('antiguo') ||
        p.includes('más tiempo') ||
        p.includes('mas tiempo') ||
        p.includes('cuánto tiempo') ||
        p.includes('cuanto tiempo') ||
        p.includes('días') ||
        p.includes('dias') ||
        p.includes('fecha')) &&
      (p.includes('préstamo') || p.includes('prestamo'))
    ) {
      return {
        prestamosOrdenados: await this.obtenerPrestamosOrdenadosPorFecha(),
      };
    }
    if (codigoStock !== null)
      return { stockCodigo: await this.obtenerStockPorCodigo(codigoStock) };

    const codigoPrestamo = this.detectarCodigoEnPregunta(p, [
      'préstamo',
      'prestamo',
      'prestados',
      'prestó',
    ]);
    if (codigoPrestamo !== null) {
      const prestamos = await this.obtenerPrestamosPorCodigo(codigoPrestamo);
      return { prestamos, codigoConsultado: codigoPrestamo };
    }

    const codigoHistorial = this.detectarCodigoEnPregunta(p, [
      'historial',
      'pedidos del código',
      'pedidos del codigo',
      'salidas del',
    ]);
    if (codigoHistorial !== null) {
      const historial =
        await this.obtenerHistorialPedidosPorCodigo(codigoHistorial);
      return { historialPedidos: historial, codigoConsultado: codigoHistorial };
    }

    if (
      p.includes('perfil') ||
      p.includes('análisis de') ||
      p.includes('analisis de') ||
      p.includes('rendimiento de') ||
      p.includes('cómo va') ||
      p.includes('como va')
    ) {
      const fragmento = await this.detectarNombreVendedor(p);
      if (fragmento) {
        const nombreCompleto = await this.resolverNombreVendedor(fragmento);
        if (nombreCompleto)
          return {
            perfilVendedor: await this.obtenerPerfilVendedor(nombreCompleto),
          };
        else {
          const snap = await getDocs(
            query(
              collection(this.firestore, 'ventas'),
              orderBy('fechaVenta', 'desc'),
              limit(300),
            ),
          );
          const vendedores = [
            ...new Set(
              snap.docs.map((d) => d.data()['vendedor']).filter(Boolean),
            ),
          ];
          return {
            errorPerfil: `No se encontró ningún vendedor que coincida con "${fragmento}".`,
            vendedoresDisponibles: vendedores,
          };
        }
      }
    }

    if (
      p.includes('viejo') ||
      p.includes('viejos') ||
      p.includes('antiguo') ||
      p.includes('antiguos') ||
      p.includes('hace mucho') ||
      p.includes('sin vender') ||
      p.includes('mucho tiempo') ||
      (p.includes('referencia') && p.includes('stock'))
    ) {
      return {
        referenciasViejasConStock:
          await this.obtenerReferenciasViejasConStock(),
      };
    }

    if (p.includes('mes') || p.includes('30 días') || p.includes('30 dias')) {
      return { resumenVentas: await this.obtenerResumenVentas(30) };
    }

    if (
      p.includes('mas vendido') ||
      p.includes('más vendido') ||
      p.includes('mas ventas') ||
      p.includes('más ventas') ||
      p.includes('mejor vendido') ||
      p.includes('mejores vendidos') ||
      p.includes('cuales se venden') ||
      p.includes('cuáles se venden') ||
      p.includes('productos mas vendidos') ||
      p.includes('referencias mas vendidas')
    ) {
      const topVendidos = await this.obtenerZapatosMasVendidos(30);
      return {
        zapatosMasVendidos: topVendidos,
        resumenTop: topVendidos.slice(0, 10).map((z, index) => ({
          puesto: index + 1,
          codigo: z.zapatoId,
          marca: z.marca,
          referencia: z.referencia,
          talla: z.talla,
          ventas: z.totalVentas,
          ingresos: z.ingresoTotal,
        })),
      };
    }

    if (
      p.includes('semana') ||
      p.includes('semanal') ||
      (p.includes('venta') &&
        !p.includes('precio bajo') &&
        !p.includes('barato') &&
        !p.includes('hoy') &&
        !p.includes('día') &&
        !p.includes('dia') &&
        !p.includes('ayer') &&
        !p.includes('mas vendido') &&
        !p.includes('más vendido') &&
        !p.includes('mejor vendido'))
    ) {
      return { ventasSemana: await this.obtenerVentasSemana() };
    }
    if (
      (p.includes('ingreso') ||
        p.includes('factura') ||
        p.includes('recaudó') ||
        p.includes('recaudo')) &&
      !p.includes('hoy') &&
      !p.includes('día') &&
      !p.includes('dia')
    ) {
      return { ventasSemana: await this.obtenerVentasSemana() };
    }

    if (
      p.includes('stock') ||
      p.includes('inventario') ||
      p.includes('agota') ||
      p.includes('queda')
    ) {
      return { productosBajoStock: await this.obtenerProductosBajoStock() };
    }

    if (
      p.includes('préstamo') ||
      p.includes('prestamo') ||
      p.includes('fiado')
    ) {
      const snapshot = await getDocs(collection(this.firestore, 'prestamos'));
      const todos = snapshot.docs.map((d) => d.data());
      const palabrasIgnorar = [
        'prestamo',
        'préstamo',
        'prestamos',
        'préstamos',
        'los',
        'las',
        'cuantos',
        'cuántos',
        'hay',
        'activos',
        'fiado',
        'dame',
        'dime',
        'quiero',
        'ver',
        'lista',
        'todos',
        'total',
        'tiene',
        'tienen',
      ];
      const palabras = p
        .split(/\s+/)
        .filter((w) => w.length > 3 && !palabrasIgnorar.includes(w));
      for (const palabra of palabras) {
        const filtrados = todos.filter((pr: any) =>
          (pr['vendedor'] ?? '').toLowerCase().includes(palabra),
        );
        if (filtrados.length > 0)
          return {
            prestamos: filtrados.map((pr: any) => ({
              zapatoId: pr['zapatoId'],
              vendedor: pr['vendedor'],
              fecha: pr['fechaPrestamo']?.seconds
                ? new Date(
                    pr['fechaPrestamo'].seconds * 1000,
                  ).toLocaleDateString('es-CO')
                : (pr['fechaPrestamo'] ?? null),
              local: pr['localPrestado'] ?? pr['local'] ?? null,
              marca: pr['marca'] ?? null,
              referencia: pr['referencia'] ?? null,
              talla: pr['talla'] ?? null,
              precio: pr['precio'] ?? null,
            })),
            total: filtrados.length,
            filtradoPor: palabra,
          };
      }
      const porVendedor: Record<string, number> = {};
      for (const pr of todos) {
        const v = pr['vendedor'] ?? 'Sin especificar';
        porVendedor[v] = (porVendedor[v] || 0) + 1;
      }
      return { totalPrestamos: todos.length, porVendedor };
    }

    if (p.includes('pedido') || p.includes('pendiente')) {
      const [pendientes, viejos] = await Promise.all([
        this.obtenerPedidosPendientes(),
        this.obtenerPedidosRecibidosViejos(),
      ]);
      return { pedidosPendientes: pendientes, pedidosRecibidosViejos: viejos };
    }

    if (
      p.includes('precio bajo') ||
      p.includes('barato') ||
      p.includes('descuento') ||
      p.includes('mínimo') ||
      p.includes('minimo')
    ) {
      return { ventasPrecioBajo: await this.obtenerVentasPrecioBajo() };
    }

    if (
      p.includes('resumen') ||
      p.includes('cómo vamos') ||
      p.includes('como vamos') ||
      p.includes('estado') ||
      p.includes('general')
    ) {
      return await this.obtenerResumenGeneral();
    }

    return null;
  }

  private detectarRangoStock(
    p: string,
  ): { min: number; max: number; top: number } | null {
    const matchEntre = p.match(/entre\s+(\d+)\s+(?:y|a)\s+(\d+)/);
    const matchMenos = p.match(/menos\s+de\s+(\d+)\s+(?:pares|unidades)/);
    const matchHasta = p.match(
      /(?:hasta|máximo|maximo)\s+(\d+)\s+(?:pares|unidades)/,
    );
    const matchConPares = p.match(/con\s+(\d+)\s+(?:pares|unidades)/);

    const esListado =
      /referencias|productos|referencias con|listado|dame|muéstrame|muestrame/.test(
        p,
      );

    if (!esListado) return null;

    if (matchEntre) {
      const min = parseInt(matchEntre[1]);
      const max = parseInt(matchEntre[2]);
      if (!isNaN(min) && !isNaN(max) && max >= min)
        return { min, max, top: 30 };
    }

    if (matchMenos) {
      const max = parseInt(matchMenos[1]) - 1;
      if (!isNaN(max) && max >= 1) return { min: 1, max, top: 30 };
    }

    if (matchHasta) {
      const max = parseInt(matchHasta[1]);
      if (!isNaN(max) && max >= 1) return { min: 1, max, top: 30 };
    }

    if (matchConPares) {
      const n = parseInt(matchConPares[1]);
      if (!isNaN(n)) return { min: n, max: n, top: 30 };
    }

    return null;
  }

  private async detectarNombreVendedor(p: string): Promise<string | null> {
    const patrones = [
      /(?:perfil\s+de|análisis\s+de|analisis\s+de|como\s+va|cómo\s+va|ventas\s+de|rendimiento\s+de|información\s+de)\s+([a-záéíóúüñ\s]{3,30})/i,
      /(?:dame\s+el\s+perfil\s+de|dime\s+como\s+va|dime\s+cómo\s+va)\s+([a-záéíóúüñ\s]{3,30})/i,
    ];
    for (const patron of patrones) {
      const match = p.match(patron);
      if (match) return match[1].trim();
    }
    return null;
  }

  private limpiarDatosParaIA(datos: any): any {
    if (Array.isArray(datos))
      return datos.map((item) => this.limpiarDatosParaIA(item));
    if (datos && typeof datos === 'object') {
      const limpio: any = {};
      for (const key of Object.keys(datos)) {
        const val = datos[key];
        if (val?.seconds !== undefined)
          limpio[key] = new Date(val.seconds * 1000).toLocaleString('es-CO');
        else limpio[key] = this.limpiarDatosParaIA(val);
      }
      return limpio;
    }
    return datos;
  }

  private async enviarConRetry(
    fn: () => Promise<any>,
    intentos = 3,
    espera = 3000,
  ): Promise<any> {
    for (let i = 0; i < intentos; i++) {
      try {
        return await fn();
      } catch (error: any) {
        const esRetryable =
          error?.message?.includes('503') ||
          error?.message?.includes('429') ||
          error?.codigo === 'unavailable';
        if (esRetryable && i < intentos - 1) {
          await new Promise((res) => setTimeout(res, espera * (i + 1)));
          continue;
        }
        throw error;
      }
    }
  }

  private async resolverNombreVendedor(
    fragmento: string,
  ): Promise<string | null> {
    const [snapVentas, snapPrestamos] = await Promise.all([
      getDocs(
        query(
          collection(this.firestore, 'ventas'),
          orderBy('fechaVenta', 'desc'),
          limit(300),
        ),
      ),
      getDocs(collection(this.firestore, 'prestamos')),
    ]);
    const vendedores = new Set<string>();
    for (const doc of snapVentas.docs) {
      const v = doc.data()['vendedor'];
      if (v) vendedores.add(v);
    }
    for (const doc of snapPrestamos.docs) {
      const v = doc.data()['vendedor'];
      if (v) vendedores.add(v);
    }
    const frag = fragmento.toLowerCase().trim();
    for (const nombre of vendedores) {
      if (nombre.toLowerCase() === frag) return nombre;
    }
    for (const nombre of vendedores) {
      if (nombre.toLowerCase().startsWith(frag)) return nombre;
    }
    for (const nombre of vendedores) {
      if (nombre.toLowerCase().includes(frag)) return nombre;
    }
    for (const nombre of vendedores) {
      const palabras = nombre.toLowerCase().split(/\s+/);
      if (palabras.some((p) => p.startsWith(frag) || frag.startsWith(p)))
        return nombre;
    }
    return null;
  }

  private detectarRangoCodigos(
    p: string,
  ): { desde: number; hasta?: number } | null {
    const matchRango = p.match(
      /del\s+(?:código\s+|codigo\s+)?(\d+)\s+al\s+(\d+)/,
    );
    if (matchRango)
      return { desde: parseInt(matchRango[1]), hasta: parseInt(matchRango[2]) };
    const matchDesde = p.match(
      /del\s+(?:código\s+|codigo\s+)?(\d+)\s+al\s+(?:último|ultimo)/,
    );
    if (matchDesde) return { desde: parseInt(matchDesde[1]) };
    const matchDesde2 = p.match(
      /desde\s+(?:el\s+)?(?:código\s+|codigo\s+)?(\d+)/,
    );
    if (matchDesde2) return { desde: parseInt(matchDesde2[1]) };
    const matchAdelante = p.match(/(?:código|codigo)\s+(\d+)\s+en\s+adelante/);
    if (matchAdelante) return { desde: parseInt(matchAdelante[1]) };
    return null;
  }

  private detectarConsultaExhibicion(
    p: string,
  ): { codigo: string; local: string; cantidad: number } | null {
    if (!p.includes('exhibicion') && !p.includes('exhibición')) return null;
    const cantidadMatch = p.match(
      /(?:últimas?|ultimas?)\s+(\d+)|(\d+)\s+exhibicion/,
    );
    const cantidad = cantidadMatch
      ? parseInt(cantidadMatch[1] || cantidadMatch[2])
      : 5;
    const codigoMatch = p.match(
      /(?:código|codigo|cod\.?)\s*(\d+)|(?:del|de)\s+(\d+)/,
    );
    if (!codigoMatch) return null;
    const codigo = codigoMatch[1] || codigoMatch[2];
    const localMatch = p.match(/(?:local|loc\.?)\s*0*(\d+)/);
    if (!localMatch) return null;
    return {
      codigo,
      local: localMatch[1],
      cantidad: isNaN(cantidad) ? 5 : cantidad,
    };
  }

  private detectarCodigoEnPregunta(
    p: string,
    palabrasClave: string[],
  ): number | null {
    if (!palabrasClave.some((pk) => p.includes(pk))) return null;
    const match = p.match(/\b(\d{2,5})\b/);
    return match ? parseInt(match[1]) : null;
  }

  private agruparPor(array: any[], campo: string): Record<string, number> {
    return array.reduce(
      (acc, item) => {
        const key = item[campo] || 'Sin especificar';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  private agruparPorConIngresos(
    array: any[],
    campo: string,
  ): Record<string, { ventas: number; ingresos: number }> {
    return array.reduce(
      (acc, item) => {
        const key = item[campo] || 'Sin especificar';
        if (!acc[key]) acc[key] = { ventas: 0, ingresos: 0 };
        acc[key].ventas += 1;
        acc[key].ingresos += item['precio'] || 0;
        return acc;
      },
      {} as Record<string, { ventas: number; ingresos: number }>,
    );
  }

  private mapearVenta(v: any): any {
    return {
      id: v['id'] ?? '',
      zapatoId: v['zapatoId'],
      marca: v['marca'] ?? '',
      referencia: v['referencia'] ?? '',
      talla: v['talla'] ?? '',
      precio: Number(v['precio'] || 0),
      local: v['local'] ?? '',
      metodoPago: v['metodoPago'] ?? '',
      precioMetodoPrincipal: v['precioMetodoPrincipal'],
      segundoMetodo: v['segundoMetodo'],
      fechaVenta: v['fechaVenta'],
      tipoVenta: v['tipoVenta'] ?? '',
      vendedor: v['vendedor'] ?? '',
      precioBajo: v['precioBajo'] ?? false,
      excedente: v['excedente'],
      metodoExcedente: v['metodoExcedente'],
      esMismoDia: v['esMismoDia'],
      vendedorId: v['vendedorId'],
    };
  }

  async obtenerPrestamosOrdenadosPorFecha(): Promise<any> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const snapshot = await getDocs(collection(this.firestore, 'prestamos'));
      const todos = snapshot.docs.map((d) => d.data());

      const ahora = Date.now();

      const conFecha = todos
        .filter((p: any) => p['fechaPrestamo']?.seconds)
        .map((p: any) => {
          const fechaMs = p['fechaPrestamo'].seconds * 1000;
          const diasTranscurridos = Math.floor(
            (ahora - fechaMs) / (1000 * 60 * 60 * 24),
          );
          return {
            zapatoId: p['zapatoId'],
            vendedor: p['vendedor'] ?? 'Sin especificar',
            marca: p['marca'] ?? '',
            referencia: p['referencia'] ?? '',
            talla: p['talla'] ?? '',
            local: p['localPrestado'] ?? p['local'] ?? '',
            precio: p['precio'] ?? null,
            fecha: new Date(fechaMs).toLocaleDateString('es-CO', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }),
            diasTranscurridos,
            antiguedad:
              diasTranscurridos === 0
                ? 'Hoy'
                : diasTranscurridos === 1
                  ? 'Ayer'
                  : `Hace ${diasTranscurridos} días`,
          };
        })
        .sort((a, b) => b.diasTranscurridos - a.diasTranscurridos);

      const sinFecha = todos
        .filter((p: any) => !p['fechaPrestamo']?.seconds)
        .map((p: any) => ({
          zapatoId: p['zapatoId'],
          vendedor: p['vendedor'] ?? 'Sin especificar',
          marca: p['marca'] ?? '',
          referencia: p['referencia'] ?? '',
          talla: p['talla'] ?? '',
          local: p['localPrestado'] ?? p['local'] ?? '',
          precio: p['precio'] ?? null,
          fecha: 'Sin fecha registrada',
          diasTranscurridos: null,
          antiguedad: 'Fecha desconocida',
        }));

      return {
        total: todos.length,
        conFecha: conFecha.length,
        sinFecha: sinFecha.length,
        prestamosOrdenados: [...conFecha, ...sinFecha],
        top10MasViejos: conFecha.slice(0, 10),
        resumenPorVendedor: conFecha.reduce(
          (
            acc: Record<
              string,
              { total: number; diasPromedio: number; masViejo: number }
            >,
            p,
          ) => {
            if (!acc[p.vendedor])
              acc[p.vendedor] = { total: 0, diasPromedio: 0, masViejo: 0 };
            acc[p.vendedor].total += 1;
            acc[p.vendedor].diasPromedio += p.diasTranscurridos;
            if (p.diasTranscurridos > acc[p.vendedor].masViejo)
              acc[p.vendedor].masViejo = p.diasTranscurridos;
            return acc;
          },
          {},
        ),
      };
    });
  }

  async obtenerProductosPorRangoStock(
    stockMin: number,
    stockMax: number,
    top: number = 30,
  ): Promise<any[]> {
    return runInInjectionContext(this.injector, async () => {
      await this.esperarAuth();
      const q = query(
        collection(this.firestore, 'productos'),
        where('stock', '>=', stockMin),
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map((d) => {
          const p = d.data();
          return {
            zapatoId: p['id'],
            marca: p['marca'] ?? '',
            referencia: p['referencia'] ?? '',
            talla: p['talla'] ?? '',
            stock: p['stock'] ?? 0,
            precioMin: p['precioMin'] ?? null,
          };
        })
        .filter((p) => p.stock >= stockMin && p.stock <= stockMax)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, top);
    });
  }

  obtenerSugerencias(): string[] {
    return [
      '¿que referencia recomiendas volver a comprar?',
      '¿que promociones puedo sacar?',
      '¿Cómo van las ventas de hoy?',
      '¿Es rentable el negocio este mes?',
      '¿Cuáles son las finanzas de este mes?',
      '¿Qué gastos puedo reducir?',
      '¿Estoy en riesgo de quiebra?',
      'prestamos mas viejos',
    ];
  }
}
function esVentaValidaParaIngresos(v: any): boolean {
  const tipo: string = (v['tipoVenta'] ?? '').toLowerCase().trim();
  if (tipo === 'devuelto por bono') return false;
  if (tipo === 'devuelto por cambio') return false;
  return true;
}
function esVentaValidaParaFinanzas(v: any): boolean {
  const tipo: string = (v['tipoVenta'] ?? '').toLowerCase().trim();
  if (tipo === 'devuelto por bono') return false;
  if (tipo === 'devuelto por cambio') return false;

  return true;
}

function calcularMontoVenta(v: any): number {
  const tipo = (v['tipoVenta'] ?? '').toLowerCase().trim();
  if (tipo === 'cambio' && v['esMismoDia'] === false)
    return Number(v['excedente'] || 0);
  if (tipo === 'bono') return Number(v['excedente'] || 0);
  if (tipo === 'cambio' && v['esMismoDia'] === true)
    return Number(v['precio'] || 0);
  return Number(v['precio'] || 0);
}
