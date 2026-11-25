import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Injector,
  OnInit,
  inject,
  runInInjectionContext,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, doc, getDocs, query, setDoc, where } from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';

import { Venta } from '../../interfaces';
import { SalesService } from '../../../services/vendedorServices/ventas/sales.service';
import { AuthService } from '../../../services/auth/auth.service';
import { IaGatewayService } from '../../../services/administracion/ia/ia-gateway.service';
import {
  CajaVendedor,
  cajaDeVenta,
  calcularCajaPorVendedor,
} from '../../../services/vendedorServices/ventas/caja-calculo';
import { esDevueltaPorCambioConCaja } from '../../../services/vendedorServices/ventas/caja-devuelta.util';
import {
  EntregaCaja,
  EntregasCajaService,
  claveCajaVendedor,
} from '../../../services/caja/entregas-caja.service';

interface Hallazgo {
  tipo: 'cambio-otro-dia' | 'anulada-sin-dato' | 'coincidencia' | 'info';
  texto: string;
  monto?: number;
}

interface FilaCuadre {
  caja: CajaVendedor;
  clave: string;
  recogidoTexto: string;
  observacion: string;
  hallazgos: Hallazgo[];
  explicacion: string;
  explicando: boolean;
  guardando: boolean;
  guardado: boolean;
  error: string;
  /** Entregas que registró el recolector para este vendedor (incluye anuladas). */
  entregas: EntregaCaja[];
  /** Suma de las entregas vigentes (no anuladas). */
  recolectado: number;
  /** El campo "recogido" se llenó solo con lo que registró el recolector. */
  desdeRecolector: boolean;
}

const fmt = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

@Component({
  selector: 'app-cuadre-caja',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-neutral-50 dark:bg-black">
      <div class="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-6">
        <header class="flex flex-col gap-1.5">
          <h1 class="text-2xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Cuadre de caja
          </h1>
          <p class="text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
            Compara el efectivo que debería tener cada vendedor con lo que recogiste. Si hay
            diferencia, el sistema revisa las ventas del día y la IA te explica qué pudo pasar.
          </p>
        </header>

        <!-- Fecha -->
        <section
          class="rounded-2xl p-4 sm:p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800"
        >
          <div class="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
            <div class="flex flex-col gap-1.5 w-full sm:w-60">
              <label for="cc-fecha" class="text-xs font-semibold text-neutral-700 dark:text-neutral-300"
                >Fecha</label
              >
              <input
                id="cc-fecha"
                type="date"
                [(ngModel)]="fecha"
                (ngModelChange)="cargar()"
                class="cc-input"
              />
            </div>

            <div class="grid grid-cols-2 sm:flex gap-2">
              <button type="button" class="cc-chip" (click)="rapido('hoy')">Hoy</button>
              <button type="button" class="cc-chip" (click)="rapido('ayer')">Ayer</button>
            </div>

            <button
              type="button"
              (click)="cargar()"
              [disabled]="cargando"
              class="w-full sm:w-auto sm:ml-auto px-6 py-3 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-black text-sm font-semibold hover:bg-neutral-700 dark:hover:bg-neutral-200 disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {{ cargando ? 'Calculando…' : 'Calcular' }}
            </button>
          </div>
          <p *ngIf="errorGeneral" class="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {{ errorGeneral }}
          </p>
        </section>

        <!-- Totales -->
        <section *ngIf="calculado" class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <div class="cc-kpi">
            <p class="cc-kpi-l">Efectivo esperado</p>
            <p class="cc-kpi-v">{{ money(totalEsperado) }}</p>
          </div>
          <div class="cc-kpi">
            <p class="cc-kpi-l">Recogido</p>
            <p class="cc-kpi-v">{{ money(totalRecogido) }}</p>
          </div>
          <div class="cc-kpi col-span-2 lg:col-span-1 order-last lg:order-none">
            <p class="cc-kpi-l">Diferencia total</p>
            <p
              class="cc-kpi-v"
              [ngClass]="
                totalDiferencia === 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              "
            >
              {{ signo(totalDiferencia) }}
            </p>
          </div>
          <div class="cc-kpi">
            <p class="cc-kpi-l">Vendedores</p>
            <p class="cc-kpi-v">{{ filas.length }}</p>
          </div>
        </section>

        <p
          *ngIf="calculado && entregasSinFila"
          class="rounded-xl p-3 text-sm bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900"
          role="alert"
        >
          {{ entregasSinFila }}
        </p>

        <!-- Vendedores -->
        <section *ngIf="calculado && filas.length === 0" class="rounded-2xl p-6 sm:p-10 text-center bg-white dark:bg-neutral-950 border border-dashed border-neutral-300 dark:border-neutral-800">
          <p class="text-sm font-semibold text-neutral-900 dark:text-white">No hay ventas ni cambios de vendedores activos este día</p>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Cambia la fecha y vuelve a calcular.</p>
        </section>

        <section class="space-y-4">
          <article
            *ngFor="let f of filas; trackBy: trackFila"
            class="rounded-2xl p-4 sm:p-5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800"
          >
            <div class="flex flex-col-reverse sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
              <div class="min-w-0">
                <h2 class="text-lg font-semibold text-neutral-900 dark:text-white break-words">
                  {{ f.caja.vendedor }}
                </h2>
                <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {{ f.caja.unidades }} {{ f.caja.unidades === 1 ? 'par vendido' : 'pares vendidos' }}
                </p>
              </div>
              <span
                class="self-start text-xs font-semibold px-3 py-1.5 rounded-lg"
                [ngClass]="estadoClase(f)"
                >{{ estadoTexto(f) }}</span
              >
            </div>

            <div class="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-4 lg:gap-4 lg:items-end">
              <div class="order-1 min-w-0">
                <p class="text-xs text-neutral-500 dark:text-neutral-400">Efectivo esperado</p>
                <p class="mt-1 text-xl sm:text-2xl font-bold tabular-nums break-words text-neutral-900 dark:text-white">
                  {{ money(f.caja.efectivo) }}
                </p>
                <p class="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">
                  Otros métodos: {{ money(f.caja.transferencia + f.caja.sistecredito + f.caja.addi + f.caja.bold) }}
                </p>
              </div>

              <div class="order-3 col-span-2 lg:col-span-1 lg:order-2 flex flex-col gap-1.5">
                <label [for]="'rec-' + f.clave" class="text-xs font-semibold text-neutral-700 dark:text-neutral-300"
                  >Efectivo recogido</label
                >
                <input
                  [id]="'rec-' + f.clave"
                  type="text"
                  inputmode="numeric"
                  placeholder="Ej: 1.520.000"
                  [(ngModel)]="f.recogidoTexto"
                  (ngModelChange)="onRecogido(f)"
                  class="cc-input"
                />
              </div>

              <div class="order-2 lg:order-3 min-w-0">
                <p class="text-xs text-neutral-500 dark:text-neutral-400">Diferencia</p>
                <p
                  class="mt-1 text-xl sm:text-2xl font-bold tabular-nums break-words"
                  [ngClass]="
                    f.recogidoTexto === ''
                      ? 'text-neutral-300 dark:text-neutral-700'
                      : diferencia(f) === 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                  "
                >
                  {{ f.recogidoTexto === '' ? '—' : signo(diferencia(f)) }}
                </p>
              </div>

              <div class="order-4 col-span-2 lg:col-span-1 flex flex-col gap-1.5">
                <label [for]="'obs-' + f.clave" class="text-xs font-semibold text-neutral-700 dark:text-neutral-300"
                  >Observación</label
                >
                <input
                  [id]="'obs-' + f.clave"
                  type="text"
                  placeholder="Opcional"
                  [(ngModel)]="f.observacion"
                  class="cc-input"
                />
              </div>
            </div>

            <!-- Entregas registradas por el recolector -->
            <div
              *ngIf="f.entregas.length"
              class="mt-4 rounded-xl p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
            >
              <div class="flex flex-wrap items-baseline justify-between gap-2">
                <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">
                  Entregas registradas por el recolector
                </h3>
                <p class="text-sm font-bold tabular-nums text-neutral-900 dark:text-white">
                  {{ money(f.recolectado) }}
                </p>
              </div>
              <ul class="mt-2 space-y-1.5">
                <li
                  *ngFor="let e of f.entregas"
                  class="text-sm flex items-start justify-between gap-3 text-neutral-700 dark:text-neutral-300"
                  [class.opacity-50]="e.anulada"
                >
                  <span class="min-w-0 break-words">
                    {{ e.creadoEn | date: 'dd/MM h:mm a' }} · {{ e.recolector }}
                    <span *ngIf="e.nota"> · {{ e.nota }}</span>
                    <span *ngIf="e.editadoEn" class="text-amber-600 dark:text-amber-400">
                      · corregido (antes {{ historialTexto(e) }})</span
                    >
                    <span *ngIf="e.anulada" class="font-semibold"> · ANULADA</span>
                  </span>
                  <span class="tabular-nums font-semibold shrink-0" [class.line-through]="e.anulada">{{
                    money(e.monto)
                  }}</span>
                </li>
              </ul>
              <p
                *ngIf="f.recogidoTexto !== '' && numero(f.recogidoTexto) !== f.recolectado"
                class="mt-2 text-xs text-amber-700 dark:text-amber-400"
              >
                El recogido que ves ({{ money(numero(f.recogidoTexto)) }}) es distinto de lo que
                registró el recolector ({{ money(f.recolectado) }}).
              </p>
            </div>

            <!-- Hallazgos -->
            <div *ngIf="f.recogidoTexto !== '' && diferencia(f) !== 0" class="mt-5 space-y-3">
              <div
                class="rounded-xl p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
              >
                <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">
                  Qué encontró el sistema
                </h3>
                <ul class="mt-2 space-y-1.5">
                  <li
                    *ngFor="let h of f.hallazgos"
                    class="text-sm text-neutral-700 dark:text-neutral-300 flex gap-2"
                  >
                    <span
                      class="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                      [ngClass]="h.tipo === 'coincidencia' ? 'bg-amber-500' : h.tipo === 'info' ? 'bg-neutral-400' : 'bg-blue-500'"
                    ></span>
                    <span>{{ h.texto }}</span>
                  </li>
                </ul>
              </div>

              <div class="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  (click)="explicar(f)"
                  [disabled]="f.explicando"
                  class="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-sm font-semibold text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 disabled:opacity-50 transition-colors"
                >
                  {{ f.explicando ? 'Analizando…' : f.explicacion ? 'Explicar de nuevo con IA' : 'Explicar con IA' }}
                </button>
              </div>

              <div
                *ngIf="f.explicacion"
                class="rounded-xl p-4 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950"
              >
                <p class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5">
                  Explicación de la IA
                </p>
                <p class="text-sm text-neutral-800 dark:text-neutral-200 whitespace-pre-line leading-relaxed">
                  {{ f.explicacion }}
                </p>
              </div>
            </div>

            <div class="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                type="button"
                (click)="guardar(f)"
                [disabled]="f.guardando || f.recogidoTexto === ''"
                class="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-black text-sm font-semibold hover:bg-neutral-700 dark:hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
              >
                {{ f.guardando ? 'Guardando…' : f.guardado ? 'Guardado' : 'Guardar cuadre' }}
              </button>
              <span *ngIf="f.error" class="text-sm text-red-600 dark:text-red-400" role="alert">{{ f.error }}</span>
            </div>
          </article>
        </section>
      </div>
    </div>
  `,
  styles: [
    `
      .cc-input {
        width: 100%;
        border-radius: 12px;
        padding: 10px 14px;
        font-size: 16px;
        background: #fff;
        border: 1px solid #e5e5e5;
        color: #171717;
        outline: none;
      }
      .cc-input:focus {
        border-color: #737373;
        box-shadow: 0 0 0 2px rgba(115, 115, 115, 0.35);
      }
      @media (prefers-color-scheme: dark) {
        .cc-input {
        background: rgba(255, 255, 255, 0.04);
        border-color: #262626;
        color: #fff;
      }
      }
      .cc-chip {
        padding: 9px 14px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 600;
        border: 1px solid #e5e5e5;
        background: #fff;
        color: #404040;
      }
      .cc-chip:hover {
        border-color: #171717;
      }
      @media (prefers-color-scheme: dark) {
        .cc-chip {
        background: #0a0a0a;
        border-color: #262626;
        color: #d4d4d4;
      }
      }
      @media (prefers-color-scheme: dark) {
        .cc-chip:hover {
        border-color: #a3a3a3;
      }
      }
      .cc-kpi {
        min-width: 0;
        border-radius: 16px;
        padding: 14px;
        background: #fff;
        border: 1px solid #e5e5e5;
      }
      @media (prefers-color-scheme: dark) {
        .cc-kpi {
        background: #0a0a0a;
        border-color: #262626;
      }
      }
      .cc-kpi-l {
        font-size: 12px;
        color: #737373;
        font-weight: 500;
      }
      .cc-kpi-v {
        margin-top: 4px;
        font-size: clamp(17px, 5vw, 24px);
        overflow-wrap: anywhere;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: #171717;
      }
      @media (prefers-color-scheme: dark) {
        .cc-kpi-v {
        color: #fff;
      }
      }
    `,
  ],
})
export class CuadreCajaComponent implements OnInit {
  private sales = inject(SalesService);
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private auth = inject(AuthService);
  private gateway = inject(IaGatewayService);
  private entregasSrv = inject(EntregasCajaService);
  private cdr = inject(ChangeDetectorRef);

  /** Día a cuadrar (YYYY-MM-DD). Se usa como desde = hasta para seguir compatible con lo ya guardado. */
  fecha = '';
  get desde(): string {
    return this.fecha;
  }
  get hasta(): string {
    return this.fecha;
  }
  cargando = false;
  calculado = false;
  errorGeneral = '';
  entregasSinFila = '';

  filas: FilaCuadre[] = [];
  private ventas: Venta[] = [];

  ngOnInit(): void {
    this.rapido('hoy', false);
  }

  trackFila = (_: number, f: FilaCuadre) => f.clave;
  money = (n: number) => fmt.format(Math.round(n || 0));

  private ymd(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  private parse(ymd: string, fin: boolean): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (fin) d.setHours(23, 59, 59, 999);
    else d.setHours(0, 0, 0, 0);
    return d;
  }

  rapido(tipo: 'hoy' | 'ayer', calcular = true): void {
    const d = new Date();
    if (tipo === 'ayer') d.setDate(d.getDate() - 1);
    this.fecha = this.ymd(d);
    if (calcular) void this.cargar();
    else this.cdr.markForCheck();
  }

  async cargar(): Promise<void> {
    const ini = this.parse(this.fecha, false);
    const fin = this.parse(this.fecha, true);
    this.errorGeneral = '';
    if (!ini || !fin) {
      this.errorGeneral = 'Elige una fecha válida.';
      this.cdr.markForCheck();
      return;
    }

    this.cargando = true;
    this.cdr.markForCheck();
    try {
      this.ventas = await firstValueFrom(this.sales.getVentasPorSemana$(ini, fin));
      // Solo vendedores habilitados (activos) con al menos 1 venta o 1 cambio en el día.
      const habilitados = await this.leerHabilitados();
      const conCaja = new Map(
        calcularCajaPorVendedor(this.ventas).map((c) => [this.claveVendedor(c), c] as const),
      );
      const cajas: CajaVendedor[] = [];
      const vistos = new Set<string>();
      for (const v of this.ventas) {
        if (!this.esVentaOCambio(v)) continue;
        const clave = claveCajaVendedor((v.vendedorId || v.vendedor || 'sin-vendedor').toString());
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        if (habilitados && !this.estaHabilitado(v, habilitados)) continue;
        cajas.push(
          conCaja.get(clave) ?? {
            vendedor: v.vendedor || 'Sin vendedor',
            vendedorId: v.vendedorId,
            efectivo: 0,
            transferencia: 0,
            sistecredito: 0,
            addi: 0,
            bold: 0,
            total: 0,
            unidades: 0,
            registros: 0,
          },
        );
      }
      cajas.sort((x, y) => x.vendedor.localeCompare(y.vendedor, 'es', { sensitivity: 'base' }));

      const guardados = await this.leerGuardados();
      const entregas = await this.leerEntregas();
      const claves = new Set(cajas.map((c) => this.claveVendedor(c)));
      this.entregasSinFila = this.avisoEntregasSinFila(entregas, claves);

      this.filas = cajas.map((caja) => {
        const clave = this.claveVendedor(caja);
        const g = guardados.get(clave);
        const suyas = entregas.filter((e) => this.claveEntrega(e, new Set([clave])) === clave);
        const recolectado = suyas.filter((e) => !e.anulada).reduce((a, e) => a + e.monto, 0);
        const prellenar = !g && suyas.some((e) => !e.anulada);
        return {
          caja,
          clave,
          entregas: suyas,
          recolectado,
          desdeRecolector: prellenar,
          recogidoTexto: g
            ? this.formatear(g['recogido'])
            : prellenar
              ? this.formatear(recolectado)
              : '',
          observacion: g?.['observacion'] ?? '',
          hallazgos: [],
          explicacion: g?.['explicacionIA'] ?? '',
          explicando: false,
          guardando: false,
          guardado: !!g,
          error: '',
        } as FilaCuadre;
      });
      this.filas.forEach((f) => this.recalcular(f));
      this.calculado = true;
    } catch (e: any) {
      console.error('[Cuadre] error', e);
      this.errorGeneral = 'No se pudieron cargar las ventas. Intenta de nuevo.';
    } finally {
      this.cargando = false;
      this.cdr.markForCheck();
    }
  }

  /** Venta o cambio (no cuenta las ventas anuladas por devolución). */
  private esVentaOCambio(v: Venta): boolean {
    const tipo = (v.tipoVenta || '').trim().toLowerCase();
    return !(v.DevueltoBono === true || tipo === 'devuelto por bono' || tipo === 'devuelto por cambio');
  }

  /** Ids y nombres de vendedores activos; null si no se pudo leer (entonces no se filtra). */
  private async leerHabilitados(): Promise<{ ids: Set<string>; nombres: Set<string> } | null> {
    try {
      const snap = await runInInjectionContext(this.injector, () =>
        getDocs(query(collection(this.firestore, 'usuarios'), where('role', '==', 'vendedor'))),
      );
      const ids = new Set<string>();
      const nombres = new Set<string>();
      snap.forEach((d) => {
        const u = d.data();
        if (u['active']?.value !== true) return;
        ids.add(d.id);
        nombres.add(claveCajaVendedor(String(u['name'] ?? '')));
      });
      return { ids, nombres };
    } catch (e) {
      console.warn('[Cuadre] no se pudo leer la lista de vendedores habilitados', e);
      return null;
    }
  }

  private estaHabilitado(v: Venta, h: { ids: Set<string>; nombres: Set<string> }): boolean {
    return v.vendedorId
      ? h.ids.has(String(v.vendedorId))
      : h.nombres.has(claveCajaVendedor(v.vendedor || ''));
  }

  /** Avisa si hay dinero entregado de vendedores que no aparecen en la lista. */
  private avisoEntregasSinFila(entregas: EntregaCaja[], claves: Set<string>): string {
    const sueltas = entregas.filter((e) => !e.anulada && this.claveEntrega(e, claves) && !claves.has(this.claveEntrega(e, claves)));
    if (!sueltas.length) return '';
    const total = sueltas.reduce((a, e) => a + e.monto, 0);
    const nombres = [...new Set(sueltas.map((e) => e.vendedor))].join(', ');
    return `Hay ${this.money(total)} entregados por vendedores que no aparecen aquí (sin ventas o cambios en el día, o inactivos): ${nombres}.`;
  }

  private claveVendedor(c: CajaVendedor): string {
    return claveCajaVendedor((c.vendedorId || c.vendedor).toString());
  }

  /**
   * Une una entrega con la clave del vendedor. Normalmente coincide por id; si las ventas no
   * traían id (se agrupan por nombre) se intenta también por el nombre.
   */
  private claveEntrega(e: EntregaCaja, claves: Set<string>): string {
    if (claves.has(e.clave)) return e.clave;
    const porNombre = claveCajaVendedor(e.vendedor);
    return claves.has(porNombre) ? porNombre : e.clave;
  }

  private async leerEntregas(): Promise<EntregaCaja[]> {
    try {
      return await this.entregasSrv.delRango(this.desde, this.hasta);
    } catch (e) {
      console.warn('[Cuadre] no se pudieron leer las entregas del recolector', e);
      return [];
    }
  }

  historialTexto(e: EntregaCaja): string {
    const h = e.historial ?? [];
    return h.length ? this.money(h[0].monto) : '';
  }

  private idDoc(clave: string): string {
    return `${this.desde}_${this.hasta}_${clave}`;
  }

  private async leerGuardados(): Promise<Map<string, Record<string, any>>> {
    const mapa = new Map<string, Record<string, any>>();
    try {
      const snap = await runInInjectionContext(this.injector, () =>
        getDocs(
          query(
            collection(this.firestore, 'cuadresCaja'),
            where('desde', '==', this.desde),
            where('hasta', '==', this.hasta),
          ),
        ),
      );
      snap.forEach((d) => mapa.set(String(d.data()['clave']), d.data()));
    } catch (e) {
      console.warn('[Cuadre] no se pudieron leer cuadres guardados', e);
    }
    return mapa;
  }

  // ── Números ────────────────────────────────────────────────

  numero(texto: string): number {
    const digitos = (texto || '').replace(/[^\d]/g, '');
    return digitos ? Number(digitos) : 0;
  }

  private formatear(n: any): string {
    const v = Number(n);
    return Number.isFinite(v) && v !== 0 ? v.toLocaleString('es-CO') : v === 0 ? '0' : '';
  }

  onRecogido(f: FilaCuadre): void {
    const digitos = f.recogidoTexto.replace(/[^\d]/g, '');
    f.recogidoTexto = digitos ? Number(digitos).toLocaleString('es-CO') : '';
    f.guardado = false;
    f.desdeRecolector = false;
    f.explicacion = '';
    this.recalcular(f);
    this.cdr.markForCheck();
  }

  diferencia(f: FilaCuadre): number {
    return this.numero(f.recogidoTexto) - f.caja.efectivo;
  }

  signo(n: number): string {
    if (n === 0) return 'Cuadra ✓';
    return `${n > 0 ? 'Sobra ' : 'Falta '}${this.money(Math.abs(n))}`;
  }

  estadoTexto(f: FilaCuadre): string {
    if (f.recogidoTexto === '') return 'Sin cuadrar';
    if (f.desdeRecolector && !f.guardado) return `${this.signo(this.diferencia(f))} · del recolector`;
    return f.guardado ? `${this.signo(this.diferencia(f))} · guardado` : this.signo(this.diferencia(f));
  }

  estadoClase(f: FilaCuadre): string {
    if (f.recogidoTexto === '')
      return 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400';
    return this.diferencia(f) === 0
      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
      : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400';
  }

  get totalEsperado(): number {
    return this.filas.reduce((a, f) => a + f.caja.efectivo, 0);
  }
  get totalRecogido(): number {
    return this.filas.reduce((a, f) => a + this.numero(f.recogidoTexto), 0);
  }
  get totalDiferencia(): number {
    const conDato = this.filas.filter((f) => f.recogidoTexto !== '');
    return conDato.reduce((a, f) => a + this.diferencia(f), 0);
  }

  // ── Diagnóstico (reglas exactas, sin IA) ───────────────────

  private recalcular(f: FilaCuadre): void {
    f.hallazgos = f.recogidoTexto === '' ? [] : this.diagnosticar(f);
  }

  private descripcion(v: Venta): string {
    const prod = [v.marca, v.referencia].filter(Boolean).join(' ');
    return `${prod || 'producto'}${v.talla ? ' talla ' + v.talla : ''}`;
  }

  private mismoVendedor(v: Venta, c: CajaVendedor): boolean {
    return c.vendedorId
      ? v.vendedorId === c.vendedorId
      : (v.vendedor || '').trim().toLowerCase() === c.vendedor.trim().toLowerCase();
  }

  private diagnosticar(f: FilaCuadre): Hallazgo[] {
    const dif = this.diferencia(f);
    const hallazgos: Hallazgo[] = [];
    if (dif === 0) return hallazgos;

    const suyas = this.ventas.filter((v) => this.mismoVendedor(v, f.caja));
    const porId = new Map<string, Venta>();
    this.ventas.forEach((v) => porId.set(String(v.id), v));

    // 1) Cambios de pares vendidos en otro día
    for (const v of suyas) {
      const tipo = (v.tipoVenta || '').trim().toLowerCase();
      if (tipo === 'cambio' && !v.esMismoDia) {
        const original = v.productoDevueltoId ? porId.get(String(v.productoDevueltoId)) : undefined;
        hallazgos.push({
          tipo: 'cambio-otro-dia',
          monto: Number(v.precioBono || 0),
          texto: original
            ? `Cambio de ${this.descripcion(v)} (par vendido antes, ese mismo día): del cambio solo entraron ${this.money(Number(v.excedente || 0))} de excedente. El valor del par original (${this.money(Number(v.precioBono || 0))}) ya estaba cobrado en su venta.`
            : `Cambio de ${this.descripcion(v)} (par vendido ANTES de este día): solo entraron ${this.money(Number(v.excedente || 0))} de excedente. Los ${this.money(Number(v.precioBono || 0))} del par original se cobraron en un día anterior.`,
        });
      }
    }

    // 2) Ventas anuladas por cambio que no guardaron el dinero original (datos antiguos)
    for (const v of suyas) {
      const tipo = (v.tipoVenta || '').trim().toLowerCase();
      if (tipo === 'devuelto por cambio' && !esDevueltaPorCambioConCaja(v)) {
        const cambio = suyas.find(
          (c) => String(c.productoDevueltoId) === String(v.id) && !c.esMismoDia && c.tipoVenta?.toLowerCase() === 'cambio',
        );
        if (cambio) {
          const monto = Number(cambio.precioBono || 0);
          hallazgos.push({
            tipo: 'anulada-sin-dato',
            monto,
            texto: `La venta de ${this.descripcion(v)} fue anulada por un cambio de otro día y NO tiene guardado su dinero original: en el sistema faltarían ${this.money(monto)} que el vendedor sí recibió. Ejecuta la corrección de cambios pasados para arreglarlo.`,
          });
        }
      }
    }

    // 3) ¿La diferencia coincide exactamente con alguna venta o hallazgo?
    const abs = Math.abs(dif);
    const candidatos: { monto: number; texto: string }[] = [];
    for (const v of suyas) {
      const efectivo = cajaDeVenta(v).efectivo;
      if (efectivo > 0) candidatos.push({ monto: efectivo, texto: `la venta de ${this.descripcion(v)} (${this.money(efectivo)} en efectivo)` });
    }
    hallazgos.forEach((h) => {
      if (h.monto) candidatos.push({ monto: h.monto, texto: 'el valor de un par cambiado' });
    });
    const coincide = candidatos.find((c) => c.monto === abs);
    if (coincide) {
      hallazgos.unshift({
        tipo: 'coincidencia',
        monto: abs,
        texto: `La diferencia de ${this.money(abs)} es exactamente ${coincide.texto}. Es la causa más probable.`,
      });
    }

    if (!hallazgos.length) {
      hallazgos.push({
        tipo: 'info',
        texto: `No hay cambios ni anulaciones este día que expliquen la diferencia de ${this.money(abs)}. Revisa: efectivo prestado o gastado por el vendedor, ventas de días anteriores sin recoger, o vuelve a contar el dinero.`,
      });
    }
    return hallazgos;
  }

  // ── IA ──────────────────────────────────────────────────────

  async explicar(f: FilaCuadre): Promise<void> {
    f.explicando = true;
    f.error = '';
    this.cdr.markForCheck();
    try {
      const dif = this.diferencia(f);
      const datos = {
        vendedor: f.caja.vendedor,
        fecha: this.fecha,
        efectivoEsperado: f.caja.efectivo,
        efectivoRecogido: this.numero(f.recogidoTexto),
        diferencia: dif,
        sentido: dif > 0 ? 'SOBRA dinero respecto a lo esperado' : 'FALTA dinero respecto a lo esperado',
        paresVendidos: f.caja.unidades,
        hallazgosDelSistema: f.hallazgos.map((h) => h.texto),
      };
      f.explicacion = await this.gateway.texto('cuadre', {
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          {
            role: 'system',
            content: `Eres el auditor de caja de ShoeShop, una tienda de calzado en Colombia.
Te dan el resultado del cuadre de efectivo de un vendedor y los hallazgos que el sistema calculó con reglas exactas.
Tu trabajo es EXPLICAR la diferencia al dueño en español claro y directo.

REGLAS:
- Usa ÚNICAMENTE las cifras y hechos que aparecen en los datos. No calcules cifras nuevas ni inventes causas.
- Si un hallazgo coincide exactamente con la diferencia, di que es la causa más probable.
- Si ningún hallazgo explica la diferencia, dilo con claridad y sugiere qué revisar.
- Termina con UNA acción concreta para hacer hoy.
- Máximo 6 líneas. Sin tablas ni listas largas. Montos con signo $ y puntos de miles.`,
          },
          { role: 'user', content: JSON.stringify(datos) },
        ],
      });
    } catch (e: any) {
      f.error = e?.message ?? 'No se pudo generar la explicación.';
    } finally {
      f.explicando = false;
      this.cdr.markForCheck();
    }
  }

  // ── Guardar ─────────────────────────────────────────────────

  async guardar(f: FilaCuadre): Promise<void> {
    if (f.recogidoTexto === '') return;
    f.guardando = true;
    f.error = '';
    this.cdr.markForCheck();
    try {
      const usuario = this.auth.getCurrentUser();
      const recogido = this.numero(f.recogidoTexto);
      await runInInjectionContext(this.injector, () =>
        setDoc(doc(this.firestore, 'cuadresCaja', this.idDoc(f.clave)), {
          clave: f.clave,
          desde: this.desde,
          hasta: this.hasta,
          vendedor: f.caja.vendedor,
          vendedorId: f.caja.vendedorId ?? null,
          esperado: {
            efectivo: f.caja.efectivo,
            transferencia: f.caja.transferencia,
            sistecredito: f.caja.sistecredito,
            addi: f.caja.addi,
            bold: f.caja.bold,
            unidades: f.caja.unidades,
          },
          recogido,
          diferencia: recogido - f.caja.efectivo,
          observacion: f.observacion.trim(),
          hallazgos: f.hallazgos.map((h) => h.texto),
          explicacionIA: f.explicacion || null,
          recolectado: f.recolectado,
          recolectores: [...new Set(f.entregas.filter((e) => !e.anulada).map((e) => e.recolector))],
          registradoPor: usuario?.name ?? null,
          registradoEn: new Date(),
        }),
      );
      f.guardado = true;
    } catch (e: any) {
      console.error('[Cuadre] error al guardar', e);
      f.error = 'No se pudo guardar el cuadre. Intenta de nuevo.';
    } finally {
      f.guardando = false;
      this.cdr.markForCheck();
    }
  }
}
