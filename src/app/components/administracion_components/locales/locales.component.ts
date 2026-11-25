import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import {
  Local,
  LocalesService,
} from '../../../services/locales/locales.service';
import { Observable } from 'rxjs';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import {
  FiltroVentaLocalInicial,
  VentaLocalComponent,
} from './venta-local/venta-local.component';
import { SalesService } from '../../../services/vendedorServices/ventas/sales.service';

import { IaLoaderComponent } from '../../../shared/components/ia-loader/ia-loader.component';
@Component({
  selector: 'app-locales',
  imports: [
    IaLoaderComponent,
    CommonModule,
    RouterModule,
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    InputTextModule,
    FormsModule,
    ToastModule,
    VentaLocalComponent,
  ],
  templateUrl: './locales.component.html',
  styleUrl: './locales.component.css',
  providers: [ConfirmationService, MessageService],
})
export class LocalesComponent {
  locales$!: Observable<Local[]>;
  mostrarDialogo: boolean = false;
  modoEdicion: boolean = false;
  localSeleccionadoParaVer: string = '';
  mostrarGestionLocales: boolean = false;
  loadingPantalla: boolean = true;
  filtroInicial: FiltroVentaLocalInicial | null = null;

  localSeleccionado: Local = {
    id: '',
    nombre: '',
    estado: 'Activo',
  };

  constructor(
    private localesService: LocalesService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private cd: ChangeDetectorRef,
    private salesService: SalesService,
    private route: ActivatedRoute,
  ) {}

  async ngOnInit(): Promise<void> {
    this.scrollToTop();
    this.localesService.registrar();
    await this.salesService.initVentas();
    this.locales$ = this.localesService.obtenerLocales();

    // Filtros que llegan por la URL (p. ej. desde una notificación de la IA)
    this.route.queryParamMap.subscribe((q) => {
      const local = q.get('local');
      if (!local) return;
      this.localSeleccionadoParaVer = local;
      const periodo = q.get('periodo') as FiltroVentaLocalInicial['periodo'];
      const codigo = Number(q.get('codigo'));
      this.filtroInicial = {
        periodo: periodo || undefined,
        fecha: q.get('fecha') || undefined,
        vendedor: q.get('vendedor') || undefined,
        codigo: Number.isFinite(codigo) && codigo > 0 ? codigo : undefined,
        precioBajo: q.get('precioBajo') === '1',
      };
      this.cd.markForCheck();
    });

    this.locales$.subscribe((locales) => {
      if (locales.length > 0 && !this.localSeleccionadoParaVer) {
        this.localSeleccionadoParaVer = locales[0].nombre;
      }
    });

    setTimeout(() => {
      this.loadingPantalla = false;
    }, 2000);

    this.cd.detectChanges();
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  ngOnDestroy(): void {
    this.localesService.desregistrar();
  }

  onLocalChange(nombre: string): void {
    this.localSeleccionadoParaVer = nombre;
    this.filtroInicial = null; // al cambiar de local a mano, se descartan los filtros de la notificación
  }

  abrirModalAgregar(): void {
    this.modoEdicion = false;
    this.localSeleccionado = { id: '', nombre: '', estado: 'Activo' };
    this.mostrarDialogo = true;
  }

  abrirModalEditar(local: Local): void {
    this.modoEdicion = true;
    this.localSeleccionado = { ...local };
    this.mostrarDialogo = true;
  }

  cerrarDialogo(): void {
    this.mostrarDialogo = false;
  }

  guardarLocal(): void {
    if (!this.localSeleccionado.nombre) return;
    this.cerrarDialogo();

    if (this.modoEdicion) {
      this.localesService.editarLocal(this.localSeleccionado).then(() => {
        this.messageService.add({
          severity: 'success',
          summary: 'Local actualizado',
          detail: `El local "${this.localSeleccionado.nombre}" fue actualizado correctamente.`,
        });
      });
    } else {
      const nuevoLocal: Local = {
        ...this.localSeleccionado,
        id: crypto.randomUUID(),
      };
      this.localesService.agregarLocal(nuevoLocal).then(() => {
        this.messageService.add({
          severity: 'success',
          summary: 'Local agregado',
          detail: `El local "${nuevoLocal.nombre}" fue agregado correctamente.`,
        });
      });
    }
  }

  confirmarEliminacion(localId: string): void {
    this.confirmationService.confirm({
      message: '¿Estás seguro de que deseas eliminar este local?',
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.localesService.eliminarLocal(localId).then(() => {
          this.messageService.add({
            severity: 'success',
            summary: 'Local eliminado',
            detail: 'El local fue eliminado correctamente.',
          });
        });
      },
    });
  }
}
