import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-estado-inventario',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="p-5 rounded-2xl shadow hover:shadow-md transition-all bg-white dark:bg-gray-800 border-t-4 border-yellow-500"
    >
      <h3 class="text-sm font-semibold mb-2">Estado del Inventario</h3>
      <ul class="space-y-1 text-sm">
        <li class="text-red-400">🔴 Stock Bajo - {{ stockBajo }} productos</li>
        <li class="text-yellow-400">
          🟡 Stock Medio - {{ stockMedio }} productos
        </li>
        <li class="text-green-400">
          🟢 Stock Alto - {{ stockAlto }} productos
        </li>
      </ul>
    </div>
  `,
})
export class EstadoInventarioComponent {
  @Input() stockBajo: number = 0;
  @Input() stockMedio: number = 0;
  @Input() stockAlto: number = 0;
}
