import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationService } from '../../services/navigation.service';
import { RouterModule } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { OtherSitesComponent } from '../../components/administracion_components/other-sites/other-sites.component';
import { AuthService } from '../../services/auth/auth.service';
import { VendedorHomeComponent } from './vendedor-home/vendedor-home.component';

@Component({
  selector: 'app-vendedor',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    DialogModule,
    ButtonModule,
    OtherSitesComponent,
    VendedorHomeComponent,
  ],
  templateUrl: './vendedor.component.html',
  styleUrls: ['./vendedor.component.css'],
})
export class VendedorComponent implements OnInit {
  isLoading: boolean = true;
  isAdmin: boolean = false;
  onboardingVisible: boolean = false;
  stepIndex: number = 0;
  user: any;
  constructor(
    private navigationService: NavigationService,
    private authService: AuthService,
  ) {}

  ngOnInit() {
    window.scrollTo(0, 0);
    this.navigationService.setPreviousUrl('/vendedor');
    this.checkOnboardingStatus();
    this.user = this.authService.getCurrentUser();
    if (this.user.role === 'admin') {
      this.isAdmin = true;
    }
    const hasShownLoader = sessionStorage.getItem('hasShownVendedorLoader');
    if (hasShownLoader) {
      this.isLoading = false;
    } else {
      this.isLoading = true;
      sessionStorage.setItem('hasShownVendedorLoader', 'true');
      setTimeout(() => {
        this.isLoading = false;
      }, 3000);
    }
  }

  checkOnboardingStatus() {
    const hasSeenOnboarding = sessionStorage.getItem('hasSeenOnboarding');

    if (!hasSeenOnboarding) {
      this.onboardingVisible = true;
      sessionStorage.setItem('hasSeenOnboarding', 'true');
    }
  }
}
