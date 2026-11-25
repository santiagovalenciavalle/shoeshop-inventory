import { Component } from '@angular/core';
import { Proveedor } from '../../../pages/interfaces';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ProveedoresService } from '../../../services/administracion/proveedores/proveedores.service';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AuthService } from '../../../services/auth/auth.service';

import { IaSpinnerComponent } from '../../../shared/components/ia-loader/ia-spinner.component';
@Component({
  selector: 'app-proveedores',
  imports: [
    IaSpinnerComponent,
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    ToastModule,
    SkeletonModule,
    FormsModule,
  ],
  templateUrl: './proveedores.component.html',
  styleUrl: './proveedores.component.css',
  providers: [MessageService],
})
export class ProveedoresComponent {
  proveedorForm!: FormGroup;
  proveedores: Proveedor[] = [];
  proveedoresFiltrados: Proveedor[] = [];
  private logoBase64 = '/logo.svg';

  cargando = true;
  guardando = false;
  eliminando = false;

  mostrarModal = false;
  mostrarModalEliminar = false;
  proveedorAEliminar: Proveedor | null = null;

  busqueda: string = '';
  mostrarModalCuentas = false;

  resumenCuentas: {
    proveedorId?: string;
    nombre: string;
    totalDeuda: number;
    facturasPendientes: number;
  }[] = [];

  totalDeudaGeneral = 0;
  user: any;

  constructor(
    private fb: FormBuilder,
    private proveedoresService: ProveedoresService,
    private messageService: MessageService,
    private authService: AuthService,
  ) {
    this.proveedorForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      descripcion: ['', [Validators.required, Validators.minLength(5)]],
    });
  }

  ngOnInit(): void {
    this.user = this.authService.getCurrentUser();
    this.scrollToTop();
    this.proveedoresService.obtenerProveedores().subscribe({
      next: (data) => {
        this.proveedores = data;
        this.proveedoresFiltrados = [...data];
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los proveedores',
        });
      },
    });
  }

  abrirModalCuentas(): void {
    this.calcularResumenCuentas();
    this.mostrarModalCuentas = true;
  }

  cerrarModalCuentas(): void {
    this.mostrarModalCuentas = false;
  }

  calcularResumenCuentas(): void {
    this.resumenCuentas = this.proveedores.map((proveedor) => {
      const facturas = proveedor.facturas || [];

      const facturasPendientes = facturas.filter(
        (f) => f.estado === 'pendiente',
      );

      const totalDeuda = facturasPendientes.reduce(
        (total, factura) => total + (factura.deudaPendiente || 0),
        0,
      );

      return {
        proveedorId: proveedor.id,
        nombre: proveedor.nombre,
        totalDeuda,
        facturasPendientes: facturasPendientes.length,
      };
    });

    this.totalDeudaGeneral = this.resumenCuentas.reduce(
      (total, proveedor) => total + proveedor.totalDeuda,
      0,
    );
  }

  filtrarProveedores(): void {
    const texto = this.busqueda.toLowerCase();
    this.proveedoresFiltrados = this.proveedores.filter(
      (p) =>
        p.nombre.toLowerCase().includes(texto) ||
        p.descripcion.toLowerCase().includes(texto),
    );
  }

  limpiarFiltro(): void {
    this.busqueda = '';
    this.proveedoresFiltrados = [...this.proveedores];
  }

  abrirModal(): void {
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    if (this.guardando) return;
    this.mostrarModal = false;
    this.proveedorForm.reset();
  }

  async guardarProveedor(): Promise<void> {
    if (this.proveedorForm.invalid || this.guardando) {
      this.proveedorForm.markAllAsTouched();
      return;
    }

    this.guardando = true;

    try {
      await this.proveedoresService.agregarProveedor(this.proveedorForm.value);

      this.messageService.add({
        severity: 'success',
        summary: 'Proveedor creado',
        detail: `Se creó correctamente a ${this.proveedorForm.value.nombre}`,
      });

      this.cerrarModal();
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo guardar el proveedor',
      });
    } finally {
      this.guardando = false;
      this.mostrarModal = false;
    }
  }

  abrirModalEliminar(proveedor: Proveedor): void {
    this.proveedorAEliminar = proveedor;
    this.mostrarModalEliminar = true;
  }

  cancelarEliminacion(): void {
    if (this.eliminando) return;
    this.mostrarModalEliminar = false;
    this.proveedorAEliminar = null;
  }

  async confirmarEliminacion(): Promise<void> {
    if (!this.proveedorAEliminar || this.eliminando) return;

    this.eliminando = true;

    try {
      await this.proveedoresService.eliminarProveedor(
        this.proveedorAEliminar.id,
      );

      this.messageService.add({
        severity: 'success',
        summary: 'Proveedor eliminado',
        detail: `Se eliminó correctamente a ${this.proveedorAEliminar.nombre}`,
      });

      this.cancelarEliminacion();
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: `No se pudo eliminar a ${this.proveedorAEliminar.nombre}`,
      });
    } finally {
      this.eliminando = false;
      this.mostrarModalEliminar = false;
    }
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  exportarCuentasPDF(): void {
    this.calcularResumenCuentas();

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    const fechaActual = new Date().toLocaleDateString('es-CO');

    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageWidth, 38, 'F');

    if (this.logoBase64) {
      doc.addImage(this.logoBase64, 'PNG', margin, 6, 25, 25);
    }

    doc.setTextColor(255);
    doc.setFontSize(17);
    doc.setFont(undefined, 'bold');
    doc.text('SHOESHOP DEMO S.A.S', margin + 30, 18);

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Resumen General de Cuentas por Pagar', margin + 30, 25);

    doc.text(`Generado: ${fechaActual}`, pageWidth - margin, 25, {
      align: 'right',
    });

    doc.setTextColor(0);
    let y = 55;

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Resumen General', margin, y);

    y += 8;
    doc.setFont(undefined, 'normal');
    doc.text(`Total Proveedores: ${this.resumenCuentas.length}`, margin, y);

    y += 6;
    doc.text(
      `Deuda Total General: ${this.totalDeudaGeneral.toLocaleString('es-CO', {
        style: 'currency',
        currency: 'COP',
      })}`,
      margin,
      y,
    );

    y += 12;

    const body = this.resumenCuentas.map((cuenta) => [
      cuenta.nombre,
      cuenta.facturasPendientes.toString(),
      cuenta.totalDeuda.toLocaleString('es-CO', {
        style: 'currency',
        currency: 'COP',
      }),
      cuenta.totalDeuda > 0 ? 'PENDIENTE' : 'SIN DEUDA',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Proveedor', 'Facturas Pendientes', 'Total Deuda', 'Estado']],
      body,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: 255,
        fontStyle: 'bold',
      },
      styles: { fontSize: 9 },
      didParseCell: function (data) {
        if (data.column.index === 3) {
          if (data.cell.raw === 'PENDIENTE') {
            data.cell.styles.textColor = [200, 0, 0];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [0, 128, 0];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 15;

    const proveedoresConDeuda = this.resumenCuentas.filter(
      (p) => p.totalDeuda > 0,
    ).length;

    const proveedoresSinDeuda =
      this.resumenCuentas.length - proveedoresConDeuda;

    const porcentajePendiente =
      this.totalDeudaGeneral > 0
        ? proveedoresConDeuda / this.resumenCuentas.length
        : 0;

    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text('Distribución de Proveedores', margin, y);

    y += 10;

    const chartWidth = pageWidth - margin * 2;
    const barHeight = 18;

    doc.setFillColor(240, 240, 240);
    doc.roundedRect(margin, y, chartWidth, barHeight, 4, 4, 'F');

    const steps = 100;
    for (let i = 0; i < steps * porcentajePendiente; i++) {
      const stepWidth = chartWidth / steps;
      doc.setFillColor(245, 158, 11);
      doc.rect(margin + i * stepWidth, y, stepWidth + 0.5, barHeight, 'F');
    }

    doc.setTextColor(50);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(
      `${(porcentajePendiente * 100).toFixed(1)}% CON DEUDA`,
      pageWidth / 2,
      y + 12,
      { align: 'center' },
    );

    y += 26;

    doc.setTextColor(0);
    doc.setFont(undefined, 'normal');

    doc.text(`Proveedores con deuda: ${proveedoresConDeuda}`, margin, y);

    y += 6;

    doc.text(`Proveedores sin deuda: ${proveedoresSinDeuda}`, margin, y);

    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      'Documento generado automáticamente por el sistema financiero ShoeShop.',
      margin,
      pageHeight - 10,
    );
    this.agregarFirmaDigital(doc, pageWidth, pageHeight);
    doc.save('Resumen_Cuentas_General.pdf');
  }

  private agregarFirmaDigital(
    doc: jsPDF,
    pageWidth: number,
    pageHeight: number,
  ) {
    if (!this.user) return;

    const margin = 15;
    const yFirma = pageHeight - 35;

    doc.setDrawColor(100);
    doc.setLineWidth(0.5);
    doc.line(margin, yFirma - 5, pageWidth - margin, yFirma - 5);

    const fechaHora = new Date().toLocaleString('es-CO');

    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.setFont(undefined, 'italic');
    doc.text(`Firmado digitalmente por: ${this.user.name}`, margin, yFirma);

    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.setFont(undefined, 'normal');

    const detalles = [
      `Número: ${this.user.numeroBodega}`,
      `Fecha y hora: ${fechaHora}`,
      `Sistema Administración ShoeShop`,
    ];

    detalles.forEach((linea, index) => {
      doc.text(linea, margin, yFirma + 5 + index * 4);
    });
  }
}
