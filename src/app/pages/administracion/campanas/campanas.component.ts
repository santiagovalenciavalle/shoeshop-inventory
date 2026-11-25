import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Injector,
  OnInit,
  inject,
  runInInjectionContext,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  Firestore,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from '@angular/fire/firestore';
import { IaFuncionesService } from '../../../services/administracion/ia/ia-funciones.service';

interface ItemCampana {
  codigo: number | string;
  producto: string;
  stock: number;
  imagen: string | null;
  motivo: string;
}

interface Campana {
  id: string;
  evento: string;
  fecha: string;
  diasFaltan: number;
  empujar: ItemCampana[];
  reponer: ItemCampana[];
  mover: ItemCampana[];
  estrategia: string;
}

@Component({
  selector: 'app-campanas',
  standalone: true,
  imports: [NgClass, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-zinc-950 px-4 sm:px-6 py-6">
      <div class="max-w-4xl mx-auto">
        <div class="flex items-start justify-between gap-3 mb-5">
          <div>
            <a
              routerLink="/admin"
              class="text-xs text-gray-400 hover:text-gray-600 dark:text-zinc-500"
              >← Volver al panel</a
            >
            <h1
              class="text-2xl font-black tracking-tight text-gray-900 dark:text-zinc-50"
            >
              Campañas de temporada
            </h1>
            <p class="text-sm text-gray-400 dark:text-zinc-500">
              Qué empujar, qué reponer y qué mover antes de cada fecha fuerte.
            </p>
          </div>
          <button
            type="button"
            (click)="generar()"
            [disabled]="generando"
            class="px-3 py-2 rounded-lg text-xs font-semibold bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-80 disabled:opacity-50"
          >
            {{ generando ? 'Generando…' : 'Generar la del próximo evento' }}
          </button>
        </div>

        @if (error) {
          <p class="mb-4 text-sm text-red-600">{{ error }}</p>
        }
        @if (cargando) {
          <p class="text-sm text-gray-400">Cargando…</p>
        } @else if (!campanas.length) {
          <p class="text-center py-16 text-sm text-gray-400 dark:text-zinc-500">
            Aún no hay campañas. Se crean solas 2 a 3 semanas antes de cada
            fecha fuerte, o puedes generar la del próximo evento.
          </p>
        }

        @for (c of campanas; track c.id) {
          <section
            class="mb-6 p-5 rounded-2xl bg-white dark:bg-zinc-900 border"
            [ngClass]="
              c.id === resaltada
                ? 'border-amber-400 shadow-md'
                : 'border-gray-100 dark:border-zinc-800'
            "
          >
            <h2 class="text-lg font-black text-gray-900 dark:text-zinc-100">
              {{ c.evento }}
              <span class="text-xs font-semibold text-gray-400 ml-1">{{
                c.fecha
              }}</span>
            </h2>
            <p
              class="mt-2 text-sm text-gray-700 dark:text-zinc-300 whitespace-pre-line"
            >
              {{ c.estrategia }}
            </p>

            @for (g of grupos(c); track g.titulo) {
              @if (g.items.length) {
                <h3
                  class="mt-5 mb-2 text-xs font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400"
                >
                  {{ g.titulo }}
                </h3>
                <ul class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  @for (i of g.items; track i.codigo) {
                    <li
                      class="flex gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800/60"
                    >
                      @if (i.imagen) {
                        <img
                          [src]="i.imagen"
                          [alt]="i.producto"
                          loading="lazy"
                          class="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-gray-200"
                        />
                      }
                      <div class="min-w-0">
                        <p
                          class="text-sm font-semibold text-gray-900 dark:text-zinc-100 truncate"
                        >
                          {{ i.producto }}
                          <span class="text-xs text-gray-400"
                            >· cód. {{ i.codigo }}</span
                          >
                        </p>
                        <p class="text-xs text-gray-500 dark:text-zinc-400">
                          Stock: {{ i.stock }} · {{ i.motivo }}
                        </p>
                      </div>
                    </li>
                  }
                </ul>
              }
            }
          </section>
        }
      </div>
    </div>
  `,
})
export class CampanasComponent implements OnInit {
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private funciones = inject(IaFuncionesService);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  campanas: Campana[] = [];
  resaltada: string | null = null;
  cargando = true;
  generando = false;
  error = '';

  async ngOnInit(): Promise<void> {
    this.resaltada = this.route.snapshot.queryParamMap.get('id');
    await this.cargar();
  }

  grupos(c: Campana) {
    return [
      { titulo: 'Empujar', items: c.empujar ?? [] },
      { titulo: 'Reponer', items: c.reponer ?? [] },
      { titulo: 'Mover (stock parado)', items: c.mover ?? [] },
    ];
  }

  private async cargar(): Promise<void> {
    try {
      const snap = await runInInjectionContext(this.injector, () =>
        getDocs(
          query(
            collection(this.firestore, 'campanasMarketing'),
            orderBy('creado', 'desc'),
            limit(10),
          ),
        ),
      );
      this.campanas = snap.docs.map((d) => d.data() as Campana);
      // La que se abrió desde una notificación va primero
      if (this.resaltada) {
        this.campanas.sort(
          (a, b) => Number(b.id === this.resaltada) - Number(a.id === this.resaltada),
        );
      }
    } catch (e: any) {
      this.error = e?.message ?? 'No se pudieron cargar las campañas.';
    } finally {
      this.cargando = false;
      this.cdr.markForCheck();
    }
  }

  async generar(): Promise<void> {
    this.generando = true;
    this.error = '';
    this.cdr.markForCheck();
    try {
      const c = await this.funciones.llamar<Campana>('crearCampanaManual');
      this.resaltada = c.id;
      await this.cargar();
    } catch (e: any) {
      this.error = e.message;
    } finally {
      this.generando = false;
      this.cdr.markForCheck();
    }
  }
}
