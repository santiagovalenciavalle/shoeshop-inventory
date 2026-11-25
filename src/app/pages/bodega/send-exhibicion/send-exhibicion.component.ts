import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { exhibiciones, Notification } from '../../interfaces';
import { CatalogoService } from '../../../services/catalogo/catalogo.service';
import { CommonModule } from '@angular/common';
import { ExhibicionesService } from '../../../services/vendedorServices/exhibiciones/exhibiciones.service';
import { NotificationsService } from '../../../services/notifications/notifications.service';
import { HistorialBodegaService } from '../../../services/administracion/registro de bodega/historial-bodega.service';
import { AuthService } from '../../../services/auth/auth.service';
import { BluetoothPrinterService } from '../../../services/bluetooth-printer/bluetooth-printer.service';
import {
  LabelTemplate,
  LabelVariables,
  PrinterTemplateService,
} from '../../../services/printer-template/printer-template.service';
const FALLBACK_TEMPLATE: LabelTemplate = {
  nombre: 'Default',
  width: 50,
  height: 30,
  gap: 3,
  cols: 2,
  copies: 1,
  elements: [],
};
@Component({
  selector: 'app-send-exhibicion',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule, CommonModule],
  templateUrl: './send-exhibicion.component.html',
  styleUrls: ['./send-exhibicion.component.css'],
})
export class SendExhibicionComponent implements OnInit {
  form: FormGroup;
  notificacion?: Notification;
  enviando = false;
  eliminando = false;

  cargandoTallas = false;
  tallasDisponibles: { talla: string; cantidad: number }[] = [];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private catalogoService: CatalogoService,
    private exhibicionesService: ExhibicionesService,
    private notificationsService: NotificationsService,
    private historialService: HistorialBodegaService,
    private authService: AuthService,
    private printerService: BluetoothPrinterService,
    private templateService: PrinterTemplateService,
  ) {
    const navigation = this.router.getCurrentNavigation();
    this.notificacion = navigation?.extras.state?.['notificacion'];

    this.form = this.fb.group({
      tallaSeleccionada: ['', Validators.required],
    });
  }

  async ngOnInit(): Promise<void> {
    this.catalogoService.registrar();
    if (!this.notificacion) {
      this.router.navigate(['/bodega']);
      return;
    }
    await this.cargarTallasDisponibles();
  }

  ngOnDestroy(): void {
    this.catalogoService.desregistrar();
  }

  async cargarTallasDisponibles(): Promise<void> {
    if (!this.notificacion?.producto?.zapatoId) return;

    this.cargandoTallas = true;
    this.tallasDisponibles = [];

    try {
      const producto = await this.catalogoService.getProductoPorId(
        String(this.notificacion.producto.zapatoId),
      );

      if (producto?.tallasDisponibles) {
        this.tallasDisponibles = Object.entries(producto.tallasDisponibles)
          .filter(([_, cantidad]) => cantidad > 0)
          .map(([talla, cantidad]) => ({ talla, cantidad }));
      }
    } catch (error) {
      console.error('❌ Error al cargar tallas:', error);
    } finally {
      this.cargandoTallas = false;
    }
  }

  async eliminarNotificacion(): Promise<void> {
    if (!this.notificacion) return;
    this.eliminando = true;

    try {
      await this.notificationsService.eliminarNotificacion(
        this.notificacion.id,
      );
      this.router.navigate(['/bodega']);
    } catch (error) {
      console.error('Error al eliminar notificación:', error);
    } finally {
      this.eliminando = false;
    }
  }

  async enviarExhibicion(): Promise<void> {
    if (!this.form.valid || !this.notificacion) return;

    this.enviando = true;

    try {
      const producto = await this.catalogoService.getProductoPorId(
        String(this.notificacion.producto.zapatoId),
      );

      const tallaSeleccionada = this.form.value.tallaSeleccionada;
      const zapatoId = String(this.notificacion.producto.zapatoId);
      const user = this.authService.getCurrentUser();

      const recibir =
        await this.exhibicionesService.obtenerConfiguracionRecepcion();

      await this.catalogoService.actualizarStockPorTalla(
        zapatoId,
        tallaSeleccionada,
      );

      const nuevaExhibicion: exhibiciones = {
        marca: this.notificacion.producto.nombre,
        referencia: this.notificacion.producto.referencia || '',
        talla: this.form.value.tallaSeleccionada,
        locales: this.notificacion.locales || [],
        zapatoId: String(this.notificacion.producto.zapatoId),
        imagen: producto?.imagen || '',
        pendienteRecibir: recibir === true,
        enviadoPor: user?.name || 'Desconocido',
        fechahoraEnviado: new Date(),
        precioAdquisicion: producto?.precioAdquisicion ?? 0,
      };

      const agregado =
        await this.exhibicionesService.agregarExhibicion(nuevaExhibicion);

      if (agregado) {
        const fecha = new Date().toISOString();
        const user = this.authService.getCurrentUser();

        const localesString = (this.notificacion.locales || []).map((l: any) =>
          typeof l === 'string' ? l : `local ${l.value ?? l.label ?? l}`,
        );

        await this.historialService.agregarHistorial({
          marca: this.notificacion.producto.nombre,
          referencia: this.notificacion.producto.referencia || '',
          zapatoId: String(this.notificacion.producto.zapatoId),
          talla: this.form.value.tallaSeleccionada.toString(),
          fecha,
          tipo: 'salida',
          lugar: 'exhibicion',
          bodega: user?.name || 'Desconocido',
          locales: localesString,
        });

        if (this.printerService.isConnected()) {
          const localesArr: string[] = (this.notificacion.locales || []).map(
            (l: any) =>
              typeof l === 'string' ? l : String(l.value ?? l.label ?? l),
          );

          const baseTemplate =
            this.templateService.activeTemplate() ?? FALLBACK_TEMPLATE;

          const templateExhibicion: LabelTemplate = {
            ...baseTemplate,
            elements: baseTemplate.elements.map((el) => {
              if (el.type === 'qr') return { ...el, visible: true };
              return el;
            }),
          };

          const allVars: LabelVariables[] = localesArr.map((local) => ({
            marca: this.notificacion!.producto.nombre,
            referencia: this.notificacion!.producto.referencia || '',
            codigo: String(this.notificacion!.producto.zapatoId),
            talla: this.form.value.tallaSeleccionada.toString(),
            local,
          }));

          await this.printerService.printMultiple(templateExhibicion, allVars);
        }

        await this.notificationsService.eliminarNotificacion(
          this.notificacion.id,
        );
        this.router.navigate(['/bodega']);
      }
    } catch (error) {
      console.error('Error al enviar exhibición:', error);
    } finally {
      this.enviando = false;
    }
  }
}
