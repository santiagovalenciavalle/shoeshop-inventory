import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from '@angular/fire/firestore';

export interface AlertaReposicion {
  zapatoId: number;
  marca: string;
  referencia: string;
  talla: string;
  imagen?: string;
  stockActual: number;
  precioMin: number;
  ventasPorSemana: number;
  diasParaAgotarse: number;
  urgencia: 'critica' | 'alta' | 'media';
  historialSemanas: number[];
}

@Injectable({ providedIn: 'root' })
export class ReposicionService {
  private firestore = inject(Firestore);

  async calcularAlertas(
    diasHistorial: number = 28,
  ): Promise<AlertaReposicion[]> {
    const desde = new Date();
    desde.setDate(desde.getDate() - diasHistorial);
    desde.setHours(0, 0, 0, 0);

    const [productosSnap, ventasSnap] = await Promise.all([
      getDocs(
        query(collection(this.firestore, 'productos'), where('stock', '>', 0)),
      ),
      getDocs(
        query(
          collection(this.firestore, 'ventas'),
          where('fechaVenta', '>=', Timestamp.fromDate(desde)),
          orderBy('fechaVenta', 'desc'),
        ),
      ),
    ]);

    const ventas = ventasSnap.docs
      .map((d) => d.data())
      .filter((v) => {
        const tipo = (v['tipoVenta'] ?? '').toLowerCase().trim();
        if (tipo === 'devuelto por bono') return false;
        if (tipo === 'devuelto por cambio') return false;
        if (tipo === 'bono') return false;
        if (
          (tipo === 'cambio' || tipo === 'cambio exhibicion') &&
          v['esMismoDia'] === false
        )
          return false;
        return true;
      });

    const alertas: AlertaReposicion[] = [];

    for (const doc of productosSnap.docs) {
      const prod = doc.data();
      const id = Number(prod['id']);
      const stock = prod['stock'] ?? 0;
      if (stock <= 0 || id === undefined) continue;

      const ventasProducto = ventas.filter((v) => Number(v['zapatoId']) === id);

      if (ventasProducto.length === 0) continue;

      const historialSemanas: number[] = [];
      for (let i = 0; i < 4; i++) {
        const inicioSemana = new Date();
        inicioSemana.setDate(
          inicioSemana.getDate() - inicioSemana.getDay() - i * 7,
        );
        inicioSemana.setHours(0, 0, 0, 0);
        const finSemana = new Date(inicioSemana);
        finSemana.setDate(inicioSemana.getDate() + 6);
        finSemana.setHours(23, 59, 59, 999);

        const ventasSemana = ventasProducto.filter((v) => {
          const fecha = v['fechaVenta']?.seconds
            ? new Date(v['fechaVenta'].seconds * 1000)
            : new Date(v['fechaVenta']);
          return fecha >= inicioSemana && fecha <= finSemana;
        }).length;

        historialSemanas.push(ventasSemana);
      }

      const pesos = [0.4, 0.3, 0.2, 0.1];
      const ventasPorSemana = historialSemanas.reduce(
        (sum, v, i) => sum + v * pesos[i],
        0,
      );

      if (ventasPorSemana <= 0) continue;

      const diasParaAgotarse = Math.floor((stock / ventasPorSemana) * 7);

      if (diasParaAgotarse > 14) continue;

      const urgencia: AlertaReposicion['urgencia'] =
        diasParaAgotarse <= 3
          ? 'critica'
          : diasParaAgotarse <= 7
            ? 'alta'
            : 'media';

      alertas.push({
        zapatoId: id,
        marca: prod['marca'] ?? '',
        referencia: prod['referencia'] ?? '',
        talla: prod['talla'] ?? '',
        imagen: prod['imagen'] ?? '',
        stockActual: stock,
        precioMin: prod['precioMin'] ?? 0,
        ventasPorSemana: Math.round(ventasPorSemana * 10) / 10,
        diasParaAgotarse,
        urgencia,
        historialSemanas,
      });
    }

    return alertas.sort((a, b) => {
      const orden = { critica: 0, alta: 1, media: 2 };
      if (orden[a.urgencia] !== orden[b.urgencia])
        return orden[a.urgencia] - orden[b.urgencia];
      return a.diasParaAgotarse - b.diasParaAgotarse;
    });
  }
}
