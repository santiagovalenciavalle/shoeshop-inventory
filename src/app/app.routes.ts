import { Routes } from '@angular/router';
import { authGuard } from './services/auth/guards/auth.guard';
import { recolectorGuard } from './services/auth/guards/recolector.guard';
/**
 * Todas las pantallas se cargan BAJO DEMANDA (`loadComponent`): el navegador solo descarga el
 * código de la ruta que se abre. Antes todo iba en un único archivo de ~5,7 MB (incluidas tres
 * librerías de gráficos) aunque el usuario solo entrara al catálogo.
 * En producción el service worker precarga los demás trozos en segundo plano, así que la
 * navegación sigue siendo inmediata.
 */
export const routes: Routes = [
  { path: 'home', loadComponent: () =>
      import('./pages/home/home/home.component').then(
        (m) => m.HomeComponent,
      ) },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'catalogo', loadComponent: () =>
      import('./pages/vendedor/catalogo-productos/catalogo-productos.component').then(
        (m) => m.CatalogoProductosComponent,
      ) },
  { path: 'login_bodega', loadComponent: () =>
      import('./shared/components/login/login.component').then(
        (m) => m.LoginComponent,
      ), data: { role: 'bodega' } },
  { path: 'login_admin', loadComponent: () =>
      import('./shared/components/login/login.component').then(
        (m) => m.LoginComponent,
      ), data: { role: 'admin' } },
  {
    path: 'login_vendedor',
    loadComponent: () =>
      import('./shared/components/login/login.component').then(
        (m) => m.LoginComponent,
      ),
    data: { role: 'vendedor' },
  },

  {
    path: 'vendedor',
    loadComponent: () =>
      import('./pages/vendedor/vendedor.component').then(
        (m) => m.VendedorComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'vendedor' },
  },
  {
    path: 'vendedor/ventas',
    loadComponent: () =>
      import('./pages/vendedor/vendedor-children/show-vendedor-sales/show-vendedor-sales.component').then(
        (m) => m.ShowVendedorSalesComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'vendedor' },
  },
  {
    path: 'vendedor/catalogo',
    loadComponent: () =>
      import('./pages/vendedor/catalogo-productos/catalogo-productos.component').then(
        (m) => m.CatalogoProductosComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'vendedor' },
  },
  {
    path: 'vendedor/pedidos',
    loadComponent: () =>
      import('./pages/vendedor/vendedor-children/mis-pedidos/mis-pedidos.component').then(
        (m) => m.MisPedidosComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'vendedor' },
  },
  {
    path: 'vendedor/prestamos',
    loadComponent: () =>
      import('./pages/vendedor/prestamos/prestamos.component').then(
        (m) => m.PrestamosComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'vendedor' },
  },
  {
    path: 'vendedor/almacen',
    loadComponent: () =>
      import('./pages/vendedor/locales-inventario/inventario-locales.component').then(
        (m) => m.InventarioLocalesComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'vendedor' },
  },
  {
    path: 'vendedor/exhibiciones',
    loadComponent: () =>
      import('./components/vendedor_components/exhibiciones/exhibiciones.component').then(
        (m) => m.ExhibicionesComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'vendedor' },
  },
  {
    path: 'vendedor/venta-local',
    loadComponent: () =>
      import('./components/vendedor_components/venta-otro-local/venta-otro-local.component').then(
        (m) => m.VentaOtroLocalComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'vendedor' },
  },
  {
    path: 'vendedor/bonos',
    loadComponent: () =>
      import('./components/vendedor_components/bonos/bonos.component').then(
        (m) => m.BonosComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'vendedor' },
  },
  {
    path: 'vendedor/metas',
    loadComponent: () =>
      import('./pages/vendedor/mis metas/mis-metas.component').then(
        (m) => m.MisMetasComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'vendedor' },
  },
  {
    path: 'vendedor/auditoria',
    loadComponent: () =>
      import('./pages/vendedor/auditoria/auditoria-vendedor.component').then(
        (m) => m.AuditoriaVendedorComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'vendedor' },
  },
  {
    path: 'vendedor/recoger-caja',
    loadComponent: () =>
      import('./pages/vendedor/recoger-caja/recoger-caja.component').then(
        (m) => m.RecogerCajaComponent,
      ),
    canActivate: [authGuard, recolectorGuard],
    data: { role: 'vendedor' },
  },
  {
    path: 'bodega',
    loadComponent: () =>
      import('./pages/bodega/bodega.component').then(
        (m) => m.BodegaComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'bodega' },
  },
  {
    path: 'bodega/inventario',
    loadComponent: () =>
      import('./components/bodega_components/bodega-inventario/bodega-inventario.component').then(
        (m) => m.BodegaInventarioComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'bodega' },
  },
  {
    path: 'bodega/inventario/imprimir-exhibiciones',
    loadComponent: () =>
      import('./components/bodega_components/modal-imprimir-exhibiciones/moda-imprimir-exhibiciones.component').then(
        (m) => m.ModalImprimirExhibicionesComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'bodega' },
  },
  {
    path: 'bodega/sendExhibicion',
    loadComponent: () =>
      import('./pages/bodega/send-exhibicion/send-exhibicion.component').then(
        (m) => m.SendExhibicionComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'bodega' },
  },
  {
    path: 'bodega/auditoria',
    loadComponent: () =>
      import('./pages/bodega/auditoria-bodega/auditoria-trabajador-bodega.component').then(
        (m) => m.AuditoriaBodegaTrabajadorComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'bodega' },
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./pages/administracion/administracion.component').then(
        (m) => m.AdministracionComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/inventario',
    loadComponent: () =>
      import('./components/bodega_components/bodega-inventario/bodega-inventario.component').then(
        (m) => m.BodegaInventarioComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/imprimir-exhibiciones',
    loadComponent: () =>
      import('./components/bodega_components/modal-imprimir-exhibiciones/moda-imprimir-exhibiciones.component').then(
        (m) => m.ModalImprimirExhibicionesComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/creditos',
    loadComponent: () =>
      import('./pages/creditos/creditos.component').then(
        (m) => m.CreditosComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/historial-bodega',
    loadComponent: () =>
      import('./components/administracion_components/historial-bodega/historial-bodega.component').then(
        (m) => m.HistorialBodegaComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/mercancia-locales',
    loadComponent: () =>
      import('./services/administracion/admin-inventario-locales/admin-inventario-locales.component').then(
        (m) => m.AdminInventarioLocalesComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/historial-locales',
    loadComponent: () =>
      import('./components/administracion_components/historial-locales/historial-locales.component').then(
        (m) => m.HistorialLocalesComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/registro-diario',
    loadComponent: () =>
      import('./components/administracion_components/registro-diario/registro-diario.component').then(
        (m) => m.RegistroDiarioComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/ventas',
    loadComponent: () =>
      import('./pages/administracion/administration-ventas/administration-ventas.component').then(
        (m) => m.AdministrationVentasComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/personal',
    loadComponent: () =>
      import('./pages/administracion/administration-personal/administration-personal.component').then(
        (m) => m.AdministrationPersonalComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/metas',
    loadComponent: () =>
      import('./pages/administracion/metas/metas.component').then(
        (m) => m.MetasComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/mapa',
    loadComponent: () =>
      import('./pages/administracion/mapa-locales/mapa-locales.component').then(
        (m) => m.MapaLocalesComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/reposiciones',
    loadComponent: () =>
      import('./pages/administracion/reposicion/reposicion.component').then(
        (m) => m.ReposicionComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/locales',
    loadComponent: () =>
      import('./components/administracion_components/locales/locales.component').then(
        (m) => m.LocalesComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/prestamos',
    loadComponent: () =>
      import('./components/administracion_components/registroprestamos/registroprestamos.component').then(
        (m) => m.RegistroprestamosComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/pedidos',
    loadComponent: () =>
      import('./components/administracion_components/ver-pedidos-admin/ver-pedidos-admin.component').then(
        (m) => m.VerPedidosAdminComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/exhibiciones',
    loadComponent: () =>
      import('./components/administracion_components/exhibicion-admin/exhibicion-admin.component').then(
        (m) => m.ExhibicionAdminComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/prestamo-exhibiciones',
    loadComponent: () =>
      import('./components/administracion_components/prestamos-propios/prestamos-propios.component').then(
        (m) => m.PrestamosPropiosComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/nomina',
    loadComponent: () =>
      import('./components/administracion_components/nomina/nomina.component').then(
        (m) => m.NominaComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/descuadres',
    loadComponent: () =>
      import('./pages/administracion/descuadres/descuadres.component').then(
        (m) => m.DescuadresComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/cuadre-caja',
    loadComponent: () =>
      import('./pages/administracion/cuadre-caja/cuadre-caja.component').then(
        (m) => m.CuadreCajaComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/gastos',
    loadComponent: () =>
      import('./pages/administracion/gastos/gastos.component').then(
        (m) => m.GastosComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/proveedores',
    loadComponent: () =>
      import('./components/administracion_components/proveedores/proveedores.component').then(
        (m) => m.ProveedoresComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/proveedores/:id',
    loadComponent: () =>
      import('./components/administracion_components/proveedores/proveedor-detalle/proveedor-detalle.component').then(
        (m) => m.ProveedorDetalleComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/campanas',
    loadComponent: () =>
      import('./pages/administracion/campanas/campanas.component').then(
        (m) => m.CampanasComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/notificaciones',
    loadComponent: () =>
      import('./pages/administracion/notificaciones-ia/notificaciones-ia.component').then(
        (m) => m.NotificacionesIaComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/ia',
    loadComponent: () =>
      import('./components/administracion_components/ia/ia.component').then(
        (m) => m.IaComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/auditoria',
    loadComponent: () =>
      import('./pages/administracion/auditoria/auditoria-admin.component').then(
        (m) => m.AuditoriaAdminComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/auditoriabodega',
    loadComponent: () =>
      import('./pages/administracion/auditoria-bodega/auditoria-bodega-admin.component').then(
        (m) => m.AuditoriaBodegaAdminComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/llegadas',
    loadComponent: () =>
      import('./components/administracion_components/llegadas/llegadas.component').then(
        (m) => m.LlegadasComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },
  {
    path: 'admin/bonos',
    loadComponent: () =>
      import('./components/administracion_components/adminbonos/adminbonos.component').then(
        (m) => m.AdminbonosComponent,
      ),
    canActivate: [authGuard],
    data: { role: 'admin' },
  },

  { path: '**', redirectTo: 'home' },
];
