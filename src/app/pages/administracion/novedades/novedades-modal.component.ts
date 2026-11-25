import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Injectable,
  Input,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, Subscription } from 'rxjs';
import { AuthService } from '../../../services/auth/auth.service';

/**
 * Sube este número cuando haya novedades nuevas que anunciar:
 * cada administrador volverá a verlas una vez.
 */
export const VERSION_NOVEDADES = '2026-11-v1';
const CLAVE = 'novedades-vistas-';

@Injectable({ providedIn: 'root' })
export class NovedadesService {
  private mostrarSubject = new BehaviorSubject<boolean>(false);
  mostrar$ = this.mostrarSubject.asObservable();

  /** Abre el anuncio. `automatico` solo lo abre si este administrador aún no lo ha visto. */
  abrir(): void {
    this.mostrarSubject.next(true);
  }

  cerrar(): void {
    this.mostrarSubject.next(false);
  }

  verificarPrimeraVez(userId: string | undefined): void {
    if (!userId) return;
    try {
      if (localStorage.getItem(CLAVE + userId) === VERSION_NOVEDADES) return;
      // Se marca como visto al mostrarse: aparece una sola vez aunque recargue la página.
      localStorage.setItem(CLAVE + userId, VERSION_NOVEDADES);
    } catch {
      return; // sin almacenamiento no se puede recordar: mejor no molestar
    }
    this.mostrarSubject.next(true);
  }
}

interface Novedad {
  icono: string;
  titulo: string;
  que: string;
  donde: string;
  ruta?: string;
  enlace?: string;
}

interface GrupoNovedades {
  titulo: string;
  items: Novedad[];
}

const GRUPOS: GrupoNovedades[] = [
  {
    titulo: 'Inteligencia artificial',
    items: [
      {
        icono: '🤖',
        titulo: 'Nuevo asistente personal',
        que: 'El Chat bot ahora es un asistente que consulta tus datos reales antes de responder: ventas, caja por vendedor, ganancias, stock, préstamos, pedidos, exhibiciones, llegadas, historial de bodega, descuadres, precios y el calendario comercial. Puedes hablarle con la voz, guarda tus conversaciones y recuerda las reglas de tu negocio si le dices "Recuerda que…". Usa varios modelos de IA y, si uno falla, sigue con otro.',
        donde: 'Menú → Chat bot.',
        ruta: '/admin/ia',
        enlace: 'Abrir el asistente',
      },
      {
        icono: '🔔',
        titulo: 'Campana de notificaciones de la IA',
        que: 'La IA revisa tu negocio y deja aquí sus avisos: ventas raras, descuadres, cuadres pendientes y fechas comerciales. El contador rojo es solo tuyo: si otro administrador lee un aviso, a ti te seguirá apareciendo hasta que lo abras. Al tocar un aviso, te lleva a la pantalla correspondiente con los filtros ya puestos.',
        donde: 'Arriba a la derecha, junto al botón Recargar.',
        ruta: '/admin/notificaciones',
        enlace: 'Abrir notificaciones',
      },
      {
        icono: '🔎',
        titulo: 'Alertas de ventas y patrones por vendedor',
        que: 'Cada noche la IA mira si hoy se vendieron muchos pares por debajo del precio mínimo, y si algún vendedor tiene muchas ventas bajo el mínimo o muchos cambios en la semana, comparado con el promedio del equipo. También avisa al instante de ventas por debajo del costo o posibles duplicadas. Es un aviso para revisar, no una acusación: puede haber una razón normal.',
        donde: 'Te llega a la campana. Al tocarlo abre Ventas de locales con el filtro listo.',
      },
      {
        icono: '📣',
        titulo: 'Campañas de temporada',
        que: 'Cuando una fecha fuerte (Día de la Madre, Black Friday, Navidad…) está a 3 semanas o menos, la IA prepara un plan: qué referencias empujar porque se vendieron bien esa fecha el año pasado, cuáles reponer antes de que se agoten y cuáles mover porque llevan tiempo paradas. Incluye ideas de publicaciones para WhatsApp e Instagram.',
        donde: 'Te avisa en la campana. También puedes generarla tú cuando quieras.',
        ruta: '/admin/campanas',
        enlace: 'Ver campañas',
      },
      {
        icono: '🌅',
        titulo: 'Resumen diario y sugerencias de precios',
        que: 'Cada mañana recibes un resumen de cómo va el negocio, y la IA sugiere qué precios subir, qué referencias poner en promoción y dónde el precio mínimo está muy alto frente a lo que realmente se vende. Los precios son sugerencias: la decisión es tuya.',
        donde: 'Te llega por notificación; también puedes preguntarle al asistente.',
      },
    ],
  },
  {
    titulo: 'Inventario y locales',
    items: [
      {
        icono: '📦',
        titulo: 'Descuadres de inventario',
        que: 'Compara los pares que ingresaron con los que hay en bodega, pedidos, préstamos, ventas, exhibiciones y locales, y te dice cuáles productos no cuadran y por qué puede ser. El análisis completo solo revisa los productos con stock; si buscas un código específico, lo analiza aunque esté agotado. Cada noche se revisa solo y avisa si aparecen nuevos.',
        donde: 'Menú → Descuadres de inventario.',
        ruta: '/admin/descuadres',
        enlace: 'Ver descuadres',
      },
      {
        icono: '🏬',
        titulo: 'Ventas de locales (antes "Locales")',
        que: 'Cambió de nombre para que sea más claro. Ahora puedes ver solo las ventas que quedaron por debajo del precio mínimo, y la pantalla se abre sola con el local, el día, el vendedor o el producto que te interesa cuando vienes desde un aviso.',
        donde: 'Menú → Ventas de locales.',
        ruta: '/admin/locales',
        enlace: 'Abrir Ventas de locales',
      },
      {
        icono: '🗂️',
        titulo: 'Historial de bodega',
        que: 'Registro de lo que entra y sale de bodega para poder seguirle el rastro a cada par.',
        donde: 'Menú → Historial Bodega.',
        ruta: '/admin/historial-bodega',
        enlace: 'Ver historial',
      },
    ],
  },
  {
    titulo: 'Caja y ventas',
    items: [
      {
        icono: '💵',
        titulo: 'Cuadre de caja',
        que: 'Pantalla para cuadrar la caja de cada vendedor por día. Si queda algún cuadre sin hacer, la IA te lo recuerda por la noche con el efectivo que falta por recoger.',
        donde: 'Menú → Cuadre de caja.',
        ruta: '/admin/cuadre-caja',
        enlace: 'Abrir cuadre de caja',
      },
      {
        icono: '🛡️',
        titulo: 'Datos más confiables',
        que: 'Se corrigió un problema que hacía que algunas ventas no se contaran en el producto correcto, y el sistema ahora evita que vuelva a pasar. Los totales de cada producto deberían coincidir mejor.',
        donde: 'Se aplica automáticamente, no tienes que hacer nada.',
      },
    ],
  },
  {
    titulo: 'Mejoras generales',
    items: [
      {
        icono: '✨',
        titulo: 'Mejoras en muchas pantallas',
        que: 'Se mejoraron pedidos, préstamos, exhibiciones, bonos, metas, auditorías, nómina, el catálogo, el inicio y el panel de administración, con más estabilidad y menos congelamientos. También se mejoró la impresión y la instalación de la app en el celular.',
        donde: 'En todo el sistema.',
      },
      {
        icono: '💡',
        titulo: 'Recomendaciones de reposición',
        que: 'Ya no se abren solas al entrar. Las sigues teniendo cuando las necesites.',
        donde: 'Botón "Ver recomendaciones" en el panel de control.',
      },
    ],
  },
];

/** Anuncio de novedades: se muestra una vez a cada administrador y se reabre con "Ver novedades". */
@Component({
  selector: 'app-novedades-modal',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible) {
      <div
        class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="novedades-titulo"
        (click)="cerrar()"
      >
        <div
          class="w-full sm:max-w-2xl max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          <div class="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-zinc-800">
            <p
              class="text-[11px] font-semibold tracking-[0.18em] uppercase text-amber-600 dark:text-amber-400"
            >
              Novedades
            </p>
            <h2
              id="novedades-titulo"
              class="text-xl font-bold tracking-tight text-gray-900 dark:text-zinc-50"
            >
              ¡Bienvenido, {{ nombreUsuario || 'Administrador' }}!
            </h2>
            <p class="text-sm text-gray-500 dark:text-zinc-400 mt-1">
              ShoeShop tiene nuevas actualizaciones. Esto es lo que cambió
              y dónde encontrarlo.
            </p>
          </div>

          <div class="px-6 py-4 overflow-y-auto space-y-6">
            @for (g of grupos; track g.titulo) {
              <section>
                <h3
                  class="mb-2 text-[11px] font-semibold tracking-[0.14em] uppercase text-gray-500 dark:text-zinc-400"
                >
                  {{ g.titulo }}
                </h3>
                <ul class="space-y-3">
                  @for (n of g.items; track n.titulo) {
                    <li
                      class="p-4 rounded-lg bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800"
                    >
                      <p
                        class="text-sm font-semibold text-gray-900 dark:text-zinc-100"
                      >
                        <span aria-hidden="true">{{ n.icono }}</span>
                        {{ n.titulo }}
                      </p>
                      <p
                        class="mt-1.5 text-sm text-gray-600 dark:text-zinc-300"
                      >
                        {{ n.que }}
                      </p>
                      <p
                        class="mt-1.5 text-xs text-gray-500 dark:text-zinc-400"
                      >
                        <span class="font-semibold">Dónde:</span> {{ n.donde }}
                      </p>
                      @if (n.ruta) {
                        <a
                          [routerLink]="n.ruta"
                          (click)="cerrar()"
                          class="inline-block mt-2 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                          >{{ n.enlace }} →</a
                        >
                      }
                    </li>
                  }
                </ul>
              </section>
            }
          </div>

          <div
            class="px-6 py-4 border-t border-gray-200 dark:border-zinc-800 flex items-center justify-between gap-3"
          >
            <p class="text-xs text-gray-400 dark:text-zinc-500">
              Podrás volver a verlo con el botón "Ver novedades".
            </p>
            <button
              type="button"
              (click)="cerrar()"
              class="h-9 px-4 rounded-lg bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[13px] font-semibold hover:opacity-80 cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class NovedadesModalComponent implements OnInit, OnDestroy {
  @Input() nombreUsuario = '';

  private servicio = inject(NovedadesService);
  private auth = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private sub = new Subscription();
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  grupos = GRUPOS;
  visible = false;

  ngOnInit(): void {
    this.sub.add(
      this.servicio.mostrar$.subscribe((v) => {
        this.visible = v;
        this.cdr.markForCheck();
      }),
    );
    // Se espera un momento para que el panel termine de cargar antes de mostrar el anuncio
    this.temporizador = setTimeout(
      () => this.servicio.verificarPrimeraVez(this.auth.getCurrentUser()?.id),
      1500,
    );
  }

  cerrar(): void {
    this.servicio.cerrar();
  }

  ngOnDestroy(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.sub.unsubscribe();
  }
}
