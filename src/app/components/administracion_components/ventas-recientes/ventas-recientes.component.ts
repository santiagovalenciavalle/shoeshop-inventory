import { Component, Input, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { Venta } from '../../../pages/interfaces';

@Component({
  selector: 'app-ventas-recientes',
  standalone: true,
  imports: [CommonModule, TableModule],
  templateUrl: './ventas-recientes.component.html',
})
export class VentasRecientesComponent {
  @Input() ventas: Venta[] = [];
  ventasRecientes: Venta[] = [];
  isFirebaseTimestamp(obj: any): obj is { toDate: () => Date } {
    return obj && typeof obj.toDate === 'function';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ventas'] && this.ventas) {
      const ventasConFecha = this.ventas.map((venta) => {
        const fecha = this.isFirebaseTimestamp(venta.fechaVenta)
          ? venta.fechaVenta.toDate()
          : new Date(venta.fechaVenta);

        return { ...venta, fechaVenta: fecha };
      });

      this.ventasRecientes = [...ventasConFecha]
        .sort((a, b) => b.fechaVenta.getTime() - a.fechaVenta.getTime())
        .slice(0, 3);
    }
  }
  mouseX: number = 0;
  mouseY: number = 0;

  onMouseMove(event: MouseEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.mouseX = (event.clientX - rect.left) / rect.width;
    this.mouseY = (event.clientY - rect.top) / rect.height;
  }

  getCard3DTransform(index: number) {
    const offsetX = (this.mouseX - 0.5) * 15;
    const offsetY = (this.mouseY - 0.5) * 15;
    const depth = (index - 1) * 8;
    const rotateX = (this.mouseY - 0.5) * 10;
    const rotateY = (this.mouseX - 0.5) * 10;
    return `translate3d(${offsetX - depth}px, ${offsetY - depth}px, 0) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  }
}
