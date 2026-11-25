import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { NavigationService } from '../../../services/navigation.service';
import { AuthService } from '../../../services/auth/auth.service';

import gsap from 'gsap';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('homeRoot') private homeRoot!: ElementRef<HTMLElement>;
  @ViewChild('sneakerImg') private sneakerImg!: ElementRef<HTMLImageElement>;
  @ViewChild('accesoSection') private accesoSection!: ElementRef<HTMLElement>;

  anioActual = new Date().getFullYear();

  private entranceTl: gsap.core.Timeline | null = null;
  private floatTl: gsap.core.Tween | null = null;

  private navService = inject(NavigationService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  async ngOnInit(): Promise<void> {
    this.navService.setPreviousUrl('/home');
    this.authService.logout();
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0 });
    }
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (reduced) return;

    const root = this.homeRoot?.nativeElement;
    const img = this.sneakerImg?.nativeElement;
    if (!root) return;

    const items = root.querySelectorAll('.hm-reveal');

    // Una sola secuencia de entrada: el texto sube y la zapatilla aparece.
    this.entranceTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    this.entranceTl.from(items, {
      opacity: 0,
      y: 16,
      duration: 0.6,
      stagger: 0.08,
    });

    if (img) {
      this.entranceTl.from(
        img,
        { opacity: 0, x: 40, rotate: -4, duration: 0.9, ease: 'expo.out' },
        0.1,
      );
    }
  }

  ngOnDestroy(): void {
    this.entranceTl?.kill();
    this.floatTl?.kill();
  }

  irAAcceso(): void {
    this.accesoSection?.nativeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  selectRole(role: string): void {
    this.authService.logout();

    const routes: Record<string, string> = {
      administrador: '/login_admin',
      vendedor: '/login_vendedor',
      bodega: '/login_bodega',
    };

    const route = routes[role];
    if (route) this.router.navigate([route]);
  }

  cerrarsesion(): void {
    this.authService.logout();
  }
}
