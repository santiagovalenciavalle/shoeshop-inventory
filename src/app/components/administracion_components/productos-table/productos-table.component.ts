import { Component, Input } from '@angular/core';
import { Products } from '../../../pages/interfaces';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { FloatLabel } from 'primeng/floatlabel';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-productos-table',
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    FloatLabel,
    FormsModule,
    InputTextModule,
  ],
  templateUrl: './productos-table.component.html',
  styleUrl: './productos-table.component.css',
})
export class ProductosTableComponent {
  @Input() productosFiltrados: Products[] = [];
  @Input() products: Products[] = [];
  filtro: string = '';
  filtrarProductos(): void {
    const texto = this.filtro.toLowerCase().trim();

    this.productosFiltrados = this.products.filter(
      (p) =>
        p.referencia?.toLowerCase().includes(texto) ||
        p.id?.toString().includes(texto) ||
        p.marca?.toLowerCase().includes(texto)
    );
  }
}
