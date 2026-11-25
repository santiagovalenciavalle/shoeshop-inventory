import * as scheduler from 'firebase-functions/v2/scheduler';
import * as https from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import corsLib from 'cors';
import { defineSecret } from 'firebase-functions/params';
import { enviarReporteEmail, ReporteData } from './gmail';
import { obtenerPronosticoManana, predecirTrafico } from './gmail';

const OPENWEATHER_KEY = defineSecret('OPENWEATHER_KEY');
const GMAIL_USER = defineSecret('GMAIL_USER');
const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD');

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

const cors = corsLib({
  origin: true,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

async function obtenerEmailsAdmins(): Promise<string[]> {
  try {
    const snap = await db
      .collection('usuarios')
      .where('role', '==', 'admin')
      .get();
    const emails: string[] = [];
    for (const doc of snap.docs) {
      const email: string = doc.data()['emailReporte'] ?? '';
      if (email) emails.push(email);
    }
    return emails;
  } catch (e) {
    console.error('obtenerEmailsAdmins:', e);
    return [];
  }
}

async function construirReporteData(): Promise<ReporteData> {
  const ahora = new Date();
  const utc = ahora.getTime() + ahora.getTimezoneOffset() * 60000;
  const deCol = new Date(utc + 3600000 * -5);

  const hoy = new Date(
    Date.UTC(
      deCol.getFullYear(),
      deCol.getMonth(),
      deCol.getDate(),
      5,
      0,
      0,
      0,
    ),
  );

  const fin = new Date(
    Date.UTC(
      deCol.getFullYear(),
      deCol.getMonth(),
      deCol.getDate() + 1,
      4,
      59,
      59,
      999,
    ),
  );

  let ventas: any[] = [];
  try {
    const snap = await db
      .collection('ventas')
      .where('fechaVenta', '>=', admin.firestore.Timestamp.fromDate(hoy))
      .where('fechaVenta', '<=', admin.firestore.Timestamp.fromDate(fin))
      .get();
    ventas = snap.docs.map((d) => d.data()).filter(esVentaValida);
  } catch (e) {
    console.error('ventas:', e);
  }

  const ingresoTotal = ventas.reduce((s, v) => s + (v['precio'] || 0), 0);
  const preciosBajos = ventas.filter((v) => v['precioBajo']).length;

  const porVendedor: Record<string, { ventas: number; ingresos: number }> = {};
  const porLocal: Record<string, { ventas: number; ingresos: number }> = {};
  for (const v of ventas) {
    const vend: string = v['vendedor'] ?? 'Sin nombre';
    if (!porVendedor[vend]) porVendedor[vend] = { ventas: 0, ingresos: 0 };
    porVendedor[vend].ventas++;
    porVendedor[vend].ingresos += v['precio'] || 0;

    const loc: string = v['local'] ?? 'Sin local';
    if (!porLocal[loc]) porLocal[loc] = { ventas: 0, ingresos: 0 };
    porLocal[loc].ventas++;
    porLocal[loc].ingresos += v['precio'] || 0;
  }
  const liderEntry = Object.entries(porVendedor).sort(
    (a, b) => b[1].ingresos - a[1].ingresos,
  )[0];
  const lider = liderEntry
    ? `${liderEntry[0].split(' ')[0]}: ${liderEntry[1].ventas} ventas · $${liderEntry[1].ingresos.toLocaleString('es-CO')}`
    : 'Sin ventas';

  let prestamos: any[] = [];
  try {
    prestamos = (await db.collection('prestamos').get()).docs.map((d) =>
      d.data(),
    );
  } catch (e) {
    console.error('prestamos:', e);
  }

  const prestamosViejos = prestamos.filter((p) => {
    if (!p['fechaPrestamo']?.seconds) return false;
    const dias = Math.floor(
      (hoy.getTime() - p['fechaPrestamo'].seconds * 1000) / 86400000,
    );
    return dias > 7;
  }).length;

  let todosPedidos: any[] = [];
  try {
    todosPedidos = (await db.collection('pedidos').get()).docs.map((d) =>
      d.data(),
    );
  } catch (e) {
    console.error('pedidos:', e);
  }

  const viejosRecibidos = todosPedidos.filter(
    (p) => p['estado'] === 'Recibido' && esPedidoViejo(p, hoy),
  ).length;
  const devueltosViejos = todosPedidos.filter(
    (p) => p['estado'] === 'Devuelto' && esPedidoViejo(p, hoy),
  ).length;

  let historialHoy: any[] = [];
  try {
    const snap = await db
      .collection('historial-bodega')
      .where('fecha', '>=', hoy.toISOString())
      .where('fecha', '<=', fin.toISOString())
      .get();
    historialHoy = snap.docs.map((d) => d.data());
  } catch (e) {
    console.error('historial-bodega:', e);
  }

  const salidasHoy = historialHoy.filter((h) => h['tipo'] === 'salida').length;
  const devolucionesHoy = historialHoy.filter(
    (h) => h['tipo'] === 'devolucion',
  ).length;
  const exhibHoy = historialHoy.filter(
    (h) => h['tipo'] === 'salida' && h['lugar'] === 'exhibicion',
  ).length;
  const pedidosHoy = historialHoy.filter(
    (h) => h['tipo'] === 'salida' && h['lugar'] === 'pedido',
  ).length;

  let exhibicionesPendientes = 0;
  try {
    const tiposExhib = [
      'venta-exhibicion',
      'prestamo-exhibicion',
      'cambio-exhibicion',
    ];
    const snap = await db.collection('notifications').get();
    exhibicionesPendientes = snap.docs
      .map((d) => d.data())
      .filter((n) => tiposExhib.includes(n['tipo'])).length;
  } catch (e) {
    console.error('notifications:', e);
  }

  let llegadasHoy: any[] = [];
  try {
    const snap = await db
      .collection('llegadas')
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(hoy))
      .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(fin))
      .get();
    llegadasHoy = snap.docs.map((d) => d.data());
  } catch (e) {
    console.error('llegadas:', e);
  }

  const llegadasTarde = llegadasHoy.filter((l) =>
    esLlegadaTarde(l['hora'] ?? ''),
  );
  const nombresTarde = llegadasTarde
    .map((l) => (l['nombre'] ?? '').split(' ')[0])
    .join(', ');

  const fechaStr = deCol.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const manana = new Date(deCol);
  manana.setDate(manana.getDate() + 1);

  const apiKey = process.env.OPENWEATHER_KEY ?? '';
  const clima = await obtenerPronosticoManana(apiKey, 'Medellin,CO');
  const prediccion = predecirTrafico(clima, manana);

  return {
    fecha: fechaStr.charAt(0).toUpperCase() + fechaStr.slice(1),
    ventas: {
      total: ventas.length,
      ingresoTotal,
      preciosBajos,
      lider,
      porLocal,
    },
    bodega: {
      pedidosHoy,
      exhibHoy,
      salidasHoy,
      devolucionesHoy,
      paresNetos: salidasHoy - devolucionesHoy,
      exhibicionesPendientes,
    },
    pedidos: {
      pendientes: todosPedidos.filter((p) => p['estado'] === 'Pendiente')
        .length,
      recibidos: todosPedidos.filter((p) => p['estado'] === 'Recibido').length,
      devueltos: todosPedidos.filter((p) => p['estado'] === 'Devuelto').length,
      viejosRecibidos,
      devueltosViejos,
    },
    prestamos: {
      total: prestamos.length,
      criticos: prestamosViejos,
    },
    llegadas: {
      total: llegadasHoy.length,
      tarde: llegadasTarde.length,
      nombresTarde,
    },
    clima,
    prediccion,
  };
}

function esVentaValida(v: any): boolean {
  const tipo: string = (v['tipoVenta'] ?? '').toLowerCase().trim();
  if (
    tipo === 'devuelto por bono' ||
    tipo === 'devuelto por cambio' ||
    tipo === 'bono'
  )
    return false;
  if (
    (tipo === 'cambio' || tipo === 'cambio exhibicion') &&
    v['esMismoDia'] === false
  )
    return false;
  return true;
}

function esPedidoViejo(pedido: any, hoyInicio: Date): boolean {
  const horaStr = pedido['hora'];
  if (!horaStr) return false;
  const fecha = new Date(horaStr);
  if (isNaN(fecha.getTime())) return false;
  fecha.setHours(0, 0, 0, 0);
  return fecha < hoyInicio;
}

function esLlegadaTarde(horaStr: string): boolean {
  if (!horaStr) return false;
  const match = horaStr.match(/(\d{1,2}):(\d{2})\s*(a\.m\.|p\.m\.)/i);
  if (!match) return false;
  let horas = parseInt(match[1]);
  const minutos = parseInt(match[2]);
  const periodo = match[3].toLowerCase().replace(/\./g, '');
  if (periodo === 'pm' && horas !== 12) horas += 12;
  if (periodo === 'am' && horas === 12) horas = 0;
  return horas * 60 + minutos > 9 * 60 + 20;
}

function formatCOP(n: number): string {
  return '$' + n.toLocaleString('es-CO');
}

async function obtenerNumerosAdminsPremier(): Promise<string[]> {
  try {
    const snap = await db
      .collection('usuarios')
      .where('role', '==', 'admin')
      .get();
    const numeros: string[] = [];
    for (const doc of snap.docs) {
      const numero: string = doc.data()['numeroBodega'] ?? '';
      if (numero) numeros.push(`whatsapp:+57${numero.replace(/\D/g, '')}`);
    }
    return numeros;
  } catch (e) {
    console.error(e);
    return [];
  }
}

async function generarReporte(): Promise<string> {
  const ahora = new Date();
  const utc = ahora.getTime() + ahora.getTimezoneOffset() * 60000;
  const deCol = new Date(utc + 3600000 * -5);

  const hoy = new Date(deCol);
  hoy.setHours(0, 0, 0, 0);

  const fin = new Date(deCol);
  fin.setHours(23, 59, 59, 999);

  let ventas: any[] = [];
  try {
    const snap = await db
      .collection('ventas')
      .where('fechaVenta', '>=', admin.firestore.Timestamp.fromDate(hoy))
      .where('fechaVenta', '<=', admin.firestore.Timestamp.fromDate(fin))
      .get();
    ventas = snap.docs.map((d) => d.data()).filter(esVentaValida);
  } catch (err) {
    console.error('ventas:', err);
  }

  let prestamos: any[] = [];
  try {
    prestamos = (await db.collection('prestamos').get()).docs.map((d) =>
      d.data(),
    );
  } catch (err) {
    console.error('prestamos:', err);
  }

  let todosPedidos: any[] = [];
  try {
    todosPedidos = (await db.collection('pedidos').get()).docs.map((d) =>
      d.data(),
    );
  } catch (err) {
    console.error('pedidos:', err);
  }

  let historialHoy: any[] = [];
  try {
    const snap = await db
      .collection('historial-bodega')
      .where('fecha', '>=', hoy.toISOString())
      .where('fecha', '<=', fin.toISOString())
      .get();
    historialHoy = snap.docs.map((d) => d.data());
  } catch (err) {
    console.error('historial-bodega:', err);
  }

  let llegadasHoy: any[] = [];
  try {
    const snap = await db
      .collection('llegadas')
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(hoy))
      .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(fin))
      .get();
    llegadasHoy = snap.docs.map((d) => d.data());
  } catch (err) {
    console.error('llegadas:', err);
  }

  let exhibicionesPendientes = 0;
  try {
    const tiposExhib = [
      'venta-exhibicion',
      'prestamo-exhibicion',
      'cambio-exhibicion',
    ];
    const snap = await db.collection('notifications').get();
    exhibicionesPendientes = snap.docs
      .map((d) => d.data())
      .filter((n) => tiposExhib.includes(n['tipo'])).length;
  } catch (err) {
    console.error('notifications:', err);
  }

  const ingresoTotal = ventas.reduce((s, v) => s + (v['precio'] || 0), 0);
  const preciosBajos = ventas.filter((v) => v['precioBajo']).length;

  const porVendedor: Record<string, { ventas: number; ingresos: number }> = {};
  for (const v of ventas) {
    const k: string = v['vendedor'] ?? 'Sin nombre';
    if (!porVendedor[k]) porVendedor[k] = { ventas: 0, ingresos: 0 };
    porVendedor[k].ventas++;
    porVendedor[k].ingresos += v['precio'] || 0;
  }
  const lider = Object.entries(porVendedor).sort(
    (a, b) => b[1].ingresos - a[1].ingresos,
  )[0];

  const pendientes = todosPedidos.filter(
    (p) => p['estado'] === 'Pendiente',
  ).length;
  const recibidos = todosPedidos.filter(
    (p) => p['estado'] === 'Recibido',
  ).length;
  const devueltos = todosPedidos.filter(
    (p) => p['estado'] === 'Devuelto',
  ).length;

  const viejosRecibidos = todosPedidos.filter(
    (p) => p['estado'] === 'Recibido' && esPedidoViejo(p, hoy),
  );
  const devueltosViejos = todosPedidos.filter(
    (p) => p['estado'] === 'Devuelto' && esPedidoViejo(p, hoy),
  );

  const prestamosViejos = prestamos.filter((p) => {
    if (!p['fechaPrestamo']?.seconds) return false;
    const dias = Math.floor(
      (hoy.getTime() - p['fechaPrestamo'].seconds * 1000) / 86400000,
    );
    return dias > 7;
  }).length;

  const salidasHoy = historialHoy.filter((h) => h['tipo'] === 'salida').length;
  const devolucionesHoy = historialHoy.filter(
    (h) => h['tipo'] === 'devolucion',
  ).length;
  const exhibHoy = historialHoy.filter(
    (h) => h['tipo'] === 'salida' && h['lugar'] === 'exhibicion',
  ).length;
  const pedidosHoy = historialHoy.filter(
    (h) => h['tipo'] === 'salida' && h['lugar'] === 'pedido',
  ).length;
  const paresNetos = salidasHoy - devolucionesHoy;

  const llegadasTarde = llegadasHoy.filter((l) =>
    esLlegadaTarde(l['hora'] ?? ''),
  );
  const nombresTarde = llegadasTarde
    .map((l) => (l['nombre'] ?? '').split(' ')[0])
    .join(', ');

  const fechaStr = deCol.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const liderStr = lider
    ? `${lider[0].split(' ')[0]}: ${lider[1].ventas} vtas · ${formatCOP(lider[1].ingresos)}`
    : 'Sin ventas';

  let reporte = `📊 SHOESHOP · ${fechaStr.toUpperCase()}

💰 VENTAS DEL DÍA
• ${ventas.length} ventas · ${formatCOP(ingresoTotal)}
• Líder: ${liderStr}${preciosBajos > 0 ? `\n⚠️ Precios bajos: ${preciosBajos}` : ''}

📦 BODEGA HOY
• Salidas: ${pedidosHoy} pedidos + ${exhibHoy} exhib = ${salidasHoy} pares
• Devoluciones aceptadas: ${devolucionesHoy}
• Pares netos fuera: ${paresNetos}
• Exhib. pendientes por reponer: ${exhibicionesPendientes}

🗂 PEDIDOS
• Pendientes: ${pendientes} · Recibidos: ${recibidos} · Devueltos: ${devueltos}${viejosRecibidos.length > 0 ? `\n⚠️ Recibidos de días anteriores: ${viejosRecibidos.length}` : ''}${devueltosViejos.length > 0 ? `\n⚠️ Devueltos sin aceptar de días anteriores: ${devueltosViejos.length}` : ''}

👟 PRÉSTAMOS
• Activos: ${prestamos.length}${prestamosViejos > 0 ? ` · Críticos +7 días: ${prestamosViejos} ⚠️` : ''}

👥 LLEGADAS (${llegadasHoy.length} registros)
• Tarde: ${llegadasTarde.length > 0 ? `${llegadasTarde.length} — ${nombresTarde}` : 'Todos puntuales ✅'}`;

  const firma = `

🤖 Analizado y optimizado por la IA de ShoeShop.
Estamos automatizando cada proceso para llevar nuestra marca al más alto nivel. Tienes a tu disposición un asesor experto en ventas y crecimiento.

📈 TU COPILOTO:
Compártenos tus finanzas para organizarlas mejor o pídenos consejos para potenciar locales, motivar trabajadores y solucionar problemas. ¡Consultor activo 24/7 para ayudarte a crecer! 🚀`;

  const limite = 1600 - firma.length - 10;
  if (reporte.length > limite) {
    reporte = reporte.substring(0, limite) + '\n...';
  }

  return reporte + firma;
}

async function enviarWhatsApp(
  numeros: string[],
  reporte: string,
): Promise<void> {
  const { default: twilio } = await import('twilio');
  const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID ?? '',
    process.env.TWILIO_AUTH_TOKEN ?? '',
  );

  for (const numero of numeros) {
    try {
      await twilioClient.messages.create({
        from: 'whatsapp:+14155238886',
        to: numero,
        body: reporte,
      });
      console.log('Enviado a', numero);
    } catch (err: any) {
      console.error('Error Twilio:', err.message);
    }
  }
}

export const reporteDiario = scheduler.onSchedule(
  {
    schedule: '0 20 * * *',
    timeZone: 'America/Bogota',
    secrets: [GMAIL_USER, GMAIL_APP_PASSWORD, OPENWEATHER_KEY],
  },
  async () => {
    const gmailUser = GMAIL_USER.value();
    const gmailPass = GMAIL_APP_PASSWORD.value();

    const reporte = await generarReporte();

    try {
      const emails = await obtenerEmailsAdmins();
      if (emails.length > 0) {
        const reporteData = await construirReporteData();
        await enviarReporteEmail(gmailUser, gmailPass, emails, reporteData);
      }
    } catch (err: any) {
      console.error('Error enviando email:', err.message);
    }
  },
);

export const enviarReporteManual = https.onRequest(
  {
    region: 'us-central1',
    secrets: [GMAIL_USER, GMAIL_APP_PASSWORD, OPENWEATHER_KEY],
  },
  (req, res) => {
    cors(req, res, async () => {
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }

      try {
        let bodyData = req.body;
        if (typeof bodyData === 'string') {
          try {
            bodyData = JSON.parse(bodyData);
          } catch {
            bodyData = {};
          }
        }

        const gmailUser = GMAIL_USER.value();
        const gmailPass = GMAIL_APP_PASSWORD.value();

        const emailsRaw: string[] = bodyData?.emails ?? [];
        const emails =
          emailsRaw.length > 0 ? emailsRaw : await obtenerEmailsAdmins();

        if (emails.length > 0) {
          const reporteData = await construirReporteData();
          await enviarReporteEmail(gmailUser, gmailPass, emails, reporteData);
          console.log(`✅ Email manual enviado a: ${emails.join(', ')}`);
        }

        res
          .status(200)
          .json({ ok: true, completado: true, emailsEnviados: emails.length });
      } catch (error: any) {
        console.error('enviarReporteManual email error:', error);
        res.status(200).json({ ok: false, error: error.message });
      }
    });
  },
);
export const reportePing = scheduler.onSchedule(
  {
    schedule: '30 19 * * *',
    timeZone: 'America/Bogota',
  },
  async () => {
    try {
      let numeros = await obtenerNumerosAdminsPremier();
      if (numeros.length === 0) numeros = ['whatsapp:+570000000000'];

      const { default: twilio } = await import('twilio');
      const twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID ?? '',
        process.env.TWILIO_AUTH_TOKEN ?? '',
      );

      const mensajePing = `🔔 *SHOESHOP: Recordatorio de Reporte*
      
Por favor, responde a este mensaje con un *OK* o un *Hola* para activar la ventana de WhatsApp. Si no respondes, el reporte de las 8:00 PM no podrá ser entregado.`;

      for (const numero of numeros) {
        try {
          await twilioClient.messages.create({
            from: 'whatsapp:+14155238886',
            to: numero,
            body: mensajePing,
          });
          console.log('Ping enviado a', numero);
        } catch (err: any) {
          console.error('Error enviando Ping:', err.message);
        }
      }
    } catch (error: any) {
      console.error('Error en reportePing:', error.message);
    }
  },
);
