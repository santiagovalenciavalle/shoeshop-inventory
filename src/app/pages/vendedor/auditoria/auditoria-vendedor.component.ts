import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  ViewChild,
  ElementRef,
  PLATFORM_ID,
  Inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  AuditoriaService,
  SesionAuditoria,
} from '../../../services/administracion/ia/auditoria.service';
import { AuthService } from '../../../services/auth/auth.service';

import { IaSpinnerComponent } from '../../../shared/components/ia-loader/ia-spinner.component';
import { IaLoaderComponent } from '../../../shared/components/ia-loader/ia-loader.component';
type Vista = 'buscando' | 'escaneando' | 'finalizado' | 'sin_sesion';

interface ScanNotificacion {
  id: number;
  zapatoId: string;
  tipo: 'qr' | 'manual' | 'guardado';
  exito: boolean;
  mensaje?: string;
}

@Component({
  selector: 'app-auditoria-vendedor',
  standalone: true,
  imports: [
    IaLoaderComponent,
    IaSpinnerComponent,CommonModule, FormsModule],
  templateUrl: './auditoria-vendedor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditoriaVendedorComponent implements OnInit, OnDestroy {
  @ViewChild('videoEl') videoEl?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasEl?: ElementRef<HTMLCanvasElement>;

  vista: Vista = 'buscando';
  sesion: SesionAuditoria | null = null;
  sesionId: string | null = null;
  sesionIdInput: string = '';

  private stream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private jsQR: any = null;
  escaneando = false;
  camaraError = '';
  cooldown = false;
  ultimoCodigo: string | null = null;

  codigoManual = '';
  enviandoManual = false;

  /** Marca si el último escaneo (qr o manual) falló al guardar, para feedback visual si lo necesitas */
  guardandoEnFirebase = false;

  escaneadosLocales: string[] = [];
  finalizando = false;
  mostrarConfirmarFin = false;

  notificacion: ScanNotificacion | null = null;
  private notifCounter = 0;
  private notifTimeout: any = null;

  private sesionSub?: Subscription;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private auditoriaService: AuditoriaService,
    private authService: AuthService,
    private cd: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      const mod = await import('jsqr');
      this.jsQR = mod.default ?? mod;
    }

    this.sesionSub = this.auditoriaService.sesionActiva$.subscribe((sesion) => {
      this.sesion = sesion;
      if (this.sesionId) {
        this.reconstruirEscaneadosLocales();
      } else {
        this.escaneadosLocales = [];
      }

      if (!sesion) {
        this.vista = this.sesionId ? 'sin_sesion' : 'buscando';
        this.detenerCamara();
      } else if (sesion.estado === 'finalizado') {
        this.vista = 'finalizado';
        this.detenerCamara();
      } else if (sesion.estado === 'en_progreso') {
        if (this.vista === 'buscando' || this.vista === 'sin_sesion') {
          this.vista = 'escaneando';
          setTimeout(() => this.iniciarCamara(), 150);
        }
      }
      this.cd.markForCheck();
    });
  }

  private mostrarNotificacion(
    zapatoId: string,
    tipo: 'qr' | 'manual' | 'guardado',
    exito: boolean,
    mensaje?: string,
  ): void {
    if (this.notifTimeout) clearTimeout(this.notifTimeout);
    this.notificacion = {
      id: ++this.notifCounter,
      zapatoId,
      tipo,
      exito,
      mensaje,
    };
    this.cd.markForCheck();
    this.notifTimeout = setTimeout(() => {
      this.notificacion = null;
      this.cd.markForCheck();
    }, 2200);
  }

  cerrarNotificacion(): void {
    if (this.notifTimeout) clearTimeout(this.notifTimeout);
    this.notificacion = null;
    this.cd.markForCheck();
  }

  async unirseASesion(): Promise<void> {
    const id = this.sesionIdInput.trim();
    if (!id) return;
    this.sesionId = id;
    this.auditoriaService.escucharSesion(id);

    try {
      const usuario = this.authService.getCurrentUser();
      const nombre = usuario?.name ?? usuario?.email ?? 'Vendedor';
      await this.auditoriaService.registrarVendedor(id, nombre);
    } catch (err) {
      console.warn('No se pudo registrar el nombre del vendedor:', err);
    }
    this.cd.markForCheck();
  }

  private async iniciarCamara(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    this.camaraError = '';

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      const video = this.videoEl?.nativeElement;
      if (!video) return;
      video.srcObject = this.stream;
      video.setAttribute('playsinline', 'true');
      await video.play();
      this.escaneando = true;
      this.cd.markForCheck();
      this.leerFrames();
    } catch {
      this.camaraError =
        'No se pudo acceder a la cámara. Verifica los permisos.';
      this.escaneando = false;
      this.cd.markForCheck();
    }
  }

  private leerFrames(): void {
    if (!this.escaneando) return;
    if (!this.jsQR) {
      this.animFrameId = requestAnimationFrame(() => this.leerFrames());
      return;
    }

    const video = this.videoEl?.nativeElement;
    const canvas = this.canvasEl?.nativeElement;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      this.animFrameId = requestAnimationFrame(() => this.leerFrames());
      return;
    }

    const ctx = canvas.getContext('2d')!;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = this.jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code?.data) {
      this.onQRDetectado(code.data);
    } else {
      this.animFrameId = requestAnimationFrame(() => this.leerFrames());
    }
  }

  private async onQRDetectado(valor: string): Promise<void> {
    if (this.cooldown) {
      this.animFrameId = requestAnimationFrame(() => this.leerFrames());
      return;
    }

    const zapatoId = valor.trim();
    this.ultimoCodigo = zapatoId;
    this.cooldown = true;

    if (navigator.vibrate) navigator.vibrate(80);

    if (!this.esIdValido(zapatoId)) {
      this.mostrarNotificacion(
        zapatoId,
        'manual',
        false,
        'QR no reconocido: solo se aceptan códigos numéricos',
      );
      this.cd.markForCheck();
      this.programarFinCooldown();
      return;
    }

    const guardado = await this.registrarEscaneo(zapatoId);
    this.mostrarNotificacion(
      zapatoId,
      'qr',
      guardado,
      guardado ? undefined : 'No se pudo guardar en Firebase. Vuelve a escanear.',
    );
    this.cd.markForCheck();
    this.programarFinCooldown();
  }

  private programarFinCooldown(): void {
    setTimeout(() => {
      this.cooldown = false;
      this.ultimoCodigo = null;
      this.cd.markForCheck();
      if (this.escaneando) {
        this.animFrameId = requestAnimationFrame(() => this.leerFrames());
      }
    }, 1600);
  }

  /** Envía un único código a Firebase de inmediato. Devuelve true si se guardó. */
  private async registrarEscaneo(zapatoId: string): Promise<boolean> {
    if (!this.sesionId) return false;
    const idNormalizado = String(zapatoId).trim();

    this.guardandoEnFirebase = true;
    this.cd.markForCheck();

    try {
      await this.auditoriaService.registrarEscaneosBatch(this.sesionId, [
        idNormalizado,
      ]);
      this.escaneadosLocales = [...this.escaneadosLocales, idNormalizado];
      return true;
    } catch (err) {
      console.warn('[Firebase] No se pudo guardar el código:', err);
      return false;
    } finally {
      this.guardandoEnFirebase = false;
      this.cd.markForCheck();
    }
  }

  private detenerCamara(): void {
    this.escaneando = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  async enviarManual(): Promise<void> {
    const codigo = this.codigoManual.trim();
    if (!codigo || !this.sesion) return;

    if (!this.esIdValido(codigo)) {
      this.mostrarNotificacion(
        codigo,
        'manual',
        false,
        'Código no válido: ingresa solo números',
      );
      return;
    }

    this.enviandoManual = true;
    this.cd.markForCheck();

    const guardado = await this.registrarEscaneo(codigo);
    this.mostrarNotificacion(
      codigo,
      'manual',
      guardado,
      guardado ? undefined : 'No se pudo guardar en Firebase. Intenta de nuevo.',
    );
    if (guardado) this.codigoManual = '';

    this.enviandoManual = false;
    this.cd.markForCheck();
  }

  abrirConfirmarFin(): void {
    this.mostrarConfirmarFin = true;
    this.cd.markForCheck();
  }

  cancelarFin(): void {
    this.mostrarConfirmarFin = false;
    this.cd.markForCheck();
  }

  async finalizar(): Promise<void> {
    if (!this.sesionId) return;

    this.finalizando = true;
    this.mostrarConfirmarFin = false;
    this.cd.markForCheck();

    try {
      await this.auditoriaService.finalizarSesion(this.sesionId);
      this.detenerCamara();
      this.vista = 'finalizado';
      if (navigator.vibrate) navigator.vibrate([100, 50, 200]);
    } catch {
      this.mostrarNotificacion(
        '',
        'manual',
        false,
        'No se pudo finalizar la sesión',
      );
    }

    this.finalizando = false;
    this.cd.markForCheck();
  }

  get localNumero(): string {
    return (this.sesion?.localNombre ?? '').replace(/[^0-9]/g, '').trim();
  }

  get progreso(): number {
    if (!this.sesion?.totalEsperados) return 0;
    return Math.min(
      100,
      Math.round(
        (this.escaneadosLocales.length / this.sesion.totalEsperados) * 100,
      ),
    );
  }

  get escaneadosRecientes(): string[] {
    return [...this.escaneadosLocales].reverse().slice(0, 12);
  }

  private reconstruirEscaneadosLocales(): void {
    this.escaneadosLocales = (this.sesion?.recientes ?? []).map((r) => r.id);
  }

  private esIdValido(valor: string): boolean {
    return /^\d+$/.test(valor.trim());
  }

  ngOnDestroy(): void {
    this.sesionSub?.unsubscribe();
    this.detenerCamara();
    if (this.notifTimeout) clearTimeout(this.notifTimeout);
  }
}