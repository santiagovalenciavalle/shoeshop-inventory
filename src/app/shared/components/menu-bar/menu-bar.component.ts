import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input, NgZone } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { SidebarModule } from 'primeng/sidebar';
import { PanelMenuModule } from 'primeng/panelmenu';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../../services/auth/auth.service';

@Component({
  selector: 'app-menu-bar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SidebarModule,
    PanelMenuModule,
    ButtonModule,
  ],
  templateUrl: './menu-bar.component.html',
  styleUrl: './menu-bar.component.css',
})
export class MenuBarComponent {
  @Input() menuItems: MenuItem[] = [];
  @Input() brand: string = 'SHOESHOP';

  showSidebar = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private cdRef: ChangeDetectorRef,
    private zone: NgZone
  ) {}

  handleItemClick(item: MenuItem) {
    if (item.routerLink) {
      this.router.navigate([item.routerLink]);
    }

    if (item.label?.toLowerCase() === 'salir') {
      this.authService.logout();
    }

    this.showSidebar = false;
  }

  abrirSidenar() {
    this.zone.run(() => {
      this.showSidebar = true;
      this.cdRef.detectChanges();
    });
  }
}
