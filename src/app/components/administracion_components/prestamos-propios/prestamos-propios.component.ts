import { Component, OnInit } from '@angular/core';
import { ExhibicionesService } from '../../../services/vendedorServices/exhibiciones/exhibiciones.service';
import { exhibiciones } from '../../../pages/interfaces';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { IaLoaderComponent } from '../../../shared/components/ia-loader/ia-loader.component';
@Component({
  selector: 'app-prestamos-propios',
  standalone: true,
  imports: [
    IaLoaderComponent,CommonModule, RouterModule],
  templateUrl: './prestamos-propios.component.html',
  styleUrls: ['./prestamos-propios.component.css'],
})
export class PrestamosPropiosComponent implements OnInit {
  exhibiciones$!: Observable<exhibiciones[]>;

  exhibicionesSolicitadas: exhibiciones[] = [];
  exhibicionesAceptadas: exhibiciones[] = [];
  exhibicionesPendienteDevolucion: exhibiciones[] = [];

  loading = true;

  panelAbierto: { [id: string]: boolean } = {};

  constructor(private exhibicionesService: ExhibicionesService) {}

  ngOnInit(): void {
    this.exhibiciones$ = this.exhibicionesService.getExhibicionesPorFuera$();

    this.exhibiciones$.subscribe((exhibiciones) => {
      this.exhibicionesSolicitadas = exhibiciones.filter(
        (e) => e.estado === 'solicitado',
      );

      this.exhibicionesAceptadas = exhibiciones.filter(
        (e) => e.estado === 'prestamo aceptado',
      );

      this.exhibicionesPendienteDevolucion = exhibiciones.filter(
        (e) => e.estado === 'pendiente devolucion',
      );

      this.loading = false;
    });
  }

  formatLocales(locales?: string[]): string {
    return locales ? locales.join(', ') : '-';
  }

  togglePanel(id?: string, index?: number) {
    const key = id || String(index);
    this.panelAbierto[key] = !this.panelAbierto[key];
  }

  isPanelOpen(id?: string, index?: number): boolean {
    const key = id || String(index);
    return !!this.panelAbierto[key];
  }
}
