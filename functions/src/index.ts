import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const sendNotification = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const { tokens, title, body, data } = req.body;

  if (!tokens?.length) {
    res.status(400).json({ error: 'tokens requeridos' });
    return;
  }

  try {
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: { title, body },
      data: {
        ...(data || {}),
        title,
        body,
      },
      webpush: {
        notification: {
          title,
          body,
          icon: 'https://your-app.example.com/logo.svg',
          badge: 'https://your-app.example.com/logo.svg',
          requireInteraction: false,
          vibrate: [200, 100, 200],
        },
        headers: {
          Urgency: 'high',
        },
        fcmOptions: {
          link: 'https://your-app.example.com',
        },
      },
      android: {
        priority: 'high',
        notification: {
          title,
          body,
          sound: 'default',
          channelId: 'default',
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(
            `Token[${idx}] falló:`,
            resp.error?.code,
            resp.error?.message,
          );
        }
      });
    }

    res.status(200).json({
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

export { reporteDiario, enviarReporteManual } from './reporteDiario';
export { actualizarResumenVentas } from './resumenVentas';
export { asignarRolAutenticado } from './asignarRolAutenticado';
export { sincronizarCatalogoPublico } from './catalogoPublico';

export { iaChat } from './ia/gateway';
export { revisarVentaNueva } from './ia/anomalias';
export { resumenMananaIA, resumenMananaManual } from './ia/resumenManana';
export { avisoCuadrePendiente, consultarCuadresPendientes } from './ia/cuadrePendiente';
export { consultarCalendario, avisoCalendarioComercial } from './ia/calendario';
export { sugerirPrecios } from './ia/precios';
export { analizarDescuadres, revisionNocturnaInventario } from './ia/descuadres';
export { normalizarZapatoIdVenta } from './normalizarVenta';
export { archivarHistorico } from './archivo';
export { limpiezaAvisos } from './limpieza';
export { revisionPatrones } from './ia/patrones';
export { revisionCampanas, crearCampanaManual } from './ia/campanas';
// WhatsApp deshabilitado de momento (requiere secretos WHATSAPP_* en Secret Manager).
// export { whatsappCliente } from './ia/whatsappCliente';
