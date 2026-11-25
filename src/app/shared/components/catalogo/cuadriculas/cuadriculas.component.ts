import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  EventEmitter,
  Inject,
  Input,
  Output,
  PLATFORM_ID,
  SimpleChanges,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Products } from '../../../../pages/interfaces';
import { BadgeModule } from 'primeng/badge';
import { SkeletonModule } from 'primeng/skeleton';
import { AuthService } from '../../../../services/auth/auth.service';
import { ImageModule } from 'primeng/image';
import { AppendToBodyDirective } from '../../../directives/append-to-body.directive';

@Component({
  selector: 'app-cuadriculas',
  imports: [
    CommonModule,
    ButtonModule,
    BadgeModule,
    SkeletonModule,
    ImageModule,
    AppendToBodyDirective,
  ],
  templateUrl: './cuadriculas.component.html',
  styleUrl: './cuadriculas.component.css',
})
export class CuadriculasComponent {
  @Input() productosFiltrados: any;
  @Input() trackById: any;
  @Input() loading = true;
  user: any;
  esVendedor = false;
  constructor(private authService: AuthService) {}
  productosOrdenados: any[] = [];
  imagenAmpliada: { url: string; alt: string } | null = null;
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productosFiltrados']) {
      this.productosOrdenados = [...this.productosFiltrados].sort(
        (a, b) => b.id - a.id,
      );
    }
  }

  ngOnInit(): void {
    this.user = this.authService.getCurrentUser();
    this.esVendedor =
      this.user?.role === 'vendedor' || this.user?.role === 'admin';
  }

  /** Tallas con unidades disponibles, ordenadas de menor a mayor. */
  tallasDe(producto: any): number[] {
    const t = producto?.tallasDisponibles || {};
    return Object.keys(t)
      .filter((k) => Number(t[k]) > 0)
      .map(Number)
      .sort((a, b) => a - b);
  }

  stockBajo(producto: any): boolean {
    return (producto?.stock ?? 0) > 0 && producto.stock <= 3;
  }
  trackByIndex(index: number): number {
    return index;
  }
  @Output() productoSeleccionado: EventEmitter<Products> =
    new EventEmitter<Products>();
  abrirImagen(producto: Products, event: Event): void {
    event.stopPropagation();
    this.imagenAmpliada = {
      url: producto.imagen || '/logo.svg',
      alt: 'Imagen del producto',
    };
  }

  cerrarImagen(): void {
    this.imagenAmpliada = null;
  }
  verDetalles(producto: Products) {
    this.productoSeleccionado.emit(producto);
  }
}
