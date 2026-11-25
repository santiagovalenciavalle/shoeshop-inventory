import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LlegadasService,
  RegistroLlegada,
} from '../../../services/administracion/llegadas/llegadas.service';

import { IaLoaderComponent } from '../../../shared/components/ia-loader/ia-loader.component';
@Component({
  selector: 'app-llegadas',
  imports: [
    IaLoaderComponent,CommonModule, FormsModule],
  templateUrl: './llegadas.component.html',
  styleUrl: './llegadas.component.css',
})
export class LlegadasComponent {
  llegadas: RegistroLlegada[] = [];
  loading = true;
  fechaSeleccionada: string = '';

  constructor(private llegadasService: LlegadasService) {}

  ngOnInit(): void {
    this.scrollToTop();
    const hoy = new Date();
    this.fechaSeleccionada = this.toInputDate(hoy);
    this.cargarLlegadas(hoy);
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private toInputDate(fecha: Date): string {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async onFechaChange(): Promise<void> {
    if (!this.fechaSeleccionada) return;
    const [y, m, d] = this.fechaSeleccionada.split('-').map(Number);
    const fecha = new Date(y, m - 1, d);
    await this.cargarLlegadas(fecha);
  }

  private async cargarLlegadas(fecha: Date): Promise<void> {
    this.loading = true;
    this.llegadas = [];
    try {
      this.llegadas = await this.llegadasService.getLlegadasPorFecha(fecha);
    } catch (err) {
      console.error('Error cargando llegadas:', err);
    } finally {
      setTimeout(() => (this.loading = false), 1500);
    }
  }

  getInitial(nombre: string): string {
    return nombre?.trim().charAt(0).toUpperCase() || '?';
  }

  getAvatarClass(rol: string): string {
    switch (rol) {
      case 'admin':
        return 'avatar-admin';
      case 'bodega':
        return 'avatar-bodega';
      default:
        return 'avatar-vendedor';
    }
  }

  getRolLabel(rol: string): string {
    switch (rol) {
      case 'admin':
        return 'Administrador';
      case 'bodega':
        return 'Bodega';
      case 'vendedor':
        return 'Vendedor';
      default:
        return rol;
    }
  }

  get fechaDisplay(): string {
    if (!this.fechaSeleccionada) return '';
    const [y, m, d] = this.fechaSeleccionada.split('-').map(Number);
    const fecha = new Date(y, m - 1, d);
    const hoy = new Date();
    const esHoy =
      fecha.getDate() === hoy.getDate() &&
      fecha.getMonth() === hoy.getMonth() &&
      fecha.getFullYear() === hoy.getFullYear();

    if (esHoy) return 'Hoy';

    return fecha.toLocaleDateString('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  irAHoy(): void {
    const hoy = new Date();
    this.fechaSeleccionada = this.toInputDate(hoy);
    this.cargarLlegadas(hoy);
  }
}
