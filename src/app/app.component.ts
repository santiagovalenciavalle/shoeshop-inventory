import {
  Component,
  HostListener,
  inject,
  Inject,
  Injector,
  runInInjectionContext,
  PLATFORM_ID,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { NavigationEnd, NavigationError, NavigationStart, Router, RouterModule } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';

import { UsuarioService } from './services/administracion/usuarios/usuario.service';
import { User } from './pages/interfaces';
import * as AOS from 'aos';
import { AuthService } from './services/auth/auth.service';
import { filter, Subscription } from 'rxjs';
import { BluetoothPrinterService } from './services/bluetooth-printer/bluetooth-printer.service';
import { PrinterFabComponent } from './components/printer-fab/printer-fab.component';
import { OrderService } from './services/vendedorServices/order.service';
import { PrestamosService } from './services/vendedorServices/prestamos/prestamos.service';
import { LocalesService } from './services/locales/locales.service';
import { ExhibicionesService } from './services/vendedorServices/exhibiciones/exhibiciones.service';
import { CatalogoService } from './services/catalogo/catalogo.service';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { RegistroIngresosService } from './services/administracion/registro de ingresos/registro-ingresos.service';
import { VisibilityService } from './services/visibilitychange/visibility.service';
import { SwUpdate } from '@angular/service-worker';
import { CampanaNotificacionesComponent } from './pages/administracion/notificaciones-ia/notificaciones-ia.component';
interface NavItem {
  label: string;
  routerLink: string;
  icon: string;
}
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    ButtonModule,
    CardModule,
    RouterModule,
    CommonModule,
    PrinterFabComponent,
    CampanaNotificacionesComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'shoeShop';
  showIntro = true;
  isAdminRoute = false;
  isVendedorRoute = false;
  menuOpen = false;
  activeRoute = '';
  fechaActualizacion = '11 de noviembre de 2026';
  private servicios: Array<{ reiniciarListener: () => void }>;
  private authSub: Subscription | null = null;
  private yaInicializado = false;
  private injector = inject(Injector);
  user: { name?: string; role?: string; recolectorCaja?: boolean } | null = null;
  private readonly MIN_MS_PARA_RECONEXION_MANUAL = 30 * 60 * 1000;
  private ultimaVezOculto: number | null = null;

  constructor(
    private orderService: OrderService,
    private prestamosService: PrestamosService,
    private localesService: LocalesService,
    private exhibicionesService: ExhibicionesService,
    private catalogoService: CatalogoService,
    private registroIngresosService: RegistroIngresosService,
    private auth: Auth,
    private usuarioService: UsuarioService,
    private visibilityService: VisibilityService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private swUpdate: SwUpdate,
    private router: Router,
    private authService: AuthService,
  ) {
    this.showIntro = true;
    this.servicios = [
      this.orderService,
      this.catalogoService,
      this.exhibicionesService,
      this.prestamosService,
      this.localesService,
      this.registroIngresosService,
    ];
  }
  anioActual: number = new Date().getFullYear();
  readonly vendedorItems: NavItem[] = [
    { label: 'Inicio', routerLink: '/vendedor', icon: '🏠' },
    {
      label: 'En locales',
      routerLink: '/vendedor/almacen',
      icon: '📍',
    },
    { label: 'Solicitar Tennis', routerLink: '/vendedor/catalogo', icon: '👟' },
    { label: 'Mis Pedidos', routerLink: '/vendedor/pedidos', icon: '📦' },
    { label: 'Préstamos', routerLink: '/vendedor/prestamos', icon: '🔄' },
    { label: 'Ver Ventas', routerLink: '/vendedor/ventas', icon: '📈' },
    { label: 'Exhibiciones', routerLink: '/vendedor/exhibiciones', icon: '🛍️' },
    {
      label: 'Venta en Otro Local',
      routerLink: '/vendedor/venta-local',
      icon: '🏬',
    },
    { label: 'Bonos', routerLink: '/vendedor/bonos', icon: '🎟️' },
    {
      label: 'Mis Metas',
      routerLink: '/vendedor/metas',
      icon: '🎯',
    },
    {
      label: 'Auditoría',
      routerLink: 'vendedor/auditoria',
      icon: '📋',
    },
    { label: 'Salir', routerLink: '/home', icon: '🔐' },
  ];

  readonly items: NavItem[] = [
    { label: 'Inicio', routerLink: '/admin', icon: 'home' },
    {
      label: 'Chat bot',
      routerLink: '/admin/ia',
      icon: 'ai',
    },
    {
      label: 'Metas',
      routerLink: '/admin/metas',
      icon: 'targets',
    },
    { label: 'Bodega', routerLink: '/admin/inventario', icon: 'bodega' },
    { label: 'Ventas', routerLink: '/admin/ventas', icon: 'dollar' },
    {
      label: 'Cuadre de caja',
      routerLink: '/admin/cuadre-caja',
      icon: 'wallet',
    },
    {
      label: 'Descuadres de inventario',
      routerLink: '/admin/descuadres',
      icon: 'audit',
    },
    {
      label: 'Ventas de locales',
      routerLink: '/admin/locales',
      icon: 'store',
    },
    { label: 'Préstamos', routerLink: '/admin/prestamos', icon: 'transfer' },
    {
      label: 'Auditoria locales',
      routerLink: '/admin/auditoria',
      icon: 'gallery',
    },
    {
      label: 'Mercancia en locales',
      routerLink: '/admin/mercancia-locales',
      icon: 'mercancia-locales',
    },
    {
      label: 'Auditoria Bodega',
      routerLink: '/admin/auditoriabodega',
      icon: 'warehouse',
    },
    {
      label: 'Exhibiciones',
      routerLink: '/admin/exhibiciones',
      icon: 'audit',
    },
    {
      label: 'Mapa de locales',
      routerLink: '/admin/mapa',
      icon: 'map',
    },
    {
      label: 'Reposiciones',
      routerLink: '/admin/reposiciones',
      icon: 'restock',
    },
    {
      label: 'Préstamo exhibiciones',
      routerLink: '/admin/prestamo-exhibiciones',
      icon: 'briefcase',
    },
    { label: 'Personal', routerLink: '/admin/personal', icon: 'users' },
    { label: 'Nómina', routerLink: '/admin/nomina', icon: 'wallet' },
    { label: 'Gastos', routerLink: '/admin/gastos', icon: 'gastos' },
    { label: 'Proveedores', routerLink: '/admin/proveedores', icon: 'truck' },

    {
      label: 'Historial Bodega',
      routerLink: '/admin/historial-bodega',
      icon: 'history',
    },
    {
      label: 'Movimiento Locales',
      routerLink: '/admin/historial-locales',
      icon: 'movimiento-locales',
    },
    { label: 'Créditos', routerLink: '/admin/creditos', icon: 'credit' },
    {
      label: 'Registro Diario',
      routerLink: '/admin/registro-diario',
      icon: 'registro-diario',
    },
    { label: 'Pedidos', routerLink: '/admin/pedidos', icon: 'cart' },
    { label: 'llegadas', routerLink: '/admin/llegadas', icon: 'arrivals' },
    { label: 'Bonos', routerLink: '/admin/bonos', icon: 'bonus' },

    { label: 'Salir', routerLink: '/home', icon: 'logout' },
  ];
  printer = inject(BluetoothPrinterService);

  ngOnInit(): void {
    this.configurarActualizaciones();

    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.activeRoute = e.urlAfterRedirects;
        this.isAdminRoute = this.activeRoute.startsWith('/admin');
        this.isVendedorRoute = this.activeRoute.startsWith('/vendedor');
        this.menuOpen = false;
      });

    runInInjectionContext(this.injector, () => {
      onAuthStateChanged(this.auth, async (firebaseUser) => {
        if (firebaseUser && !this.yaInicializado) {
          try {
            await firebaseUser.getIdToken(true);
            this.yaInicializado = true;
            this.actualizarUsuario();
            console.log('[App] Sesión restaurada — iniciando listeners...');
            this.servicios.forEach((s) => s.reiniciarListener());
          } catch (e) {
            console.error('[App] Error obteniendo token:', e);
          }
        }
        if (!firebaseUser) {
          this.yaInicializado = false;
        }
      });
    });

    this.authSub = this.authService.loginConfirmado$.subscribe((confirmado) => {
      if (confirmado) {
        if (!this.yaInicializado) {
          this.yaInicializado = true;
          console.log('[App] Login confirmado — iniciando listeners...');
          this.servicios.forEach((s) => s.reiniciarListener());
        }
        this.actualizarUsuario();
      } else {
        this.yaInicializado = false;
        this.user = null;
      }
    });

    this.activeRoute = this.router.url;
    this.isAdminRoute = this.activeRoute.startsWith('/admin');
    this.isVendedorRoute = this.activeRoute.startsWith('/vendedor');

    setTimeout(() => {
      this.showIntro = false;
    }, 4000);

    if (isPlatformBrowser(this.platformId)) {
      AOS.init();
    }
  }
  /**
   * Actualizaciones estables sin molestar:
   *  1. Busca versión nueva al abrir, al volver a la pestaña, al recuperar internet y cada 5 min.
   *  2. Cuando hay una lista, se aplica sola en un momento seguro: al cambiar de pantalla o cuando
   *     la app estuvo en segundo plano (así no se pierde una venta a medio escribir).
   *  3. Si el service worker queda inconsistente o falta un archivo de una versión vieja
   *     (típico al subir un dist nuevo), recarga una sola vez en vez de quedarse pegado.
   */
  private configurarActualizaciones(): void {
    let versionLista = false;
    let recargando = false;

    const recargar = async (destino?: string) => {
      if (recargando) return;
      recargando = true;
      try {
        await this.swUpdate.activateUpdate();
      } catch {
        /* si falla, igual se recarga */
      }
      if (destino) window.location.assign(destino);
      else window.location.reload();
    };

    // Un fallo de carga de archivos de una versión anterior se arregla recargando UNA vez.
    const recargarUnaVez = (motivo: string) => {
      const marca = 'recarga-por-version';
      try {
        const ultima = Number(sessionStorage.getItem(marca) || 0);
        if (Date.now() - ultima < 60_000) return; // evita bucles de recarga
        sessionStorage.setItem(marca, String(Date.now()));
      } catch {
        /* sin sessionStorage: se recarga igual */
      }
      console.warn('[App] Recargando por versión desactualizada:', motivo);
      void recargar();
    };

    const esErrorDeChunk = (msg: string) =>
      /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Unexpected token '<'/i.test(
        msg,
      );

    this.router.events.subscribe((e) => {
      if (e instanceof NavigationError && esErrorDeChunk(String(e.error?.message ?? e.error))) {
        recargarUnaVez('chunk perdido al navegar');
      }
      // Momento seguro: el usuario ya está cambiando de pantalla.
      if (e instanceof NavigationStart && versionLista && !recargando) {
        void recargar(e.url);
      }
    });
    window.addEventListener('unhandledrejection', (ev) => {
      if (esErrorDeChunk(String(ev.reason?.message ?? ev.reason))) recargarUnaVez('chunk perdido');
    });

    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates.subscribe((evt) => {
      if (evt.type === 'VERSION_READY') {
        versionLista = true;
        if (document.visibilityState === 'hidden') void recargar();
      }
    });
    this.swUpdate.unrecoverable.subscribe((e) => {
      console.error('[App] Service worker irrecuperable:', e.reason);
      void recargar();
    });

    const buscar = () => {
      if (navigator.onLine) this.swUpdate.checkForUpdate().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        buscar();
        // Volvió tras estar en segundo plano y ya había versión nueva: se aplica ahora.
        if (versionLista && !recargando) void recargar();
      }
    });
    window.addEventListener('online', buscar);
    setInterval(buscar, 5 * 60 * 1000);
    buscar();
  }

  recargarApp(): void {
    window.location.reload();
  }

  private actualizarUsuario(): void {
    this.user = this.authService.getCurrentUser();
    void this.authService.refrescarUsuario().then((u) => {
      this.user = u;
    });
  }

  /** Menú del vendedor; "Recoger caja" aparece solo si el admin lo habilitó como recolector. */
  get menuVendedor(): NavItem[] {
    // Se devuelve SIEMPRE la misma referencia mientras el permiso no cambie: un getter que
    // crea un arreglo nuevo en cada detección de cambios hace que *ngFor recree todo el menú
    // una y otra vez y congela la pantalla.
    return this.user?.recolectorCaja ? this.menuVendedorConRecolector : this.vendedorItems;
  }

  private readonly menuVendedorConRecolector: NavItem[] = (() => {
    const lista = [...this.vendedorItems];
    const salir = lista.findIndex((i) => i.label === 'Salir');
    lista.splice(salir < 0 ? lista.length : salir, 0, {
      label: 'Recoger caja',
      routerLink: '/vendedor/recoger-caja',
      icon: '💵',
    });
    return lista;
  })();
  get userInitials(): string {
    const name = this.user?.name || '';
    return (
      name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0]?.toUpperCase())
        .join('') || '?'
    );
  }

  get seccionActual(): string {
    const lista = this.isAdminRoute
      ? this.items
      : this.isVendedorRoute
        ? this.menuVendedor
        : [];
    const hit = lista
      .filter((i) => i.label !== 'Salir' && this.isActive(i.routerLink))
      .sort((a, b) => b.routerLink.length - a.routerLink.length)[0];
    return hit?.label ?? '';
  }

  get userRoleLabel(): string {
    const role = this.user?.role || '';
    return role.charAt(0).toUpperCase() + role.slice(1);
  }
  private onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.ultimaVezOculto = Date.now();
      return;
    }

    if (document.visibilityState === 'visible') {
      const estuvoOcultoMucho =
        this.ultimaVezOculto !== null &&
        Date.now() - this.ultimaVezOculto > this.MIN_MS_PARA_RECONEXION_MANUAL;

      if (!estuvoOcultoMucho) {
        return;
      }

      console.log(
        '[App] Volvió tras estar oculto mucho tiempo — reconectando listeners...',
      );

      this.visibilityService.marcarReconectando();

      this.servicios.forEach((s) => s.reiniciarListener());

      setTimeout(() => {
        this.visibilityService.marcarListo();
      }, 1500);
    }
  };

  get showPrinterFab(): boolean {
    const allowed = [
      '/admin/inventario',
      '/bodega',
      '/bodega/inventario',
      '/admin/inventario/imprimir-exhibiciones',
      '/bodega/inventario/imprimir-exhibiciones',
    ];
    return allowed.includes(this.activeRoute);
  }

  isEmoji(icon: string): boolean {
    return ![
      'home',
      'bodega',
      'dollar',
      'credit',
      'users',
      'store',
      'transfer',
      'gallery',

      'targets',
      'briefcase',
      'wallet',
      'truck',
      'audit',
      'gastos',
      'map',
      'restock',
      'history',
      'movimiento-locales',
      'mercancia-locales',
      'cart',
      'warehouse',
      'arrivals',
      'bonus',
      'registro-diario',
      'logout',
      'ai',
    ].includes(icon);
  }

  navigate(item: NavItem): void {
    if (item.label === 'Salir') {
      this.authService.logout();
    }
    this.router.navigate([item.routerLink]);
    this.menuOpen = false;
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  isActive(route: string): boolean {
    if (route === '/admin' || route === '/vendedor') {
      return this.router.url === route;
    }
    return this.router.url === route || this.router.url.startsWith(route + '/');
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.menuOpen = false;
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  private async agregarAdminSiFalta() {
    const adminEmail = 'admin@example.com';

    const adminUser: User = {
      email: adminEmail,
      password: '1020104348',
      name: 'Santiago Valle',
      role: 'admin',
      active: {
        label: '',
        value: true,
      },
    };

    try {
      await this.usuarioService.agregarUsuario(adminUser);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        console.warn('⚠️ El admin ya existe en Firebase Auth');
      } else {
        console.error('❌ Error al crear admin:', err);
      }
    }
  }
}
