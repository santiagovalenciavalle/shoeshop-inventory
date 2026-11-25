import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { User } from '../../../../pages/interfaces';
import { LocalesService } from '../../../../services/locales/locales.service';

import { IaSpinnerComponent } from '../../../../shared/components/ia-loader/ia-spinner.component';
@Component({
  selector: 'app-modal-agregar-usuario',
  standalone: true,
  imports: [
    IaSpinnerComponent,CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './modal-agregar-usuario.component.html',
  styleUrl: './modal-agregar-usuario.component.css',
  animations: [
    trigger('overlayAnim', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('160ms ease', style({ opacity: 0 }))]),
    ]),
    trigger('sheetAnim', [
      transition(':enter', [
        style({ transform: 'translateY(40px)', opacity: 0 }),
        animate(
          '280ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          style({ transform: 'translateY(0)', opacity: 1 }),
        ),
      ]),
      transition(':leave', [
        animate(
          '200ms ease',
          style({ transform: 'translateY(30px)', opacity: 0 }),
        ),
      ]),
    ]),
  ],
})
export class ModalAgregarUsuarioComponent
  implements OnInit, OnChanges, OnDestroy
{
  @Input() usuario: User | null = null;
  @Input() esEdicion: boolean = false;
  @Output() onClose = new EventEmitter<void>();
  @Output() onAddUser = new EventEmitter<any>();
  @Output() onUpdateUser = new EventEmitter<any>();

  display = true;
  loading = false;

  locales: { label: string; value: string }[] = [];

  prestamosOpciones = [
    { label: 'Sí', value: true },
    { label: 'No', value: false },
  ];

  roles = [
    { label: 'Administrador', value: 'admin' },
    { label: 'Vendedor', value: 'vendedor' },
    { label: 'Bodega', value: 'bodega' },
    { label: 'Patinador', value: 'patinador' },
  ];

  estados = [
    { label: 'Activo', value: true },
    { label: 'Inactivo', value: false },
  ];

  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private localesService: LocalesService,
  ) {
    this.crearFormulario();
  }

  private crearFormulario() {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      rol: [null, Validators.required],
      estado: [true, Validators.required],
      local: [null],
      correo: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmarContrasena: ['', Validators.required],
      numeroBodega: [''],
      prestamosActivos: [false],
    });
  }

  ngOnInit(): void {
    this.localesService.registrar();
    this.cargarLocales();
  }

  ngOnDestroy(): void {
    this.localesService.desregistrar();
  }

  private cargarLocales(): void {
    this.localesService.obtenerLocales().subscribe((locales) => {
      this.locales = locales.map((local) => ({
        label: local.nombre,
        value: local.nombre,
      }));
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['usuario'] && this.usuario) {
      this.setValoresFormulario();
    }
    this.configurarValidacionesSegunEdicion();
  }

  private setValoresFormulario() {
    if (!this.usuario) return;

    const rol = this.usuario.role;
    const prestamosActivos =
      (rol === 'vendedor' || rol === 'admin') && this.usuario.prestamosActivos
        ? this.usuario.prestamosActivos.value
        : false;

    this.form.patchValue({
      nombre: this.usuario.name || '',
      correo: this.usuario.email || '',
      rol: rol || '',
      estado: this.usuario.active?.value ?? true,
      local: this.usuario.local || null,
      numeroBodega: this.usuario.numeroBodega || '',
      prestamosActivos,
    });

    if (rol === 'patinador') {
      this.form.get('correo')?.disable();
      this.form.get('password')?.disable();
      this.form.get('confirmarContrasena')?.disable();
      this.form.get('correo')?.clearValidators();
      this.form.get('password')?.clearValidators();
      this.form.get('confirmarContrasena')?.clearValidators();
    }

    if (rol === 'bodega') {
    } else {
      this.form.get('numeroBodega')?.clearValidators();
    }

    this.form.get('numeroBodega')?.updateValueAndValidity();
  }

  private configurarValidacionesSegunEdicion() {
    if (this.esEdicion) {
      this.form.get('password')?.clearValidators();
      this.form.get('confirmarContrasena')?.clearValidators();
    } else {
      this.form
        .get('password')
        ?.setValidators([Validators.required, Validators.minLength(6)]);
      this.form.get('confirmarContrasena')?.setValidators(Validators.required);
    }
    this.form.get('correo')?.updateValueAndValidity();
    this.form.get('password')?.updateValueAndValidity();
    this.form.get('confirmarContrasena')?.updateValueAndValidity();
  }

  rolChanged(selectedRole: string) {
    if (selectedRole === 'bodega') {
    } else {
      this.form.get('numeroBodega')?.clearValidators();
      this.form.get('numeroBodega')?.reset();
    }

    if (selectedRole === 'patinador') {
      this.form.get('correo')?.clearValidators();
      this.form.get('password')?.clearValidators();
      this.form.get('confirmarContrasena')?.clearValidators();
      this.form.get('correo')?.reset();
      this.form.get('password')?.reset();
      this.form.get('confirmarContrasena')?.reset();
    } else {
      this.form
        .get('correo')
        ?.setValidators([Validators.required, Validators.email]);
      if (!this.esEdicion) {
        this.form
          .get('password')
          ?.setValidators([Validators.required, Validators.minLength(6)]);
        this.form
          .get('confirmarContrasena')
          ?.setValidators(Validators.required);
      }
    }

    this.form.get('correo')?.updateValueAndValidity();
    this.form.get('password')?.updateValueAndValidity();
    this.form.get('confirmarContrasena')?.updateValueAndValidity();
    this.form.get('numeroBodega')?.updateValueAndValidity();

    if (selectedRole !== 'vendedor' && selectedRole !== 'admin') {
      this.form.get('local')?.reset();
    }
  }

  guardar() {
    this.form.markAllAsTouched();

    const rolSeleccionado = this.form.value.rol || '';
    const isPatinador = rolSeleccionado === 'patinador';

    if (this.form.invalid) return;

    if (
      !this.esEdicion &&
      !isPatinador &&
      this.form.value.password !== this.form.value.confirmarContrasena
    ) {
      return;
    }

    this.loading = true;

    const estadoBoolean =
      this.form.value.estado === true || this.form.value.estado === 'true';
    const prestamosBoolean =
      this.form.value.prestamosActivos === true ||
      this.form.value.prestamosActivos === 'true';

    const data: any = {
      name: this.form.value.nombre || '',
      role: rolSeleccionado,
      active: {
        label: estadoBoolean ? 'Activo' : 'Inactivo',
        value: estadoBoolean,
      },
      email: !isPatinador ? this.form.value.correo || '' : null,
      local:
        rolSeleccionado === 'vendedor' || rolSeleccionado === 'admin'
          ? this.form.value.local || null
          : null,
      numeroBodega:
        rolSeleccionado === 'bodega'
          ? this.form.value.numeroBodega || ''
          : null,
      prestamosActivos:
        rolSeleccionado === 'vendedor' || rolSeleccionado === 'admin'
          ? { label: prestamosBoolean ? 'Sí' : 'No', value: prestamosBoolean }
          : null,
    };

    if (!isPatinador && !this.esEdicion) {
      data.password = this.form.value.password;
    }

    if (this.esEdicion) {
      this.onUpdateUser.emit(data);
    } else {
      this.onAddUser.emit(data);
    }

    this.loading = false;
    this.cerrar();
  }

  cerrar() {
    this.display = false;
    this.onClose.emit();
  }
}
