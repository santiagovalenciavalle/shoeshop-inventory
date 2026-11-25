import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-venta-detalles-dialog',
  imports: [CommonModule, DialogModule, ButtonModule],
  templateUrl: './venta-detalles-dialog.component.html',
  styleUrls: ['./venta-detalles-dialog.component.css'],
})
export class VentaDetallesDialogComponent {
  @Input() visible: boolean = false;
  @Input() venta: any;
  @Input() onClose!: () => void;

  getDialogWidth() {
    return window.innerWidth < 600 ? '90vw' : '450px';
  }
}
