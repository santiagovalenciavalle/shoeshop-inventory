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
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';

import { AuthService } from '../../../services/auth/auth.service';
import {
  EntregaCaja,
  EntregasCajaService,
  fechaLocalYmd,
} from '../../../services/caja/entregas-caja.service';

interface FilaVendedor {
  id: string;
  nombre: string;
  montoTexto: string;
  nota: string;
  guardando: boolean;
  error: string;
}

const fmt = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/**
 * Pantalla del vendedor habilitado como recolector. A propósito NO consulta ventas ni cajas:
 * solo anota cuánto recibió de cada compañero. El cruce con lo esperado lo ve únicamente el admin.
 */
@Component({
  selector: 'app-recoger-caja',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-neutral-50 dark:bg-black">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <header class="flex flex-col gap-1.5">
          <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Recoger caja
          </h1>
          <p class="text-sm text-neutral-500 dark:text-neutral-400">
            Anota el efectivo que te entrega cada vendedor. Cuenta el dinero y escribe el valor
            exacto que recibiste.
          </p>
        </header>

        <section class="rc-card flex flex-col gap-1.5 max-w-xs">
          <label for="rc-fecha" class="text-xs font-semibold text-neutral-700 dark:text-neutral-300"
            >Fecha de la entrega</label
          >
          <input
            id="rc-fecha"
            type="date"
            [(ngModel)]="fecha"
            (ngModelChange)="cargarMisRegistros()"
            [max]="hoy"
            class="rc-input"
          />
        </section>

        <p *ngIf="errorGeneral" class="text-sm text-red-600 dark:text-red-400" role="alert">
          {{ errorGeneral }}
        </p>

        <section class="space-y-3">
          <h2 class="text-sm font-semibold text-neutral-900 dark:text-white">Vendedores</h2>
          <p *ngIf="!cargando && filas.length === 0" class="text-sm text-neutral-500">
            No hay vendedores activos.
          </p>
          <article *ngFor="let f of filas; trackBy: trackFila" class="rc-card">
            <p class="text-base font-semibold text-neutral-900 dark:text-white">{{ f.nombre }}</p>
            <div class="mt-3 grid grid-cols-1 sm:grid-cols-12 gap-3 sm:items-end">
              <div class="sm:col-span-5 flex flex-col gap-1.5">
                <label [for]="'rc-m-' + f.id" class="text-xs font-semibold text-neutral-700 dark:text-neutral-300"
                  >Efectivo recibido</label
                >
                <input
                  [id]="'rc-m-' + f.id"
                  type="text"
                  inputmode="numeric"
                  placeholder="Ej: 1.520.000"
                  [(ngModel)]="f.montoTexto"
                  (ngModelChange)="formatear(f)"
                  class="rc-input"
                />
              </div>
              <div class="sm:col-span-4 flex flex-col gap-1.5">
                <label [for]="'rc-n-' + f.id" class="text-xs font-semibold text-neutral-700 dark:text-neutral-300"
                  >Nota</label
                >
                <input
                  [id]="'rc-n-' + f.id"
                  type="text"
                  placeholder="Opcional"
                  [(ngModel)]="f.nota"
                  class="rc-input"
                />
              </div>
              <button
                type="button"
                (click)="registrar(f)"
                [disabled]="f.guardando || numero(f.montoTexto) <= 0"
                class="sm:col-span-3 px-4 py-3 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-black text-sm font-semibold hover:bg-neutral-700 dark:hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
              >
                {{ f.guardando ? 'Guardando…' : 'Registrar' }}
              </button>
            </div>
            <p *ngIf="f.error" class="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
              {{ f.error }}
            </p>
          </article>
        </section>

        <section class="space-y-3">
          <div class="flex items-baseline justify-between">
            <h2 class="text-sm font-semibold text-neutral-900 dark:text-white">
              Mis registros de {{ fecha === hoy ? 'hoy' : fecha }}
            </h2>
            <p class="text-sm font-semibold tabular-nums text-neutral-900 dark:text-white">
              {{ money(totalMisRegistros) }}
            </p>
          </div>
          <p *ngIf="!cargando && registros.length === 0" class="text-sm text-neutral-500">
            Todavía no registras entregas en esta fecha.
          </p>

          <article
            *ngFor="let r of registros; trackBy: trackReg"
            class="rc-card"
            [class.opacity-60]="r.anulada"
          >
            <ng-container *ngIf="editando?.id !== r.id; else edicion">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                    {{ r.vendedor }}
                  </p>
                  <p class="text-xs text-neutral-500 mt-0.5">
                    {{ r.creadoEn | date: 'h:mm a' }}
                    <span *ngIf="r.nota"> · {{ r.nota }}</span>
                    <span *ngIf="r.editadoEn"> · corregido</span>
                  </p>
                </div>
                <p
                  class="text-lg font-bold tabular-nums text-neutral-900 dark:text-white"
                  [class.line-through]="r.anulada"
                >
                  {{ money(r.monto) }}
                </p>
              </div>
              <div *ngIf="!r.anulada" class="mt-3 flex gap-2">
                <button type="button" class="rc-btn" (click)="editar(r)">Corregir</button>
                <button type="button" class="rc-btn rc-btn-peligro" (click)="anular(r)">Anular</button>
              </div>
              <p *ngIf="r.anulada" class="mt-2 text-xs font-semibold text-neutral-500">Anulada</p>
            </ng-container>

            <ng-template #edicion>
              <p class="text-sm font-semibold text-neutral-900 dark:text-white">{{ r.vendedor }}</p>
              <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  inputmode="numeric"
                  aria-label="Monto corregido"
                  [(ngModel)]="editMontoTexto"
                  (ngModelChange)="formatearEdit()"
                  class="rc-input"
                />
                <input
                  type="text"
                  aria-label="Nota"
                  placeholder="Nota"
                  [(ngModel)]="editNota"
                  class="rc-input"
                />
              </div>
              <div class="mt-3 flex gap-2">
                <button
                  type="button"
                  class="rc-btn rc-btn-primario"
                  [disabled]="numero(editMontoTexto) <= 0 || guardandoEdicion"
                  (click)="guardarEdicion(r)"
                >
                  {{ guardandoEdicion ? 'Guardando…' : 'Guardar' }}
                </button>
                <button type="button" class="rc-btn" (click)="cancelarEdicion()">Cancelar</button>
              </div>
            </ng-template>
          </article>
        </section>
      </div>
    </div>
  `,
  styles: [
    `
      .rc-card {
        border-radius: 16px;
        padding: 16px;
        background: #fff;
        border: 1px solid #e5e5e5;
      }
      @media (prefers-color-scheme: dark) {
        .rc-card {
        background: #0a0a0a;
        border-color: #262626;
      }
      }
      .rc-input {
        width: 100%;
        border-radius: 12px;
        padding: 10px 14px;
        font-size: 16px;
        background: #fff;
        border: 1px solid #e5e5e5;
        color: #171717;
        outline: none;
      }
      .rc-input:focus {
        border-color: #737373;
        box-shadow: 0 0 0 2px rgba(115, 115, 115, 0.35);
      }
      @media (prefers-color-scheme: dark) {
        .rc-input {
        background: rgba(255, 255, 255, 0.04);
        border-color: #262626;
        color: #fff;
      }
      }
      .rc-btn {
        padding: 8px 14px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 600;
        border: 1px solid #e5e5e5;
        background: #fff;
        color: #404040;
      }
      .rc-btn:disabled {
        opacity: 0.4;
      }
      .rc-btn-primario {
        background: #171717;
        color: #fff;
        border-color: #171717;
      }
      .rc-btn-peligro {
        color: #dc2626;
      }
      @media (prefers-color-scheme: dark) {
        .rc-btn {
        background: #0a0a0a;
        border-color: #262626;
        color: #d4d4d4;
      }
      }
      @media (prefers-color-scheme: dark) {
        .rc-btn-primario {
        background: #fff;
        color: #000;
        border-color: #fff;
      }
      }
    `,
  ],
})
export class RecogerCajaComponent implements OnInit {
  private auth = inject(AuthService);
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private entregas = inject(EntregasCajaService);
  private cdr = inject(ChangeDetectorRef);

  readonly hoy = fechaLocalYmd();
  fecha = this.hoy;
  cargando = true;
  errorGeneral = '';

  filas: FilaVendedor[] = [];
  registros: EntregaCaja[] = [];

  editando: EntregaCaja | null = null;
  editMontoTexto = '';
  editNota = '';
  guardandoEdicion = false;

  trackFila = (_: number, f: FilaVendedor) => f.id;
  trackReg = (_: number, r: EntregaCaja) => r.id;
  money = (n: number) => fmt.format(Math.round(n || 0));

  get totalMisRegistros(): number {
    return this.registros.filter((r) => !r.anulada).reduce((a, r) => a + r.monto, 0);
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.cargarVendedores(), this.cargarMisRegistros()]);
    this.cargando = false;
    this.cdr.markForCheck();
  }

  private async cargarVendedores(): Promise<void> {
    try {
      const snap = await runInInjectionContext(this.injector, () =>
        getDocs(query(collection(this.firestore, 'usuarios'), where('role', '==', 'vendedor'))),
      );
      this.filas = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((u) => u.active?.value === true && u.email !== 'admin@example.com')
        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'))
        .map((u) => ({
          id: u.id,
          nombre: String(u.name),
          montoTexto: '',
          nota: '',
          guardando: false,
          error: '',
        }));
    } catch (e) {
      console.error('[RecogerCaja] vendedores', e);
      this.errorGeneral = 'No se pudo cargar la lista de vendedores.';
    }
  }

  async cargarMisRegistros(): Promise<void> {
    const yo = this.auth.getCurrentUser();
    if (!yo?.id || !/^\d{4}-\d{2}-\d{2}$/.test(this.fecha)) return;
    this.cancelarEdicion();
    try {
      this.registros = await this.entregas.delRecolectorEnFecha(yo.id, this.fecha);
    } catch (e) {
      console.error('[RecogerCaja] registros', e);
      this.errorGeneral = 'No se pudieron cargar tus registros.';
    }
    this.cdr.markForCheck();
  }

  numero(texto: string): number {
    const d = (texto || '').replace(/[^\d]/g, '');
    return d ? Number(d) : 0;
  }

  private moneda(texto: string): string {
    const d = texto.replace(/[^\d]/g, '');
    return d ? Number(d).toLocaleString('es-CO') : '';
  }

  formatear(f: FilaVendedor): void {
    f.montoTexto = this.moneda(f.montoTexto);
    f.error = '';
    this.cdr.markForCheck();
  }

  formatearEdit(): void {
    this.editMontoTexto = this.moneda(this.editMontoTexto);
    this.cdr.markForCheck();
  }

  async registrar(f: FilaVendedor): Promise<void> {
    const yo = this.auth.getCurrentUser();
    const monto = this.numero(f.montoTexto);
    if (!yo?.id || monto <= 0) return;
    f.guardando = true;
    f.error = '';
    this.cdr.markForCheck();
    try {
      await this.entregas.crear({
        fecha: this.fecha,
        vendedorId: f.id,
        vendedor: f.nombre,
        monto,
        nota: f.nota,
        recolectorId: yo.id,
        recolector: yo.name,
      });
      f.montoTexto = '';
      f.nota = '';
      await this.cargarMisRegistros();
    } catch (e) {
      console.error('[RecogerCaja] registrar', e);
      f.error = 'No se pudo guardar. Intenta de nuevo.';
    } finally {
      f.guardando = false;
      this.cdr.markForCheck();
    }
  }

  editar(r: EntregaCaja): void {
    this.editando = r;
    this.editMontoTexto = r.monto.toLocaleString('es-CO');
    this.editNota = r.nota;
    this.cdr.markForCheck();
  }

  cancelarEdicion(): void {
    this.editando = null;
    this.cdr.markForCheck();
  }

  async guardarEdicion(r: EntregaCaja): Promise<void> {
    const monto = this.numero(this.editMontoTexto);
    if (monto <= 0) return;
    this.guardandoEdicion = true;
    this.cdr.markForCheck();
    try {
      await this.entregas.corregir(r, monto, this.editNota);
      this.editando = null;
      await this.cargarMisRegistros();
    } catch (e) {
      console.error('[RecogerCaja] corregir', e);
      this.errorGeneral = 'No se pudo corregir el registro.';
    } finally {
      this.guardandoEdicion = false;
      this.cdr.markForCheck();
    }
  }

  async anular(r: EntregaCaja): Promise<void> {
    if (!confirm(`¿Anular la entrega de ${r.vendedor} por ${this.money(r.monto)}?`)) return;
    try {
      await this.entregas.anular(r);
      await this.cargarMisRegistros();
    } catch (e) {
      console.error('[RecogerCaja] anular', e);
      this.errorGeneral = 'No se pudo anular el registro.';
      this.cdr.markForCheck();
    }
  }
}
