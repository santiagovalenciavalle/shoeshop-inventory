import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { RouterModule } from '@angular/router';
import { Prestamo } from '../../../pages/interfaces';
import { PrestamosService } from '../../../services/vendedorServices/prestamos/prestamos.service';

@Component({
  selector: 'app-admin-prestamos',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    TableModule,
    SelectModule,
    ButtonModule,
    InputTextModule,
    TagModule,
    RouterModule,
  ],
  templateUrl: './admin-prestamos.component.html',
  styleUrl: './admin-prestamos.component.css',
})
export class AdminPrestamosComponent implements OnInit {
  selectedLocal: any = null;
  prestamos: Prestamo[] = [];
  prestamosFiltrados: Prestamo[] = [];

  locales = [
    { label: 'Todos los locales', value: null },
    { label: '02', value: '02' },
    { label: '03', value: '03' },
    { label: '180', value: '180' },
  ];

  constructor(private prestamosService: PrestamosService) {}

  ngOnInit(): void {
    this.prestamosService.registrar();
    this.scrollToTop();
    this.prestamosService.getPrestamos$().subscribe((data) => {
      this.prestamos = data.map((p) => ({
        ...p,
        fechaPrestamo: this.parseFirestoreDate(p.fechaPrestamo),
      }));
      this.filtrarPrestamos();
    });
  }

  ngOnDestroy(): void {
    this.prestamosService.desregistrar();
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  filtrarPrestamos(): void {
    if (this.selectedLocal) {
      this.prestamosFiltrados = this.prestamos.filter(
        (p) =>
          p.localInicio === this.selectedLocal ||
          p.localPrestado === this.selectedLocal,
      );
    } else {
      this.prestamosFiltrados = [...this.prestamos];
    }
  }

  private parseFirestoreDate(value: any): Date | undefined {
    return value?.toDate ? value.toDate() : value;
  }
}
