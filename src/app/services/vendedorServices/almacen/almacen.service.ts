import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AlmacenService {
  private productos: any[] = [
    {
      id: '6',
      marca: 'Hugo Boss',
      referencia: 'Burbuja negro x cafe',
      imagen: 'images/boss_burbuja_cafe.jpg',
      tallas: [{ numero: 40, cantidad: 5 }],
      local: '180',
    },
  ];

  constructor() {}

  getProductos() {
    return this.productos;
  }

  agregarProducto(producto: any) {
    this.productos.push(producto);
  }
}
