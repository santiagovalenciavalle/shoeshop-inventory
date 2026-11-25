import { Injector, runInInjectionContext } from '@angular/core';

/**
 * Ejecuta una llamada de AngularFire dentro del contexto de inyección de Angular.
 *
 * Fuera de ese contexto AngularFire no puede usar la zona de Angular y avisa en consola
 * ("Firebase API called outside injection context"). Las escuchas en tiempo real
 * (`collectionData`, `docData`, `onSnapshot`) son las más importantes: así sus conexiones y
 * temporizadores corren fuera de la zona y no disparan detección de cambios innecesaria.
 */
export function enContexto<T>(injector: Injector, fn: () => T): T {
  return runInInjectionContext(injector, fn);
}
