import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';

export type FuncionServidor =
  | 'consultarCalendario'
  | 'sugerirPrecios'
  | 'analizarDescuadres'
  | 'consultarCuadresPendientes'
  | 'resumenMananaManual'
  | 'crearCampanaManual';

/**
 * Llama a las funciones de análisis del servidor (calendario comercial, precios,
 * descuadres de inventario, cuadres pendientes). Solo administradores.
 */
@Injectable({ providedIn: 'root' })
export class IaFuncionesService {
  private functions = inject(Functions);
  private injector = inject(Injector);

  async llamar<T = any>(nombre: FuncionServidor, datos: Record<string, any> = {}): Promise<T> {
    try {
      const r = await runInInjectionContext(this.injector, () =>
        httpsCallable<any, T>(this.functions, nombre, { timeout: 300_000 })(datos),
      );
      return r.data;
    } catch (e: any) {
      const codigo = String(e?.code ?? '').replace('functions/', '');
      const mensaje =
        codigo === 'permission-denied'
          ? 'Solo los administradores pueden usar esta función.'
          : codigo === 'unauthenticated'
            ? 'Tu sesión expiró. Vuelve a iniciar sesión.'
            : codigo === 'not-found'
              ? 'Esta función aún no está desplegada en el servidor.'
              : (e?.message ?? 'No se pudo completar la consulta.');
      throw new Error(mensaje);
    }
  }
}
