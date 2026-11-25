import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { VentasCreditoComponent } from './ventas-credito/ventas-credito.component';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-creditos',
  imports: [CommonModule, VentasCreditoComponent, RouterModule],
  templateUrl: './creditos.component.html',
  styleUrl: './creditos.component.css',
})
export class CreditosComponent {
  selected = '3m';
  credito: 'sistecredito' | 'addi' = 'sistecredito';

  select(option: '3m' | '1m') {
    this.selected = option;
    this.credito = option === '3m' ? 'sistecredito' : 'addi';
  }
}
