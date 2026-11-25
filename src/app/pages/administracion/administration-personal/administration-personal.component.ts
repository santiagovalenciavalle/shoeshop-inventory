import { CommonModule } from '@angular/common';
import { Component, computed, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { ModalAgregarUsuarioComponent } from '../../../components/administracion_components/administration-personal/modal-agregar-usuario/modal-agregar-usuario.component';
import { UsuarioService } from '../../../services/administracion/usuarios/usuario.service';
import { SinActivacionService } from '../../../services/administracion/sinactivacion/sin-activacion.service';
import { User } from '../../interfaces';

@Component({
  selector: 'app-administration-personal',
  standalone: true,
  imports: [
    CommonModule,
    InputTextModule,
    ButtonModule,
    FormsModule,
    RouterModule,
    ToastModule,
    ModalAgregarUsuarioComponent,
    ConfirmDialogModule,
  ],
  templateUrl: './administration-personal.component.html',
  styleUrls: ['./administration-personal.component.css'],
  providers: [MessageService, ConfirmationService],
})
export class AdministrationPersonalComponent implements OnInit {
  searchTerm = signal('');
  isModalOpen = false;
  usuarioSeleccionado: User | null = null;
  esEdicion = false;
  idsSinActivacion: string[] = [];
  guardandoActivacion = false;

  editandoEmailId: string | null = null;
  emailEditando = '';
  guardandoEmail = false;

  usuarios = signal<User[]>([]);

  usuariosActivables = computed(() =>
    this.usuarios().filter(
      (u) =>
        ['vendedor', 'bodega', 'admin'].includes(u.role) &&
        u.active?.value === true,
    ),
  );

  filteredUsers = computed(() =>
    this.usuarios().filter((user) =>
      user.name.toLowerCase().includes(this.searchTerm().toLowerCase()),
    ),
  );

  usuariosPorRol = computed(() => {
    const rolesAgrupados: { [key: string]: User[] } = {
      admin: [],
      bodega: [],
      vendedor: [],
      patinador: [],
    };
    this.filteredUsers().forEach((user) => {
      if (rolesAgrupados[user.role]) {
        rolesAgrupados[user.role].push(user);
      }
    });
    return rolesAgrupados;
  });

  rolReadable: Record<string, string> = {
    admin: 'Administradores',
    vendedor: 'Vendedores',
    patinador: 'Patinadores',
    bodega: 'Bodegueros',
  };

  constructor(
    private usuarioService: UsuarioService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private sinActivacionService: SinActivacionService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.scrollToTop();
    this.usuarioService.initUsuarios();

    this.usuarioService.usuarios$.subscribe((usuarios) => {
      this.usuarios.set(usuarios);
    });

    await this.sinActivacionService.cargarIds();
    this.sinActivacionService.ids$.subscribe((ids) => {
      this.idsSinActivacion = ids;
    });
  }

  abrirEditarEmail(user: User): void {
    this.editandoEmailId = user.id ?? null;
    this.emailEditando = (user as any).emailReporte ?? '';
  }

  cancelarEditarEmail(): void {
    this.editandoEmailId = null;
    this.emailEditando = '';
  }

  async guardarEmail(user: User): Promise<void> {
    if (!user.id) return;

    const emailTrimmed = this.emailEditando.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailTrimmed && !emailRegex.test(emailTrimmed)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Formato inválido',
        detail: 'Ingresa un correo electrónico válido.',
        life: 3000,
      });
      return;
    }

    this.guardandoEmail = true;
    try {
      await this.usuarioService.actualizarUsuario(user.id, {
        emailReporte: emailTrimmed || null,
      } as any);

      this.messageService.add({
        severity: 'success',
        summary: 'Email guardado',
        detail: emailTrimmed
          ? `Email de reporte actualizado para ${user.name}.`
          : `Email de reporte eliminado para ${user.name}.`,
        life: 3000,
      });

      this.editandoEmailId = null;
      this.emailEditando = '';
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo guardar el email de reporte.',
        life: 3000,
      });
    } finally {
      this.guardandoEmail = false;
    }
  }

  async toggleRestricciones(user: User): Promise<void> {
    if (!user.id) return;
    const nuevoValor = !user.restriccionesActivas;
    try {
      await this.usuarioService.actualizarUsuario(user.id, {
        restriccionesActivas: nuevoValor,
      });
      this.messageService.add({
        severity: 'success',
        summary: nuevoValor
          ? 'Restricciones activadas'
          : 'Restricciones desactivadas',
        detail: `${user.name} ${nuevoValor ? 'ahora tiene' : 'ya no tiene'} restricciones de precio.`,
        life: 3000,
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo actualizar las restricciones.',
        life: 3000,
      });
    }
  }

  async togglePremier(user: User): Promise<void> {
    if (!user.id) return;
    const nuevoValor = !user.accesoPremier;
    try {
      await this.usuarioService.actualizarUsuario(user.id, {
        accesoPremier: nuevoValor,
      });
      this.messageService.add({
        severity: 'success',
        summary: nuevoValor
          ? 'Acceso Premier activado'
          : 'Acceso Premier desactivado',
        detail: `${user.name} ${nuevoValor ? 'ahora tiene' : 'ya no tiene'} acceso Premier.`,
        life: 3000,
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo actualizar el acceso Premier.',
        life: 3000,
      });
    }
  }

  async toggleRecolector(user: User): Promise<void> {
    if (!user.id) return;
    const nuevoValor = !user.recolectorCaja;
    try {
      await this.usuarioService.actualizarUsuario(user.id, {
        recolectorCaja: nuevoValor,
      });
      this.messageService.add({
        severity: 'success',
        summary: nuevoValor ? 'Recolector habilitado' : 'Recolector deshabilitado',
        detail: `${user.name} ${nuevoValor ? 'ahora puede' : 'ya no puede'} recoger el efectivo de caja.`,
        life: 3000,
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo actualizar el permiso de recolector.',
        life: 3000,
      });
    }
  }

  toggleSinActivacion(id: string): void {
    if (this.idsSinActivacion.includes(id)) {
      this.idsSinActivacion = this.idsSinActivacion.filter((i) => i !== id);
    } else {
      this.idsSinActivacion = [...this.idsSinActivacion, id];
    }
  }

  async guardarSinActivacion(): Promise<void> {
    this.guardandoActivacion = true;
    try {
      await this.sinActivacionService.guardarIds(this.idsSinActivacion);
      this.messageService.add({
        severity: 'success',
        summary: 'Configuración guardada',
        detail:
          'Los cambios de registro de entrada se aplicaron correctamente.',
        life: 3000,
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error al guardar',
        detail: 'No se pudieron guardar los cambios.',
        life: 3000,
      });
    } finally {
      this.guardandoActivacion = false;
    }
  }

  async addUser(newUser: Omit<User, 'id'>) {
    try {
      await this.usuarioService.agregarUsuario(newUser);
      this.messageService.add({
        severity: 'success',
        summary: 'Usuario agregado',
        detail: `${newUser.name} fue agregado correctamente.`,
        life: 3000,
      });
      this.isModalOpen = false;
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error al agregar',
        detail: (error as Error).message,
        life: 3000,
      });
    }
  }

  confirmarEliminarUsuario(id: string, nombre: string) {
    this.confirmationService.confirm({
      message: `¿Estás seguro de eliminar a "${nombre}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        await this.usuarioService.eliminarUsuario(id);
        this.messageService.add({
          severity: 'success',
          summary: 'Usuario eliminado',
          detail: `${nombre} fue eliminado correctamente.`,
          life: 3000,
        });
      },
    });
  }

  abrirModalEditar(usuario: User) {
    this.usuarioSeleccionado = { ...usuario };
    this.esEdicion = true;
    this.isModalOpen = true;
  }

  cerrarModal() {
    this.isModalOpen = false;
    this.usuarioSeleccionado = null;
    this.esEdicion = false;
  }

  async actualizarUsuario(uid: string, datos: Partial<User>) {
    await this.usuarioService.actualizarUsuario(uid, datos);
    this.messageService.add({
      severity: 'success',
      summary: 'Usuario actualizado',
      detail: `${datos.name} fue actualizado correctamente.`,
      life: 3000,
    });
  }

  getColorBg(role: string): string {
    switch (role) {
      case 'admin':
        return 'bg-yellow-500';
      case 'bodega':
        return 'bg-yellow-500';
      case 'vendedor':
        return 'bg-green-500';
      default:
        return 'bg-gray-400';
    }
  }

  onSearchChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value);
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
