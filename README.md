# ShoeShop Inventory

Sistema web de **inventario y ventas para comercios de calzado**: bodega, locales, pedidos, préstamos, ventas por vendedor en tiempo real, catálogo para clientes y reportes. Versión de portafolio de un producto que opera en producción en varios comercios de Medellín, Colombia (cobro por instalación y mensualidad).

> **EN:** Inventory and sales management web app for footwear retailers (warehouse, stores, orders, loans, real-time sales per seller, public catalog, reports). Portfolio edition of a product running in production for several small businesses in Medellín, Colombia. Built with Angular 19, TypeScript, PrimeNG and Firebase.

Esta copia está **desanonimizada**: no incluye datos, credenciales, marcas ni historial de ningún cliente.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Angular 19 (standalone components, signals), TypeScript, RxJS, PrimeNG 19, Tailwind CSS 4 |
| Datos y autenticación | Firebase Authentication, Cloud Firestore, Firebase Storage |
| Backend | Cloud Functions (TypeScript): resúmenes de ventas, reportes por correo, notificaciones push |
| Otros | PWA (service worker), SSR, jsPDF y xlsx (reportes), ApexCharts / ECharts / Chart.js, ZXing (escaneo de códigos), servidor local de impresión térmica |

## Qué hace

- **Inventario por ubicación:** bodega, locales, exhibiciones y préstamos, con movimientos entre ellos.
- **Pedidos y ventas:** los vendedores solicitan pares, registran ventas y devoluciones; el administrador aprueba y audita.
- **Ventas en tiempo real por vendedor** mediante listeners de Firestore (AngularFire).
- **Catálogo público** para clientes finales.
- **Reportes** en PDF y Excel, gráficas y resumen diario por correo.
- **Roles** con guards de ruta (administrador, vendedor, bodega).
- **Asistente de consulta con IA** sobre los datos del negocio.

## Decisiones técnicas

**Consistencia del stock con transacciones.** Un mismo par puede estar en bodega, en un pedido, en un préstamo, vendido o en un local. Para que dos operaciones simultáneas no descuadren el inventario, los movimientos críticos (vender, aceptar un pedido, trasladar entre bodega y locales) se ejecutan con `runTransaction` de Firestore: se lee el documento, se valida el stock disponible y se escribe en una sola operación atómica. Si otro cliente modifica el documento entre tanto, Firestore reintenta la transacción.

**Reservas.** Al solicitar un pedido se compara la cantidad de pedidos pendientes de esa referencia y talla contra el stock de bodega, para no prometer más pares de los que existen.

**Lectura eficiente.** El listener de ventas se limita a las últimas 150 (`orderBy` + `limit`) y el resto se carga por demanda con cursor (`startAfter`). Los totales mensuales y anuales los mantiene una Cloud Function con `FieldValue.increment`, de modo que el cliente escucha un solo documento en lugar de recorrer todas las ventas.

**Auditoría.** Existe una verificación que reconstruye la ecuación de ingresos contra las ubicaciones del inventario y avisa cuando no cuadra.

## Estructura

```
src/app/
  pages/        Vistas por rol (administración, vendedor, bodega, créditos)
  components/   Componentes reutilizables por módulo
  services/     Acceso a Firestore, autenticación, ventas, inventario, reportes
  shared/       Utilidades y componentes comunes
functions/src/  Cloud Functions (resúmenes, reportes, notificaciones)
print-server/   Servidor local para impresión de etiquetas
```

## Cómo ejecutarlo

Requiere Node.js 20+ y un proyecto propio de Firebase (plan gratuito sirve para pruebas).

```bash
npm install
```

1. Crea un proyecto en Firebase y habilita Authentication, Firestore y Storage.
2. Reemplaza los valores `YOUR_*` en `src/app/app.config.ts`, `public/firebase-messaging-sw.js` y `src/environments/*.ts` con la configuración de **tu** proyecto.
3. Inicia el servidor de desarrollo:

```bash
npm start
```

Las claves de Supabase, Groq, Gemini y VAPID también son marcadores (`YOUR_*`). Sin ellas, los módulos de IA y notificaciones no funcionan, pero el resto de la aplicación sí.

## Limitaciones conocidas

Las dejo por escrito porque conocerlas es parte del trabajo:

- **Reglas de seguridad de Firestore no incluidas.** Debes definir las tuyas, con lectura solo para usuarios autenticados y escritura según rol (custom claims). Los guards de Angular solo ocultan vistas: no sustituyen las reglas.
- **Claves de proveedores de IA en el cliente.** En esta versión se usan desde el navegador. En producción deberían ir detrás de una Cloud Function que las guarde como secreto.
- **Pruebas automatizadas:** los archivos `.spec.ts` son los generados por Angular CLI y no representan cobertura real.
- **Estado:** conviven servicios con `BehaviorSubject` y signals; falta unificarlos y usar `takeUntilDestroyed` de forma consistente.
- **Operaciones de inventario en el cliente:** mover las más sensibles a Cloud Functions callable reduciría el riesgo de divergencias.

## Autor

**Santiago Valencia Valle**: Desarrollador Frontend Angular, Medellín, Colombia.
[LinkedIn](https://www.linkedin.com/in/santiago-valencia-valle-b7a97b32b/)
