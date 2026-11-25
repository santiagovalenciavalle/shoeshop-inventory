import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  ChangeDetectorRef,
} from '@angular/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';
import { RippleModule } from 'primeng/ripple';
import { CommonModule } from '@angular/common';

import { Notification } from '../../../pages/interfaces';
import { NotificationsService } from '../../../services/notifications/notifications.service';
import { Subscription } from 'rxjs';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [
    CardModule,
    ButtonModule,
    TagModule,
    AvatarModule,
    DividerModule,
    TooltipModule,
    RippleModule,
    CommonModule,
    RouterModule,
  ],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css'],
})
export class NotificationsComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  private subscription!: Subscription;
  @Input() esBodega = false;

  constructor(
    private notificationsService: NotificationsService,
    private cdr: ChangeDetectorRef,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.subscription = this.notificationsService.notifications$.subscribe(
      (notis) => {
        if (this.esBodega) {
          this.notifications = notis.filter(
            (n) =>
              n.tipo === 'venta-exhibicion' ||
              n.tipo === 'prestamo-exhibicion' ||
              n.tipo === 'cambio-exhibicion',
          );
        } else {
          this.notifications = notis.filter(
            (n) =>
              n.tipo !== 'venta-exhibicion' &&
              n.tipo !== 'prestamo-exhibicion' &&
              n.tipo !== 'cambio-exhibicion',
          );
        }
        this.cdr.detectChanges();
      },
    );
  }

  removeNotification(id: number | string): void {
    this.notificationsService.eliminarNotificacion(id);
  }

  enviarExhibicion(noti: Notification): void {
    this.router.navigate(['/bodega/sendExhibicion'], {
      state: { notificacion: noti },
    });
  }

  get totalNotificaciones(): number {
    return this.notifications.filter((n) => n.nueva).length;
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
