import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { AuthService } from '../../../services/auth/auth.service';

@Component({
  selector: 'app-welcome',
  imports: [CommonModule, CardModule, ButtonModule, RouterModule],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.css',
})
export class WelcomeComponent {
  nombreVendedor: string = '';
  local: string = '';

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.setNombreVendedor();
  }

  private setNombreVendedor(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.nombreVendedor = user.name;
      this.local = user.local;
    }
  }
}
