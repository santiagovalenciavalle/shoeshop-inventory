import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  Renderer2,
  inject,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  IaService,
  MensajeChat,
} from '../../../services/administracion/ia/ia.service';
import { VozIaService } from '../../../services/administracion/ia/voz-ia.service';
import {
  ChatConversacionesService,
  Conversacion,
} from '../../../services/administracion/ia/chat-conversaciones.service';
import { Auth } from '@angular/fire/auth';
import { AuthService } from '../../../services/auth/auth.service';

@Component({
  selector: 'app-ia',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DatePipe],
  templateUrl: './ia.component.html',
  styleUrl: './ia.component.css',
})
export class IaComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('chatContainer') chatContainer!: ElementRef;
  @ViewChild('inputRef') inputRef!: ElementRef;

  vista: 'lista' | 'chat' = 'lista';
  esSantiago = false;

  conversaciones: Conversacion[] = [];
  conversacionActiva: Conversacion | null = null;
  cargandoConversaciones = false;

  mensajes: MensajeChat[] = [];
  inputUsuario = '';
  cargando = false;
  private debeHacerScroll = false;

  sugerencias: string[] = [];
  mostrarSugerencias = false;

  escuchando = false;
  hablando = false;
  modoVozActivo = false;
  errorVoz = '';

  temaOscuro = false;

  modeloActual = 'openai/gpt-oss-120b';
  readonly modelos = [
    { id: 'openai/gpt-oss-120b', nombre: 'Modelo 1 — recomendado' },
    { id: 'openai/gpt-oss-20b', nombre: 'Modelo 2 — rápido' },
  ];

  private iaService = inject(IaService);
  private vozService = inject(VozIaService);
  private chatService = inject(ChatConversacionesService);
  private renderer = inject(Renderer2);
  private authService = inject(AuthService);
  get soportaVoz(): boolean {
    return this.vozService.soportaVoz;
  }

  async ngOnInit(): Promise<void> {
    this.scrollToTop();
    const uid = await this.getUserId();
    this.esSantiago = uid === 'rn0Km71CUbdhmvnkXjfKFEoX7hj1';
    this.sugerencias = this.iaService.obtenerSugerencias();
    this.inicializarTema();
    this.iaService.setModelo(this.modeloActual);
    await this.cargarConversaciones();
    this.scrollToTop();
  }

  private async getUserId(): Promise<string> {
    const user = await this.authService.getCurrentUser();
    return user!.id;
  }

  ngAfterViewChecked(): void {
    if (this.debeHacerScroll) {
      this.scrollAlFinal();
      this.debeHacerScroll = false;
    }
  }

  ngOnDestroy(): void {}

  async cargarConversaciones(): Promise<void> {
    this.cargandoConversaciones = true;
    try {
      await this.chatService.cargarConversaciones();
      this.chatService.conversaciones$.subscribe((lista) => {
        this.conversaciones = lista;
      });
    } finally {
      this.cargandoConversaciones = false;
    }
  }

  async abrirConversacion(conv: Conversacion): Promise<void> {
    this.conversacionActiva = conv;
    this.mensajes = [];
    this.vista = 'chat';
    this.mostrarSugerencias = false;
    this.cargando = false;
    const msgs = await this.chatService.cargarMensajes(conv.id);
    this.mensajes = msgs.map((m) => ({
      rol: m.rol,
      contenido: m.contenido,
      timestamp: m.timestamp,
      cargando: false,
    }));
    this.debeHacerScroll = true;
  }

  nuevaConversacion(): void {
    this.conversacionActiva = null;
    this.mensajes = [];
    this.vista = 'chat';
    this.mostrarSugerencias = true;
    this.inputUsuario = '';
  }

  volverALista(): void {
    this.conversacionActiva = null;
    this.mensajes = [];
    this.vista = 'lista';
  }

  formatearFechaConversacion(fecha: Date): string {
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    const d = new Date(fecha);
    if (d.toDateString() === hoy.toDateString())
      return d.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
      });
    if (d.toDateString() === ayer.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  }

  async enviarMensaje(): Promise<void> {
    const texto = this.inputUsuario.trim();
    if (!texto || this.cargando) return;

    if (this.hablando) {
      this.vozService.detenerVoz();
      this.hablando = false;
    }

    this.mostrarSugerencias = false;

    if (!this.conversacionActiva) {
      const nuevoId = await this.chatService.crearConversacion(texto);
      const lista = this.chatService.getConversaciones();
      this.conversacionActiva = lista.find((c) => c.id === nuevoId) ?? {
        id: nuevoId,
        titulo: texto.substring(0, 42),
        ultimoMensaje: texto,
        ultimoMensajeRol: 'usuario',
        fechaActualizacion: new Date(),
        totalMensajes: 0,
        userId: '',
        vendedorId: '',
        vendedorNombre: '',
      };
    }

    const convId = this.conversacionActiva.id;

    const msgUsuario: MensajeChat = {
      rol: 'usuario',
      contenido: texto,
      timestamp: new Date(),
    };
    this.mensajes.push(msgUsuario);
    this.inputUsuario = '';
    this.resetTextareaHeight();
    this.debeHacerScroll = true;

    await this.chatService.guardarMensaje(convId, msgUsuario);

    this.cargando = true;
    const idxCargando = this.mensajes.length;
    this.mensajes.push({
      rol: 'asistente',
      contenido: '',
      timestamp: new Date(),
      cargando: true,
    });
    this.debeHacerScroll = true;

    try {
      const respuesta = await this.iaService.enviarMensaje(
        texto,
        this.mensajes.slice(0, -1),
      );

      const msgIA: MensajeChat = {
        rol: 'asistente',
        contenido: respuesta,
        timestamp: new Date(),
        cargando: false,
      };
      this.mensajes[idxCargando] = msgIA;
      this.debeHacerScroll = true;

      await this.chatService.guardarMensaje(convId, msgIA);
      await this.chatService.actualizarConversacion(
        convId,
        respuesta,
        'asistente',
        this.mensajes.filter((m) => !m.cargando).length,
      );

      if (this.modoVozActivo) {
        this.hablando = true;
        await this.vozService.hablar(respuesta);
        this.hablando = false;
      }
    } catch (error: any) {
      const errMsg = error?.message?.includes('429')
        ? 'Demasiadas consultas. Espera unos segundos e intenta de nuevo.'
        : `Error: ${error?.message ?? JSON.stringify(error)}`;
      const msgErr: MensajeChat = {
        rol: 'asistente',
        contenido: errMsg,
        timestamp: new Date(),
        cargando: false,
      };
      this.mensajes[idxCargando] = msgErr;
      await this.chatService.guardarMensaje(convId, msgErr);
    } finally {
      this.cargando = false;
    }
  }

  toggleModoVoz(): void {
    this.modoVozActivo = !this.modoVozActivo;
    if (!this.modoVozActivo) {
      this.vozService.detenerVoz();
      this.vozService.detenerEscucha();
      this.escuchando = false;
      this.hablando = false;
    }
  }

  async grabarVoz(): Promise<void> {
    if (this.escuchando) {
      this.vozService.detenerEscucha();
      this.escuchando = false;
      return;
    }
    this.errorVoz = '';
    this.escuchando = true;
    try {
      const texto = await this.vozService.escuchar();
      this.escuchando = false;
      if (texto.trim()) {
        this.inputUsuario = texto;
        await this.enviarMensaje();
      }
    } catch (error: any) {
      this.escuchando = false;
      this.errorVoz = error;
      setTimeout(() => (this.errorVoz = ''), 3000);
    }
  }

  async leerMensaje(contenido: string): Promise<void> {
    if (this.hablando) {
      this.vozService.detenerVoz();
      this.hablando = false;
      return;
    }
    this.hablando = true;
    await this.vozService.hablar(contenido);
    this.hablando = false;
  }

  detenerVoz(): void {
    this.vozService.detenerVoz();
    this.hablando = false;
  }

  cambiarModelo(modelo: string): void {
    this.modeloActual = modelo;
    this.iaService.setModelo(modelo);
  }

  private inicializarTema(): void {
    const guardado = localStorage.getItem('ia-tema');
    const prefiereDark = window.matchMedia(
      '(prefers-color-scheme: dark)',
    ).matches;
    this.temaOscuro = guardado ? guardado === 'dark' : prefiereDark;
    this.aplicarTema();
  }

  toggleTema(): void {
    this.temaOscuro = !this.temaOscuro;
    localStorage.setItem('ia-tema', this.temaOscuro ? 'dark' : 'light');
    this.aplicarTema();
  }

  private aplicarTema(): void {
    if (this.temaOscuro) {
      this.renderer.addClass(document.documentElement, 'dark');
    } else {
      this.renderer.removeClass(document.documentElement, 'dark');
    }
  }

  usarSugerencia(sugerencia: string): void {
    this.inputUsuario = sugerencia;
    this.enviarMensaje();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.enviarMensaje();
    }
  }

  formatearMensaje(texto: string): string {
    return texto
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  autoResize(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  private resetTextareaHeight(): void {
    if (this.inputRef?.nativeElement) {
      this.inputRef.nativeElement.style.height = 'auto';
    }
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private scrollAlFinal(): void {
    if (this.chatContainer?.nativeElement) {
      const el = this.chatContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }

  trackById(_index: number, _msg: MensajeChat): number {
    return _index;
  }

  trackByConvId(_index: number, conv: Conversacion): string {
    return conv.id;
  }
}
