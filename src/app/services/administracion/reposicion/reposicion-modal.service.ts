import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AlertaReposicion, ReposicionService } from './reposicion.service';

interface CacheReposicion {
  fecha: string;
  alertas: AlertaReposicion[];
  mostradoAutomatico: boolean;
}

const CACHE_PREFIX = 'reposicion-modal-';
const MAX_ALERTAS_MODAL = 4;

@Injectable({ providedIn: 'root' })
export class ReposicionModalService {
  private reposicionService = inject(ReposicionService);

  private alertasSubject = new BehaviorSubject<AlertaReposicion[]>([]);
  alertas$ = this.alertasSubject.asObservable();

  private mostrarSubject = new BehaviorSubject<boolean>(false);
  mostrar$ = this.mostrarSubject.asObservable();

  private cargandoSubject = new BehaviorSubject<boolean>(false);
  cargando$ = this.cargandoSubject.asObservable();

  async verificarRecomendacionDelDia(): Promise<void> {
    const cache = this.leerCache();

    if (cache) {
      this.alertasSubject.next(cache.alertas);
      if (!cache.mostradoAutomatico && cache.alertas.length > 0) {
        this.mostrarSubject.next(true);
        this.guardarCache({ ...cache, mostradoAutomatico: true });
      }
      return;
    }

    await this.recalcular(true);
  }

  async mostrarManualmente(): Promise<void> {
    const cache = this.leerCache();

    if (cache) {
      this.alertasSubject.next(cache.alertas);
      this.mostrarSubject.next(true);
      return;
    }

    await this.recalcular(true);
  }

  cerrar(): void {
    this.mostrarSubject.next(false);
  }

  private async recalcular(mostrar: boolean): Promise<void> {
    this.cargandoSubject.next(true);
    try {
      const todas = await this.reposicionService.calcularAlertas();
      const top4 = todas.slice(0, MAX_ALERTAS_MODAL);

      this.guardarCache({
        fecha: this.hoyKey(),
        alertas: top4,
        mostradoAutomatico: mostrar,
      });

      this.alertasSubject.next(top4);
      if (mostrar && top4.length > 0) this.mostrarSubject.next(true);
    } catch (error) {
      console.error('Error calculando recomendaciones de reposición:', error);
    } finally {
      this.cargandoSubject.next(false);
    }
  }

  private hoyKey(): string {
    return new Date().toISOString().split('T')[0];
  }

  private leerCache(): CacheReposicion | null {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + this.hoyKey());
      return raw ? (JSON.parse(raw) as CacheReposicion) : null;
    } catch {
      return null;
    }
  }

  private guardarCache(cache: CacheReposicion): void {
    try {
      localStorage.setItem(CACHE_PREFIX + cache.fecha, JSON.stringify(cache));
    } catch {}
  }
}
