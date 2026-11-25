import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Bono } from '../../../pages/interfaces';
import { Subscription } from 'rxjs';
import { BonosService } from '../../../services/vendedorServices/bonos/bonos.service';

import { IaSpinnerComponent } from '../../../shared/components/ia-loader/ia-spinner.component';
import { IaLoaderComponent } from '../../../shared/components/ia-loader/ia-loader.component';
@Component({
  selector: 'app-adminbonos',
  imports: [
    IaLoaderComponent,
    IaSpinnerComponent,CommonModule],
  templateUrl: './adminbonos.component.html',
  styleUrl: './adminbonos.component.css',
})
export class AdminbonosComponent {
  bonos: Bono[] = [];
  cargando = true;

  bonoAEliminar: Bono | null = null;
  eliminando = false;

  private sub!: Subscription;

  constructor(private bonosService: BonosService) {}

  ngOnInit(): void {
    this.scrollToTop();
    this.sub = this.bonosService.getBonos().subscribe((data) => {
      this.bonos = data.sort((a, b) => {
        const fechaA = this.getTime(a.producto?.fechaVenta);
        const fechaB = this.getTime(b.producto?.fechaVenta);

        return fechaB - fechaA;
      });

      setTimeout(() => {
        this.cargando = false;
      }, 1500);
    });
  }
  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private getTime(fecha: any): number {
    if (!fecha) return 0;

    if (typeof fecha.toDate === 'function') {
      return fecha.toDate().getTime();
    }

    return new Date(fecha).getTime();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  confirmarEliminar(bono: Bono): void {
    this.bonoAEliminar = bono;
  }

  cancelarEliminar(): void {
    if (this.eliminando) return;
    this.bonoAEliminar = null;
  }

  async eliminarConfirmado(): Promise<void> {
    if (!this.bonoAEliminar) return;
    this.eliminando = true;
    try {
      await this.bonosService.borrarBono(this.bonoAEliminar.id);
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => {
        this.eliminando = false;
      }, 1000);
      this.bonoAEliminar = null;
    }
  }

  get totalBonos(): number {
    return this.bonos.reduce((acc, b) => acc + (b.precioBono || 0), 0);
  }

  formatearFecha(fecha: any): string {
    if (!fecha) return '—';
    const d = fecha?.toDate ? fecha.toDate() : new Date(fecha);
    return d.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  formatearPrecio(valor: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(valor);
  }
}
