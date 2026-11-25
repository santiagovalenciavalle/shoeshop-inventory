import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth/auth.service';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SalesService } from '../../../services/vendedorServices/ventas/sales.service';
import { PushNotificationService } from '../../../services/notifications push/push-notification.service';
import { LlegadasService } from '../../../services/administracion/llegadas/llegadas.service';
import { SinActivacionService } from '../../../services/administracion/sinactivacion/sin-activacion.service';

import { IaSpinnerComponent } from '../ia-loader/ia-spinner.component';
const TRABAJO_LAT = 6.2442; // latitud
const TRABAJO_LNG = -75.5812; // longitud

const RADIO_METROS = 500;
type PantallaActual =
  | 'login'
  | 'bienvenida'
  | 'ubicacion'
  | 'confirmacion'
  | 'splash';
@Component({
  selector: 'app-login',
  imports: [
    IaSpinnerComponent,
    RouterModule,
    ReactiveFormsModule,
    PasswordModule,
    InputTextModule,
    ButtonModule,
    CommonModule,
    ToastModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  providers: [MessageService],
})
export class LoginComponent {
  loginForm: FormGroup;
  titulo: string = '';
  subtitulo: string = '';
  demoCredentials: string = '';
  rol: 'vendedor' | 'bodega' | 'admin' | '' = '';
  loading: boolean = false;

  pantalla: PantallaActual = 'login';
  cargandoUbicacion = false;
  errorUbicacion = '';
  usuarioLogueado: any = null;
  animandoSalida = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private authService: AuthService,
    public router: Router,
    private messageService: MessageService,
    private salesService: SalesService,
    private notificationService: PushNotificationService,
    private llegadasService: LlegadasService,
    private sinActivacionService: SinActivacionService,
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
    this.route.data.subscribe((data) => {
      this.updateText(data['role']);
      this.rol = data['role'];
    });
  }

  ngOnInit() {
    this.scrollToTop();
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  updateText(role: 'vendedor' | 'bodega' | 'admin') {
    switch (role) {
      case 'vendedor':
        this.titulo = 'Portal de Vendedores';
        this.subtitulo = 'Ingrese sus credenciales de vendedor';
        this.demoCredentials = 'Vendedor: sara@calzadoapp.com / vendedor';
        break;
      case 'bodega':
        this.titulo = 'Portal de Bodega';
        this.subtitulo = 'Ingrese sus credenciales de bodega';
        this.demoCredentials = 'Bodega: carlos@calzadoapp.com / bodega';
        break;
      case 'admin':
        this.titulo = 'Panel de Administración';
        this.subtitulo = 'Ingrese sus credenciales de administrador';
        this.demoCredentials = 'Admin: admin@calzadoapp.com / admin';
        break;
    }
  }

  async Submit() {
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;
      this.loading = true;

      try {
        const success = await this.authService.login(email, password, this.rol);

        if (success) {
          if (this.rol === 'admin') {
            this.salesService.initVentas();
          }

          await this.notificationService.inicializarNotificaciones();

          if (this.rol === 'vendedor' || this.rol === 'bodega') {
            const user = this.authService.getCurrentUser();
            this.usuarioLogueado = user;

            await this.sinActivacionService.cargarIds();
            const idsSinActivacion = this.sinActivacionService.idsActuales;

            if (idsSinActivacion.includes(user?.id)) {
              this.navegarAlRol();
              return;
            }

            const yaRegistro = await this.llegadasService.yaRegistroHoy(
              user?.id,
            );

            if (!yaRegistro) {
              this.irAPantalla('bienvenida');
              return;
            }
          }

          this.navegarAlRol();
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Acceso denegado',
            detail:
              'Credenciales inválidas, usuario inactivo o acceso no permitido a esta sección.',
          });
        }
      } catch (error) {
        console.error(error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Hubo un problema al iniciar sesión.',
        });
      } finally {
        this.loading = false;
      }
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Completa todos los campos',
        detail: 'Acceso no permitido a esta sección.',
      });
    }
  }

  irAPantalla(nueva: PantallaActual) {
    this.animandoSalida = true;
    setTimeout(() => {
      this.pantalla = nueva;
      this.animandoSalida = false;
      this.errorUbicacion = '';
    }, 350);
  }

  async solicitarUbicacion() {
    this.cargandoUbicacion = true;
    this.errorUbicacion = '';

    if (!navigator.geolocation) {
      this.errorUbicacion = 'Tu dispositivo no soporta geolocalización.';
      this.cargandoUbicacion = false;
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const distancia = this.calcularDistancia(
          latitude,
          longitude,
          TRABAJO_LAT,
          TRABAJO_LNG,
        );

        if (distancia <= RADIO_METROS) {
          await this.registrarLlegada();
          this.irAPantalla('confirmacion');
        } else {
          this.errorUbicacion = `Tu ubicación no coincide con la de ShoeShop (${Math.round(distancia)}m de distancia). Intenta nuevamente cuando hayas llegado.`;
        }

        this.cargandoUbicacion = false;
      },
      (error) => {
        this.cargandoUbicacion = false;
        switch (error.code) {
          case error.PERMISSION_DENIED:
            this.errorUbicacion =
              'Permiso de ubicación denegado. Debes aceptarlo para continuar.';
            break;
          case error.POSITION_UNAVAILABLE:
            this.errorUbicacion = 'Ubicación no disponible. Verifica tu GPS.';
            break;
          default:
            this.errorUbicacion =
              'No se pudo obtener tu ubicación. Intenta nuevamente.';
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  private async registrarLlegada() {
    const user = this.usuarioLogueado;
    if (!user) return;

    const ahora = new Date();
    const fecha = ahora.toLocaleDateString('es-CO');
    const hora = ahora.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
    });

    try {
      await this.llegadasService.registrarLlegada({
        nombre: user.name,
        trabajadorId: user.id,
        local: user.local || user.numeroBodega || 'N/A',
        fecha,
        hora,
        rol: user.role,
      });

      await this.notificationService.enviarNotificacionAAdmins({
        title: '🟢 Registro de llegada',
        body: `${user.name} ha registrado su llegada al trabajo. Hora: ${hora}`,
        data: {
          trabajadorId: user.id,
          rol: user.role,
          tipo: 'registro-llegada',
        },
      });
    } catch (err) {
      console.error('Error registrando llegada:', err);
    }
  }

  get horaActual(): string {
    return new Date().toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  get fechaActual(): string {
    return new Date().toLocaleDateString('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  navegarAlRol() {
    this.irAPantalla('splash');
  }
  private calcularDistancia(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
