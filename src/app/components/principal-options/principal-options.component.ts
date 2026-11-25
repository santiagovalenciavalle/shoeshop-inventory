import { Component, input, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-principal-options',
  imports: [
    CommonModule,
    ButtonModule,
    CardModule,
    DividerModule,
    RouterModule,
  ],
  templateUrl: './principal-options.component.html',
  styleUrl: './principal-options.component.css',
})
export class PrincipalOptionsComponent {
  @Input() icon!: string;
  @Input() title!: string;
  @Input() description!: string;
  @Input() buttonText!: string;
  @Input() ruta!: string;
}
