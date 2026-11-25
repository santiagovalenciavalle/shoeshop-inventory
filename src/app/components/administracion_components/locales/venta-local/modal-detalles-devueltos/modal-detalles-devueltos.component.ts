import {
  ChangeDetectorRef,
  Component,
  Input,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';
import { RippleModule } from 'primeng/ripple';
import { SkeletonModule } from 'primeng/skeleton';
import { Venta } from '../../../../../pages/interfaces';
import { SalesService } from '../../../../../services/vendedorServices/ventas/sales.service';

@Component({
  selector: 'app-modal-detalles-devueltos',
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    AvatarModule,
    TagModule,
    RippleModule,
    SkeletonModule,
  ],
  templateUrl: './modal-detalles-devueltos.component.html',
  styleUrl: './modal-detalles-devueltos.component.css',
})
export class ModalDetallesDevueltosComponent {
  constructor(
    private salesService: SalesService,
    private cdr: ChangeDetectorRef
  ) {}

  visible: boolean = false;
  @Input() venta!: Venta | undefined;
  productoDevuelto: Venta | undefined;

  mostrar() {
    this.visible = true;
  }

  ngOnInit() {
    this.salesService.initVentas();
    if (this.venta?.productoDevueltoId) {
      this.traerProductoDevuelto(this.venta.productoDevueltoId);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['venta'] && changes['venta'].currentValue) {
      const nuevaVenta: Venta = changes['venta'].currentValue;
      if (
        !this.productoDevuelto ||
        this.productoDevuelto.id !== nuevaVenta.productoDevueltoId
      ) {
        this.traerProductoDevuelto(nuevaVenta.productoDevueltoId);
      }
    }
  }

  traerProductoDevuelto(id: string) {
    this.salesService.buscarVentaPorId(id).then((productoDevuelto) => {
      if (productoDevuelto) {
        if (
          productoDevuelto.fechaVenta &&
          (productoDevuelto.fechaVenta as any).toDate
        ) {
          productoDevuelto.fechaVenta = (
            productoDevuelto.fechaVenta as any
          ).toDate();
        }

        setTimeout(() => {
          this.productoDevuelto = productoDevuelto;
          this.cdr.detectChanges();
        }, 1000);
      } else {
        console.warn('No se encontró el producto devuelto con ID:', id);
      }
    });
  }

  cerrar() {
    this.visible = false;
  }
}
