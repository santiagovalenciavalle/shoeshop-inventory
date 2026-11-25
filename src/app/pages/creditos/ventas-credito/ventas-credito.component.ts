import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Venta } from '../../interfaces';
import { SalesService } from '../../../services/vendedorServices/ventas/sales.service';

interface VentaConFechas extends Venta {
  venta: string;
  pago: string;
  fechaPagoDate: Date;
}

interface GrupoDia {
  fecha: string;
  fechaDate: Date;
  total: number;
  ventas: VentaConFechas[];
}

interface GrupoMes {
  mes: string;
  mesKey: string;
  totalMes: number;
  dias: GrupoDia[];
}

@Component({
  selector: 'app-ventas-credito',
  imports: [CommonModule],
  templateUrl: './ventas-credito.component.html',
  styleUrls: ['./ventas-credito.component.css'],
})
export class VentasCreditoComponent implements OnChanges {
  @Input() credito!: 'sistecredito' | 'addi';
  ventasFiltradas: Venta[] = [];

  proximos: GrupoDia[] = [];
  porMes: GrupoMes[] = [];

  totalDeuda: number = 0;
  totalMesActual: number = 0;

  locales: { nombre: string; ventas: VentaConFechas[]; totalVentas: number }[] =
    [];

  fechaActiva: number = 0;
  mesActivo: string = '';

  constructor(private salesService: SalesService) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['credito'] && this.credito) {
      this.cargarVentas(this.credito);
    }
  }

  async cargarVentas(credito: 'sistecredito' | 'addi') {
    this.ventasFiltradas =
      await this.salesService.obtenerVentasPorCredito(credito);

    this.ventasFiltradas = this.ventasFiltradas.filter(
      (v) =>
        v.tipoVenta !== 'Devuelto por bono' &&
        v.tipoVenta !== 'Devuelto por cambio',
    );

    const hoy = new Date();
    const mesesCredito = credito === 'sistecredito' ? 3 : 1;

    this.ventasFiltradas.forEach((v) => {
      let fechaVenta: Date;
      if ((v.fechaVenta as any)?.toDate) {
        fechaVenta = (v.fechaVenta as any).toDate();
      } else {
        fechaVenta = new Date(v.fechaVenta);
      }
      const fechaPago = new Date(fechaVenta);
      fechaPago.setMonth(fechaPago.getMonth() + mesesCredito);
      (v as any).fechaPagoCalculada = fechaPago;
    });

    const ventasFuturas = this.ventasFiltradas.filter(
      (v) => (v as any).fechaPagoCalculada >= hoy,
    );

    this.totalDeuda = ventasFuturas.reduce((sum, v) => sum + v.precio, 0);

    const mesHoy = hoy.getMonth();
    const anioHoy = hoy.getFullYear();
    const inicioDeMes = new Date(anioHoy, mesHoy, 1);
    const finDeMes = new Date(anioHoy, mesHoy + 1, 0, 23, 59, 59, 999);

    this.totalMesActual = this.ventasFiltradas
      .filter((v) => {
        const fp: Date = (v as any).fechaPagoCalculada;
        return fp >= inicioDeMes && fp <= finDeMes;
      })
      .reduce((sum, v) => sum + v.precio, 0);

    const mapaDia: { [fecha: string]: VentaConFechas[] } = {};
    ventasFuturas.forEach((v) => {
      const fechaPago: Date = (v as any).fechaPagoCalculada;
      const fechaStr = fechaPago.toLocaleDateString('es-CO');
      const vc: VentaConFechas = {
        ...v,
        venta: ((v.fechaVenta as any)?.toDate
          ? (v.fechaVenta as any).toDate()
          : new Date(v.fechaVenta)
        ).toLocaleDateString('es-CO'),
        pago: fechaStr,
        fechaPagoDate: fechaPago,
      };
      if (!mapaDia[fechaStr]) mapaDia[fechaStr] = [];
      mapaDia[fechaStr].push(vc);
    });

    this.proximos = Object.keys(mapaDia)
      .map((fecha) => ({
        fecha,
        fechaDate: mapaDia[fecha][0].fechaPagoDate,
        total: mapaDia[fecha].reduce((sum, v) => sum + v.precio, 0),
        ventas: mapaDia[fecha],
      }))
      .sort((a, b) => b.fechaDate.getTime() - a.fechaDate.getTime());

    this.fechaActiva = 0;

    const mapaMes: { [key: string]: GrupoMes } = {};
    this.proximos.forEach((dia) => {
      const d = dia.fechaDate;
      const mesKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const mesLabel = d.toLocaleDateString('es-CO', {
        month: 'long',
        year: 'numeric',
      });
      const mesNombre = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1);
      if (!mapaMes[mesKey]) {
        mapaMes[mesKey] = { mes: mesNombre, mesKey, totalMes: 0, dias: [] };
      }
      mapaMes[mesKey].totalMes += dia.total;
      mapaMes[mesKey].dias.push(dia);
    });

    this.porMes = Object.values(mapaMes).sort((a, b) =>
      b.mesKey.localeCompare(a.mesKey),
    );
    this.mesActivo = this.porMes[0]?.mesKey ?? '';

    const mapaLocales: { [nombre: string]: VentaConFechas[] } = {};
    ventasFuturas.forEach((v) => {
      const nombre = v.local || 'Sin local';
      const vc: VentaConFechas = {
        ...v,
        venta: ((v.fechaVenta as any)?.toDate
          ? (v.fechaVenta as any).toDate()
          : new Date(v.fechaVenta)
        ).toLocaleDateString('es-CO'),
        pago: (v as any).fechaPagoCalculada.toLocaleDateString('es-CO'),
        fechaPagoDate: (v as any).fechaPagoCalculada,
      };
      if (!mapaLocales[nombre]) mapaLocales[nombre] = [];
      mapaLocales[nombre].push(vc);
    });

    this.locales = Object.keys(mapaLocales).map((nombre) => {
      const ventasOrdenadas = mapaLocales[nombre].sort(
        (a, b) => b.fechaPagoDate.getTime() - a.fechaPagoDate.getTime(),
      );
      return {
        nombre,
        ventas: ventasOrdenadas.slice(0, 3),
        totalVentas: ventasOrdenadas.length,
      };
    });
  }

  seleccionarFecha(index: number) {
    this.fechaActiva = index;
  }

  toggleMes(mesKey: string) {
    this.mesActivo = this.mesActivo === mesKey ? '' : mesKey;
  }

  trackByFecha(_: number, item: GrupoDia) {
    return item.fecha;
  }
  trackByMes(_: number, item: GrupoMes) {
    return item.mesKey;
  }
}
