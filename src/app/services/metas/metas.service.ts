import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  Timestamp,
  deleteDoc,
} from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';

export interface Meta {
  id?: string;
  vendedorId: string;
  vendedor: string;
  metaVentas: number;
  metaIngresos: number;
  metaMensual: number;
  creadaEn: Timestamp;
  actualizadaEn?: Timestamp;
}

export interface ProgresoVendedor {
  vendedor: string;
  vendedorId: string;
  meta: Meta;
  ventasActuales: number;
  ingresosActuales: number;
  porcentajeVentas: number;
  porcentajeIngresos: number;
  cumplioVentas: boolean;
  cumplioIngresos: boolean;
  cumplioAmbas: boolean;
}

export interface SemanaResumen {
  numero: number;
  meta: number;
  metaCompleta?: number;
  ventas: number;
  porcentaje: number;
  cumplida: boolean;
  esActual: boolean;
  diasEnMes?: number;
  esParcial?: boolean;
}

export interface ProgresoMensualVendedor {
  vendedorId: string;
  vendedor: string;
  metaMensual: number;
  ventasMes: number;
  porcentaje: number;
  cumplioMeta: boolean;
  semanas: SemanaResumen[];
}

@Injectable({ providedIn: 'root' })
export class MetasService {
  private firestore = inject(Firestore);

  private _progreso$ = new BehaviorSubject<ProgresoVendedor[]>([]);
  progreso$ = this._progreso$.asObservable();

  private _progresoMensual$ = new BehaviorSubject<ProgresoMensualVendedor[]>(
    [],
  );
  progresoMensual$ = this._progresoMensual$.asObservable();

  private _cargando$ = new BehaviorSubject<boolean>(false);
  cargando$ = this._cargando$.asObservable();

  getSemanaActualInicio(): Date {
    const hoy = new Date();
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - hoy.getDay());
    inicio.setHours(0, 0, 0, 0);
    return inicio;
  }

  getSemanaActualFin(): Date {
    const inicio = this.getSemanaActualInicio();
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 6);
    fin.setHours(23, 59, 59, 999);
    return fin;
  }

  private getSemanasDelMes(
    anio: number,
    mes: number,
  ): { inicio: Date; fin: Date; diasEnMes: number; esParcial: boolean }[] {
    const resultado: {
      inicio: Date;
      fin: Date;
      diasEnMes: number;
      esParcial: boolean;
    }[] = [];

    const primerDia = new Date(anio, mes, 1);
    primerDia.setHours(0, 0, 0, 0);
    const ultimoDia = new Date(anio, mes + 1, 0);
    ultimoDia.setHours(23, 59, 59, 999);

    let cursor = new Date(primerDia);
    cursor.setDate(cursor.getDate() - cursor.getDay());
    cursor.setHours(0, 0, 0, 0);

    while (cursor <= ultimoDia) {
      const inicioSem = new Date(cursor);
      const finSem = new Date(cursor);
      finSem.setDate(cursor.getDate() + 6);
      finSem.setHours(23, 59, 59, 999);

      if (finSem >= primerDia && inicioSem <= ultimoDia) {
        const inicioEfectivo = inicioSem < primerDia ? primerDia : inicioSem;
        const finEfectivo = finSem > ultimoDia ? ultimoDia : finSem;
        const msEnMes = finEfectivo.getTime() - inicioEfectivo.getTime();
        const diasEnMes = Math.round(msEnMes / (1000 * 60 * 60 * 24)) + 1;
        const esParcial = diasEnMes < 7;

        resultado.push({
          inicio: inicioEfectivo,
          fin: finEfectivo,
          diasEnMes,
          esParcial,
        });
      }

      cursor.setDate(cursor.getDate() + 7);
    }

    return resultado;
  }

  private cuentaComoUnidad(venta: any): boolean {
    if (venta['tipoVenta'] === 'Cambio' && !venta['esMismoDia']) return false;
    if (venta['tipoVenta'] === 'Bono') return false;
    return true;
  }

  async guardarMeta(
    vendedorId: string,
    vendedor: string,
    metaVentas: number,
    metaIngresos: number,
    metaMensual?: number,
  ): Promise<void> {
    const ref = doc(this.firestore, 'metas', vendedorId);
    await setDoc(
      ref,
      {
        id: vendedorId,
        vendedorId,
        vendedor,
        metaVentas,
        metaIngresos,
        metaMensual: metaMensual ?? metaVentas * 4,
        creadaEn: Timestamp.now(),
        actualizadaEn: Timestamp.now(),
      },
      { merge: true },
    );
  }

  async eliminarMeta(vendedorId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'metas', vendedorId));
  }

  async getMetasActivas(): Promise<Meta[]> {
    const snap = await getDocs(collection(this.firestore, 'metas'));
    return snap.docs.map((d) => d.data() as Meta);
  }

  async calcularProgreso(): Promise<ProgresoVendedor[]> {
    this._cargando$.next(true);
    try {
      const ahora = new Date();
      const mesActual = ahora.getMonth();
      const anioActual = ahora.getFullYear();

      const inicioMes = new Date(anioActual, mesActual, 1);
      inicioMes.setHours(0, 0, 0, 0);
      const finMes = new Date(anioActual, mesActual + 1, 0);
      finMes.setHours(23, 59, 59, 999);

      const [metas, ventasSnap] = await Promise.all([
        this.getMetasActivas(),
        getDocs(
          query(
            collection(this.firestore, 'ventas'),
            where('fechaVenta', '>=', Timestamp.fromDate(inicioMes)),
            where('fechaVenta', '<=', Timestamp.fromDate(finMes)),
          ),
        ),
      ]);

      const todasLasVentas = ventasSnap.docs.map((d) => {
        const fechaVenta = d.data()['fechaVenta'];
        let fecha = new Date();

        if (fechaVenta instanceof Timestamp) {
          fecha = fechaVenta.toDate();
        } else if (typeof fechaVenta === 'string') {
          fecha = new Date(fechaVenta);
        }

        return {
          ...d.data(),
          _fecha: fecha,
        };
      });

      const ventasValidas = todasLasVentas.filter(
        (v) =>
          v['tipoVenta'] !== 'Devuelto por cambio' &&
          v['tipoVenta'] !== 'Devuelto por bono',
      );

      const semanaInicio = this.getSemanaActualInicio();
      const semanaFin = this.getSemanaActualFin();
      const ventasSemana = ventasValidas.filter(
        (v) => v._fecha >= semanaInicio && v._fecha <= semanaFin,
      );

      const progresos: ProgresoVendedor[] = metas.map((meta) => {
        const ventasVendedor = ventasSemana
          .filter((v) => v['vendedor'] === meta.vendedor)
          .filter((v) => this.cuentaComoUnidad(v));
        const ventasActuales = ventasVendedor.length;
        const ingresosActuales = ventasVendedor.reduce(
          (sum, v) => sum + (v['precio'] || 0),
          0,
        );

        const porcentajeVentas =
          meta.metaVentas > 0
            ? Math.min(
                Math.round((ventasActuales / meta.metaVentas) * 100),
                100,
              )
            : 0;
        const porcentajeIngresos =
          meta.metaIngresos > 0
            ? Math.min(
                Math.round((ingresosActuales / meta.metaIngresos) * 100),
                100,
              )
            : 0;

        return {
          vendedor: meta.vendedor,
          vendedorId: meta.vendedorId,
          meta,
          ventasActuales,
          ingresosActuales,
          porcentajeVentas,
          porcentajeIngresos,
          cumplioVentas: ventasActuales >= meta.metaVentas,
          cumplioIngresos: ingresosActuales >= meta.metaIngresos,
          cumplioAmbas:
            ventasActuales >= meta.metaVentas &&
            ingresosActuales >= meta.metaIngresos,
        };
      });

      progresos.sort((a, b) => {
        if (a.cumplioAmbas && !b.cumplioAmbas) return -1;
        if (!a.cumplioAmbas && b.cumplioAmbas) return 1;
        const promA = (a.porcentajeVentas + a.porcentajeIngresos) / 2;
        const promB = (b.porcentajeVentas + b.porcentajeIngresos) / 2;
        return promB - promA;
      });

      const semanasDelMes = this.getSemanasDelMes(anioActual, mesActual);
      const hoy = new Date();

      const progresosMensuales: ProgresoMensualVendedor[] = metas.map(
        (meta) => {
          const metaMensual = meta.metaMensual || meta.metaVentas * 4;

          const semanas: SemanaResumen[] = semanasDelMes.map((rango, idx) => {
            const ventasSem = ventasValidas
              .filter(
                (v) =>
                  v['vendedor'] === meta.vendedor &&
                  v._fecha >= rango.inicio &&
                  v._fecha <= rango.fin,
              )
              .filter((v) => this.cuentaComoUnidad(v));
            const ventas = ventasSem.length;
            const porcentaje =
              meta.metaVentas > 0
                ? Math.round((ventas / meta.metaVentas) * 100)
                : 0;
            const esActual = hoy >= rango.inicio && hoy <= rango.fin;

            return {
              numero: idx + 1,
              meta: meta.metaVentas,
              ventas,
              porcentaje,
              cumplida: ventas >= meta.metaVentas,
              esActual,
            };
          });

          const ventasMes = semanas.reduce((acc, s) => acc + s.ventas, 0);
          const porcentaje =
            metaMensual > 0 ? Math.round((ventasMes / metaMensual) * 100) : 0;

          return {
            vendedorId: meta.vendedorId,
            vendedor: meta.vendedor,
            metaMensual,
            ventasMes,
            porcentaje,
            cumplioMeta: ventasMes >= metaMensual,
            semanas,
          };
        },
      );

      this._progreso$.next(progresos);
      this._progresoMensual$.next(progresosMensuales);
      return progresos;
    } finally {
      this._cargando$.next(false);
    }
  }
}
