import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Products } from '../../../../pages/interfaces';
import { BadgeModule } from 'primeng/badge';
import { AuthService } from '../../../../services/auth/auth.service';

@Component({
  selector: 'app-list',
  imports: [CommonModule, ButtonModule, BadgeModule],
  templateUrl: './list.component.html',
  styleUrl: './list.component.css',
})
export class ListComponent {
  @Input() productosFiltrados: any;
  @Input() trackById: any;
  @Output() productoSeleccionado: EventEmitter<Products> =
    new EventEmitter<Products>();

  user: any;
  constructor(private authService: AuthService) {}
  ngOnInit(): void {
    this.user = this.authService.getCurrentUser();
  }
  verDetalles(producto: Products) {
    this.productoSeleccionado.emit(producto);
  }
}
