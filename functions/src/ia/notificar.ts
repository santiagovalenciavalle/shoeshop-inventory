import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

export async function tokensAdmins(): Promise<{ uid: string; token: string }[]> {
  const snap = await db
    .collection('usuarios')
    .where('role', '==', 'admin')
    .where('active.value', '==', true)
    .get();
  const lista: { uid: string; token: string }[] = [];
  snap.forEach((d) => {
    const tokens = d.data()['fcmTokens'];
    if (Array.isArray(tokens)) tokens.forEach((t) => typeof t === 'string' && lista.push({ uid: d.id, token: t }));
  });
  return lista;
}

/** Envía una notificación push a todos los administradores y limpia los tokens vencidos. */
export async function notificarAdmins(
  titulo: string,
  cuerpo: string,
  data: Record<string, string> = {},
): Promise<number> {
  const registros = await tokensAdmins();
  if (!registros.length) return 0;

  const tokens = registros.map((r) => r.token);
  const respuesta = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title: titulo, body: cuerpo },
    data: { ...data, title: titulo, body: cuerpo },
    webpush: {
      notification: {
        title: titulo,
        body: cuerpo,
        icon: 'https://your-app.example.com/logo.svg',
        badge: 'https://your-app.example.com/logo.svg',
      },
      headers: { Urgency: 'high' },
      fcmOptions: { link: 'https://your-app.example.com' },
    },
    android: { priority: 'high', notification: { sound: 'default', channelId: 'default' } },
  });

  // Quitar tokens que ya no sirven
  const invalidos = new Set<string>();
  respuesta.responses.forEach((r, i) => {
    const codigo = r.error?.code ?? '';
    if (
      !r.success &&
      (codigo.includes('registration-token-not-registered') || codigo.includes('invalid-registration-token'))
    ) {
      invalidos.add(tokens[i]);
    }
  });
  if (invalidos.size) {
    const porUsuario = new Map<string, string[]>();
    registros.forEach((r) => {
      if (invalidos.has(r.token)) porUsuario.set(r.uid, [...(porUsuario.get(r.uid) ?? []), r.token]);
    });
    await Promise.all(
      [...porUsuario.entries()].map(([uid, lista]) =>
        db.doc(`usuarios/${uid}`).update({ fcmTokens: admin.firestore.FieldValue.arrayRemove(...lista) }).catch(() => undefined),
      ),
    );
  }
  return respuesta.successCount;
}
