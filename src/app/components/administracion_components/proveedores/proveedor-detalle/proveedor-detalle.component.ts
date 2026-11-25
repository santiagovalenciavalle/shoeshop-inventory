import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ProveedoresService } from '../../../../services/administracion/proveedores/proveedores.service';
import { abono, Factura, Proveedor } from '../../../../pages/interfaces';
import { v4 as uuidv4 } from 'uuid';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AuthService } from '../../../../services/auth/auth.service';

import { IaSpinnerComponent } from '../../../../shared/components/ia-loader/ia-spinner.component';
import { IaLoaderComponent } from '../../../../shared/components/ia-loader/ia-loader.component';
@Component({
  selector: 'app-proveedor-detalle',
  imports: [
    IaLoaderComponent,
    IaSpinnerComponent,
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    ToastModule,
    FormsModule,
  ],
  templateUrl: './proveedor-detalle.component.html',
  styleUrl: './proveedor-detalle.component.css',
  providers: [MessageService],
})
export class ProveedorDetalleComponent {
  proveedorId!: string;
  proveedor: Proveedor = {
    nombre: '',
    descripcion: '',
    facturas: [],
  };

  mostrarModalFactura = false;
  facturaForm!: FormGroup;

  mostrarModalAbono = false;
  facturaSeleccionada!: Factura;
  abonoForm!: FormGroup;
  cargandoAbono = false;
  mostrarConfirmacionAbono = false;
  mostrarModalVerAbonos = false;
  facturaAbonosSeleccionada!: Factura;
  private logoBase64 = '/logo.svg';

  cargandoAbonos = false;

  abonosAgrupados: { mes: string; abonos: abono[] }[] = [];

  mostrarConfirmacionEliminar = false;
  facturaAEliminar!: Factura;

  cargandoFactura = false;
  cargandoEliminar = false;
  user: any;

  terminoBusqueda: string = '';
  filtroEstado: 'todas' | 'pendiente' | 'cancelada' = 'todas';

  paginaActual: number = 1;
  facturasPorPagina: number = 5;

  cargandoProveedor = true;

  mostrarModalEstadoCuenta = false;
  tipoEstadoCuenta: 'pendiente' | 'cancelada' | 'todas' = 'pendiente';

  constructor(
    private route: ActivatedRoute,
    private proveedoresService: ProveedoresService,
    private fb: FormBuilder,
    private messageService: MessageService,
    private authService: AuthService,
  ) {
    this.facturaForm = this.fb.group({
      fecha: ['', Validators.required],
      numeroFactura: ['', [Validators.required]],
      producto: ['', [Validators.required, Validators.minLength(3)]],
      valorInicial: [0, [Validators.required, Validators.min(0)]],
    });

    this.abonoForm = this.fb.group({
      fecha: ['', Validators.required],
      cantidad: [0, [Validators.required, Validators.min(1)]],
      descripcion: [''],
    });
  }

  ngOnInit() {
    this.user = this.authService.getCurrentUser();
    this.scrollToTop();
    this.route.paramMap.subscribe((params) => {
      const idParam = params.get('id');
      if (idParam) {
        this.proveedorId = idParam;
        this.cargandoProveedor = true;

        this.proveedoresService.obtenerProveedorPorId(idParam).subscribe({
          next: (prov) => {
            this.proveedor = {
              ...prov,
              facturas: prov.facturas ?? [],
            };
            this.cargandoProveedor = false;
          },
          error: () => {
            this.cargandoProveedor = false;
          },
        });
      }
    });
  }

  get facturasFiltradas(): Factura[] {
    if (!this.proveedor.facturas) return [];

    let resultado = [...this.proveedor.facturas];

    if (this.terminoBusqueda.trim()) {
      resultado = resultado.filter((f) =>
        f.numeroFactura
          .toLowerCase()
          .includes(this.terminoBusqueda.toLowerCase()),
      );
    }

    if (this.filtroEstado !== 'todas') {
      resultado = resultado.filter((f) => f.estado === this.filtroEstado);
    }

    resultado.sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
    );

    return resultado;
  }

  get facturasPaginadas(): Factura[] {
    const inicio = (this.paginaActual - 1) * this.facturasPorPagina;
    const fin = inicio + this.facturasPorPagina;
    return this.facturasFiltradas.slice(inicio, fin);
  }

  get totalPaginas(): number {
    return Math.ceil(this.facturasFiltradas.length / this.facturasPorPagina);
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  abrirModalFactura() {
    this.mostrarModalFactura = true;
    this.facturaForm.reset({ valorInicial: 0 });
  }

  cerrarModalFactura() {
    this.mostrarModalFactura = false;
    this.facturaForm.reset({ valorInicial: 0 });
  }

  get deudaTotal(): number {
    if (!this.proveedor.facturas?.length) return 0;

    return this.proveedor.facturas.reduce(
      (total, factura) => total + (factura.valorInicial || 0),
      0,
    );
  }

  get deudaPendiente(): number {
    if (!this.proveedor.facturas?.length) return 0;

    return this.proveedor.facturas.reduce(
      (total, factura) => total + (factura.deudaPendiente || 0),
      0,
    );
  }

  async agregarFactura() {
    if (this.facturaForm.invalid || this.cargandoFactura) {
      this.facturaForm.markAllAsTouched();
      return;
    }

    this.cargandoFactura = true;

    const formValue = this.facturaForm.value;

    const valorNumerico = Number(
      formValue.valorInicial?.toString().replace(/\./g, ''),
    );

    const siguienteNumero = this.generarNumeroConsecutivo();

    const nuevaFactura: Factura = {
      ...formValue,
      numeroFactura: siguienteNumero,
      facturaId: uuidv4(),
      estado: 'pendiente',
      abonos: [],
      valorInicial: valorNumerico,
      deudaPendiente: valorNumerico,
    };

    try {
      await this.proveedoresService.agregarFacturaAProveedor(
        this.proveedorId,
        nuevaFactura,
      );

      this.messageService.add({
        severity: 'success',
        summary: 'Éxito',
        detail: 'Factura agregada correctamente',
      });

      this.cerrarModalFactura();
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo guardar la factura',
      });
    } finally {
      this.cargandoFactura = false;
    }
  }

  private obtenerFacturasPorTipo(): Factura[] {
    if (!this.proveedor.facturas?.length) return [];

    if (this.tipoEstadoCuenta === 'todas') {
      return [...this.proveedor.facturas];
    }

    return this.proveedor.facturas.filter(
      (f) => f.estado === this.tipoEstadoCuenta,
    );
  }

  generarEstadoCuentaFiltrado() {
    const facturasFiltradas = this.obtenerFacturasPorTipo();

    if (!facturasFiltradas.length) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin resultados',
        detail: 'No hay facturas para el filtro seleccionado',
      });
      return;
    }

    this.exportarEstadoCuentaPDF(facturasFiltradas);
    this.mostrarModalEstadoCuenta = false;
  }

  generarNumeroConsecutivo(): string {
    if (!this.proveedor.facturas?.length) {
      return '0001';
    }

    const numeros = this.proveedor.facturas
      .map((f) => parseInt(f.numeroFactura))
      .filter((n) => !isNaN(n));

    const max = Math.max(...numeros);
    const siguiente = max + 1;

    return siguiente.toString().padStart(4, '0');
  }

  getEstadoColor(estado: 'pendiente' | 'cancelada') {
    return estado === 'pendiente'
      ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400'
      : 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400';
  }

  formatearMoneda(event: any) {
    let valor = event.target.value;

    valor = valor.replace(/\D/g, '');

    if (!valor) {
      this.facturaForm.patchValue({ valorInicial: '' }, { emitEvent: false });
      return;
    }

    const numero = parseInt(valor, 10);

    const valorFormateado = numero.toLocaleString('es-CO');

    this.facturaForm.patchValue(
      { valorInicial: valorFormateado },
      { emitEvent: false },
    );
  }

  abrirModalAbono(factura: Factura) {
    this.facturaSeleccionada = factura;
    this.mostrarModalAbono = true;
    this.abonoForm.reset();
  }

  cerrarModalAbono() {
    this.mostrarModalAbono = false;
    this.abonoForm.reset();
  }

  async agregarAbono() {
    if (this.abonoForm.invalid || this.cargandoAbono) {
      return;
    }

    const { fecha, cantidad, descripcion } = this.abonoForm.value;
    const cantidadNumerica = Number(cantidad?.toString().replace(/\./g, ''));
    if (cantidadNumerica > this.facturaSeleccionada.deudaPendiente) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'El abono no puede ser mayor a la deuda pendiente',
      });
      return;
    }

    this.cargandoAbono = true;

    const nuevoAbono = {
      fecha,
      cantidad: cantidadNumerica,
      descripcion,
    };

    if (!this.facturaSeleccionada.abonos) {
      this.facturaSeleccionada.abonos = [];
    }

    this.facturaSeleccionada.abonos.push(nuevoAbono);

    this.facturaSeleccionada.deudaPendiente -= cantidadNumerica;

    if (this.facturaSeleccionada.deudaPendiente === 0) {
      this.facturaSeleccionada.estado = 'cancelada';
    }

    try {
      await this.proveedoresService.actualizarFacturasProveedor(
        this.proveedorId,
        this.proveedor.facturas,
      );

      this.messageService.add({
        severity: 'success',
        summary: 'Éxito',
        detail: 'Abono registrado correctamente',
      });

      this.cerrarModalAbono();
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo guardar el abono',
      });
    } finally {
      this.cargandoAbono = false;
    }
  }

  formatearCantidadAbono(event: any) {
    let valor = event.target.value;

    valor = valor.replace(/\D/g, '');

    if (!valor) {
      this.abonoForm.patchValue({ cantidad: '' }, { emitEvent: false });
      return;
    }

    const numero = parseInt(valor, 10);

    const valorFormateado = numero.toLocaleString('es-CO');

    this.abonoForm.patchValue(
      { cantidad: valorFormateado },
      { emitEvent: false },
    );
  }

  abrirConfirmacionAbono() {
    if (this.abonoForm.invalid || this.cargandoAbono) {
      this.abonoForm.markAllAsTouched();
      return;
    }

    const cantidad = this.cantidadAbonoNumerica;

    if (cantidad > this.facturaSeleccionada.deudaPendiente) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'El abono no puede ser mayor a la deuda pendiente',
      });
      return;
    }

    this.mostrarConfirmacionAbono = true;
  }

  confirmarAbono() {
    this.mostrarConfirmacionAbono = false;
    this.agregarAbono();
  }

  cancelarConfirmacionAbono() {
    this.mostrarConfirmacionAbono = false;
  }

  get cantidadAbonoNumerica(): number {
    const valor = this.abonoForm.value.cantidad;
    if (!valor) return 0;

    return Number(valor.toString().replace(/\./g, ''));
  }

  abrirModalVerAbonos(factura: Factura) {
    this.facturaAbonosSeleccionada = factura;
    this.cargandoAbonos = true;
    this.mostrarModalVerAbonos = true;

    setTimeout(() => {
      this.procesarAbonos();
      this.cargandoAbonos = false;
    }, 300);
  }

  procesarAbonos() {
    if (!this.facturaAbonosSeleccionada?.abonos?.length) {
      this.abonosAgrupados = [];
      return;
    }

    const abonosOrdenados = [...this.facturaAbonosSeleccionada.abonos].sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
    );

    const agrupados: { [mes: string]: abono[] } = {};
    abonosOrdenados.forEach((a) => {
      const fecha = new Date(a.fecha);
      const mes = fecha.toLocaleString('es-CO', {
        month: 'long',
        year: 'numeric',
      });
      if (!agrupados[mes]) agrupados[mes] = [];
      agrupados[mes].push(a);
    });

    this.abonosAgrupados = Object.entries(agrupados).map(([mes, abonos]) => ({
      mes,
      abonos,
    }));
  }

  cerrarModalVerAbonos() {
    this.mostrarModalVerAbonos = false;
    this.abonosAgrupados = [];
  }

  get totalAbonado(): number {
    if (!this.facturaAbonosSeleccionada?.abonos?.length) return 0;
    return this.facturaAbonosSeleccionada.abonos
      .map((a) => a.cantidad)
      .reduce((total, a) => total + a, 0);
  }
  get abonosOrdenados() {
    if (!this.facturaAbonosSeleccionada?.abonos?.length) return [];

    return [...this.facturaAbonosSeleccionada.abonos].sort((a, b) => {
      return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
    });
  }

  exportarFacturaPDF(factura: Factura) {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    const fechaActual = new Date().toLocaleDateString('es-CO');

    doc.setFillColor(20, 20, 20);
    doc.rect(0, 0, pageWidth, 40, 'F');

    if (this.logoBase64) {
      doc.addImage(this.logoBase64, 'PNG', margin, 8, 25, 25);
    }

    doc.setTextColor(255);
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('SHOESHOP DEMO S.A.S', margin + 30, 18);

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Documento Oficial de Facturación', margin + 30, 26);
    doc.text(`Generado: ${fechaActual}`, pageWidth - margin, 26, {
      align: 'right',
    });

    doc.setTextColor(0);
    doc.setDrawColor(200);
    doc.rect(pageWidth - 70, 45, 55, 30);

    doc.setFont(undefined, 'bold');
    doc.text('FACTURA N°', pageWidth - 65, 52);

    doc.setFontSize(16);
    doc.text(factura.numeroFactura, pageWidth - 65, 62);

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(
      `Fecha Factura: ${new Date(factura.fecha).toLocaleDateString('es-CO')}`,
      pageWidth - 65,
      70,
    );

    let y = 55;

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Proveedor', margin, y);

    y += 7;
    doc.setFont(undefined, 'normal');
    doc.text(this.proveedor.nombre, margin, y);

    y += 6;
    doc.text(`ID: ${this.proveedor.id}`, margin, y);

    y += 15;

    autoTable(doc, {
      startY: y,
      head: [['Descripción', 'Valor Inicial']],
      body: [
        [
          factura.producto,
          factura.valorInicial.toLocaleString('es-CO', {
            style: 'currency',
            currency: 'COP',
          }),
        ],
      ],
      theme: 'grid',
      headStyles: {
        fillColor: [20, 20, 20],
      },
      styles: { fontSize: 10 },
    });

    y = (doc as any).lastAutoTable.finalY + 15;

    if (factura.abonos && factura.abonos.length > 0) {
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Historial de Abonos', margin, y);

      y += 5;

      const abonosOrdenados = [...factura.abonos].sort(
        (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
      );

      autoTable(doc, {
        startY: y,
        head: [['Fecha', 'Comentario', 'Monto']],
        body: abonosOrdenados.map((a) => [
          new Date(a.fecha).toLocaleDateString('es-CO'),
          a.descripcion && a.descripcion.trim().length > 0
            ? a.descripcion
            : '-',
          a.cantidad.toLocaleString('es-CO', {
            style: 'currency',
            currency: 'COP',
          }),
        ]),
        theme: 'striped',
        headStyles: {
          fillColor: [50, 50, 50],
        },
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
      });

      y = (doc as any).lastAutoTable.finalY + 10;
    }

    const totalAbonado =
      factura.abonos?.reduce((t, a) => t + a.cantidad, 0) || 0;

    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);

    doc.text(
      `Total Abonado: ${totalAbonado.toLocaleString('es-CO', {
        style: 'currency',
        currency: 'COP',
      })}`,
      margin,
      y,
    );

    y += 8;

    doc.text(
      `Saldo Pendiente: ${factura.deudaPendiente.toLocaleString('es-CO', {
        style: 'currency',
        currency: 'COP',
      })}`,
      margin,
      y,
    );
    y += 6;

    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');

    if (factura.estado === 'cancelada') {
      doc.setTextColor(0, 128, 0);
      doc.text('Estado: Factura Cancelada', margin, y);
    } else {
      doc.setTextColor(180, 0, 0);
      doc.text('Estado: Factura Pendiente por Cancelar', margin, y);
    }

    doc.setTextColor(0);

    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      'Documento generado automáticamente por el sistema financiero.',
      margin,
      pageHeight - 10,
    );
    this.agregarFirmaDigital(doc, pageWidth, pageHeight);
    doc.save(`Factura_${factura.numeroFactura}.pdf`);
  }

  abrirConfirmacionEliminar(factura: Factura) {
    this.facturaAEliminar = factura;
    this.mostrarConfirmacionEliminar = true;
  }

  cancelarEliminar() {
    this.mostrarConfirmacionEliminar = false;
  }

  async confirmarEliminarFactura() {
    if (!this.facturaAEliminar || this.cargandoEliminar) return;

    this.cargandoEliminar = true;

    try {
      this.proveedor.facturas =
        this.proveedor.facturas?.filter(
          (f) => f.facturaId !== this.facturaAEliminar.facturaId,
        ) || [];

      await this.proveedoresService.actualizarFacturasProveedor(
        this.proveedorId,
        this.proveedor.facturas,
      );

      this.messageService.add({
        severity: 'success',
        summary: 'Eliminado',
        detail: 'Factura eliminada correctamente',
      });

      this.mostrarConfirmacionEliminar = false;
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo eliminar la factura',
      });
    } finally {
      this.cargandoEliminar = false;
    }
  }

  exportarEstadoCuentaPDF(facturas: Factura[]) {
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
    doc.text('Estado de Cuenta del Proveedor', margin + 30, 25);
    doc.text(`Generado: ${fechaActual}`, pageWidth - margin, 25, {
      align: 'right',
    });

    doc.setTextColor(0);
    let y = 55;

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Información del Proveedor', margin, y);

    y += 8;
    doc.setFont(undefined, 'normal');
    doc.text(`Nombre: ${this.proveedor.nombre}`, margin, y);
    y += 6;
    doc.text(`ID: ${this.proveedor.id}`, margin, y);
    y += 6;
    doc.text(
      `Filtro aplicado: ${this.tipoEstadoCuenta.toUpperCase()}`,
      margin,
      y,
    );

    y += 10;

    doc.setFont(undefined, 'bold');
    doc.text(`Total de facturas exportadas: ${facturas.length}`, margin, y);

    y += 12;

    const body = facturas.map((factura) => {
      const totalAbonado =
        factura.abonos?.reduce((t, a) => t + a.cantidad, 0) || 0;

      return [
        factura.numeroFactura,
        factura.producto || '-',
        new Date(factura.fecha).toLocaleDateString('es-CO'),
        factura.valorInicial.toLocaleString('es-CO', {
          style: 'currency',
          currency: 'COP',
        }),
        totalAbonado.toLocaleString('es-CO', {
          style: 'currency',
          currency: 'COP',
        }),
        factura.deudaPendiente.toLocaleString('es-CO', {
          style: 'currency',
          currency: 'COP',
        }),
        factura.estado.toUpperCase(),
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [
        [
          'Factura',
          'Producto',
          'Fecha',
          'Valor Inicial',
          'Abonado',
          'Saldo',
          'Estado',
        ],
      ],
      body,
      theme: 'grid',
      headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8 },
      didParseCell: function (data) {
        if (data.column.index === 6) {
          data.cell.styles.textColor =
            data.cell.raw === 'CANCELADA' ? [245, 158, 11] : [100, 100, 100];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 15;

    const totalInicial = facturas.reduce(
      (total, f) => total + (f.valorInicial || 0),
      0,
    );

    const totalPendiente = facturas.reduce(
      (total, f) => total + (f.deudaPendiente || 0),
      0,
    );

    const totalPagado = totalInicial - totalPendiente;

    const pendientes = facturas.filter((f) => f.estado === 'pendiente').length;
    const canceladas = facturas.filter((f) => f.estado === 'cancelada').length;

    const porcentajePagado = totalInicial > 0 ? totalPagado / totalInicial : 0;

    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text('Resumen Financiero', margin, y);

    y += 10;

    const chartWidth = pageWidth - margin * 2;
    const barHeight = 18;

    doc.setFillColor(240, 240, 240);
    doc.roundedRect(margin, y, chartWidth, barHeight, 4, 4, 'F');

    const steps = 100;
    for (let i = 0; i < steps * porcentajePagado; i++) {
      const stepWidth = chartWidth / steps;

      let r, g, b;

      if (i < steps * 0.5) {
        r = 255;
        g = 235 + ((255 - 235) * i) / (steps * 0.5);
        b = 180 + ((0 - 180) * i) / (steps * 0.5);
      } else {
        r = 255;
        g = 255;
        b = 0;
      }

      doc.setFillColor(r, g, b);
      doc.rect(margin + i * stepWidth, y, stepWidth + 0.5, barHeight, 'F');
    }

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(
      `${(porcentajePagado * 100).toFixed(1)}% PAGADO`,
      pageWidth / 2,
      y + 12,
      { align: 'center' },
    );
    y += 26;

    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');

    doc.text(
      `Total Inicial: ${totalInicial.toLocaleString('es-CO', {
        style: 'currency',
        currency: 'COP',
      })}`,
      margin,
      y,
    );

    y += 6;
    doc.text(
      `Total Pagado: ${totalPagado.toLocaleString('es-CO', {
        style: 'currency',
        currency: 'COP',
      })}`,
      margin,
      y,
    );

    y += 6;
    doc.text(
      `Total Pendiente: ${totalPendiente.toLocaleString('es-CO', {
        style: 'currency',
        currency: 'COP',
      })}`,
      margin,
      y,
    );

    y += 10;

    doc.setFont(undefined, 'bold');
    doc.text('Distribución de Facturas', margin, y);

    y += 8;
    doc.setFont(undefined, 'normal');

    doc.setTextColor(245, 158, 11);
    doc.text(`Canceladas: ${canceladas}`, margin, y);

    y += 6;
    doc.setTextColor(100, 100, 100);
    doc.text(`Pendientes: ${pendientes}`, margin, y);

    doc.setTextColor(0);

    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      'Documento generado automáticamente por el sistema financiero ShoeShop.',
      margin,
      pageHeight - 10,
    );

    this.agregarFirmaDigital(doc, pageWidth, pageHeight);

    doc.save(
      `Estado_Cuenta_${this.proveedor.nombre}_${this.tipoEstadoCuenta}.pdf`,
    );
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

  get rangoInicio(): number {
    return this.facturasFiltradas.length === 0
      ? 0
      : (this.paginaActual - 1) * this.facturasPorPagina + 1;
  }

  get rangoFin(): number {
    const fin = this.paginaActual * this.facturasPorPagina;
    return fin > this.facturasFiltradas.length
      ? this.facturasFiltradas.length
      : fin;
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  cambiarPagina(pagina: number) {
    if (pagina < 1 || pagina > this.totalPaginas) return;
    this.paginaActual = pagina;
  }

  cambiarCantidadPorPagina() {
    this.paginaActual = 1;
  }
}
