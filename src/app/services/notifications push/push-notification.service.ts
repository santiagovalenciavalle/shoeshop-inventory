import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { Messaging, getToken, onMessage } from '@angular/fire/messaging';
import {
  Firestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  query,
  where,
  getDoc,
} from '@angular/fire/firestore';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root',
})
export class PushNotificationService {
  private readonly VAPID_KEY =
    'YOUR_VAPID_PUBLIC_KEY';
  private readonly COLLECTION_USUARIOS = 'usuarios';

  private foregroundListenerActivo = false;
  private unsubscribeOnMessage: (() => void) | null = null;

  constructor(
    private messaging: Messaging,
    private firestore: Firestore,
    private authService: AuthService,
    private http: HttpClient,
    private injector: Injector,
  ) {}

  async inicializarNotificaciones(): Promise<void> {
    try {
      if (!('Notification' in window)) {
        console.warn('Este navegador no soporta notificaciones');
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        console.warn('Permiso denegado');
        return;
      }

      const token = await getToken(this.messaging, {
        vapidKey: this.VAPID_KEY,
      });

      if (token) {
        await this.guardarTokenEnFirestore(token);
        this.escucharNotificacionesEnPrimerPlano();
      } else {
        console.warn('No se obtuvo token FCM. Verifica el Service Worker.');
      }
    } catch (error) {
      console.error('Error inicializando notificaciones:', error);
    }
  }

  private async guardarTokenEnFirestore(token: string): Promise<void> {
    const currentUser = this.authService.getCurrentUser();

    if (!currentUser?.id) {
      console.warn('No hay usuario logueado para guardar el token');
      return;
    }

    try {
      const userRef = doc(
        this.firestore,
        this.COLLECTION_USUARIOS,
        currentUser.id,
      );

      await updateDoc(userRef, {
        fcmTokens: arrayUnion(token),
      });
    } catch (error) {
      console.error('Error guardando token en Firestore:', error);
    }
  }

  escucharNotificacionesEnPrimerPlano(): void {
    if (this.foregroundListenerActivo) {
      return;
    }

    runInInjectionContext(this.injector, () => {
      this.unsubscribeOnMessage = onMessage(this.messaging, async (payload) => {
        const title =
          payload.notification?.title ||
          payload.data?.['title'] ||
          'Nueva notificación';
        const body = payload.notification?.body || payload.data?.['body'] || '';

        try {
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification(title, {
            body,
            icon: '/logo.svg',
            badge: '/logo.svg',
            data: payload.data || {},
            vibrate: [200, 100, 200],
          } as NotificationOptions);
        } catch (error) {
          console.error('Error mostrando notificación foreground:', error);
        }
      });

      this.foregroundListenerActivo = true;
    });
  }

  limpiarListener(): void {
    this.unsubscribeOnMessage?.();
    this.unsubscribeOnMessage = null;
    this.foregroundListenerActivo = false;
  }

  async obtenerTokensBodegueros(): Promise<string[]> {
    const usuariosRef = collection(this.firestore, this.COLLECTION_USUARIOS);
    const q = query(
      usuariosRef,
      where('role', '==', 'bodega'),
      where('active.value', '==', true),
    );

    const snapshot = await getDocs(q);
    const tokens: string[] = [];

    snapshot.forEach((docSnap) => {
      const usuario = docSnap.data();

      if (usuario['fcmTokens'] && Array.isArray(usuario['fcmTokens'])) {
        tokens.push(...usuario['fcmTokens']);
      }
    });

    return tokens;
  }

  async enviarNotificacionABodegueros(payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<void> {
    const tokens = await this.obtenerTokensBodegueros();

    if (tokens.length === 0) {
      console.warn('No hay tokens de bodegueros registrados');
      return;
    }

    try {
      const response = await this.http
        .post(
          'https://us-central1-your-project-id.cloudfunctions.net/sendNotification',
          {
            tokens,
            title: payload.title,
            body: payload.body,
            data: payload.data || {},
          },
        )
        .toPromise();
    } catch (error) {
      console.error('❌ Error enviando notificación:', error);
    }
  }

  async obtenerTokensAdmins(): Promise<string[]> {
    const usuariosRef = collection(this.firestore, this.COLLECTION_USUARIOS);
    const q = query(
      usuariosRef,
      where('role', '==', 'admin'),
      where('active.value', '==', true),
    );

    const snapshot = await getDocs(q);
    const tokens: string[] = [];

    snapshot.forEach((docSnap) => {
      const usuario = docSnap.data();

      if (usuario['fcmTokens'] && Array.isArray(usuario['fcmTokens'])) {
        tokens.push(...usuario['fcmTokens']);
      }
    });

    return tokens;
  }

  async obtenerTokensVendedor(vendedorId: string): Promise<string[]> {
    const userRef = doc(this.firestore, this.COLLECTION_USUARIOS, vendedorId);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) return [];

    const usuario = snapshot.data();
    return usuario['fcmTokens'] && Array.isArray(usuario['fcmTokens'])
      ? usuario['fcmTokens']
      : [];
  }

  async enviarNotificacionAVendedor(
    vendedorId: string,
    payload: { title: string; body: string; data?: Record<string, string> },
  ): Promise<void> {
    const tokens = await this.obtenerTokensVendedor(vendedorId);

    if (tokens.length === 0) {
      console.warn(`No hay tokens para el vendedor ${vendedorId}`);
      return;
    }

    try {
      const response = await this.http
        .post(
          'https://us-central1-your-project-id.cloudfunctions.net/sendNotification',
          {
            tokens,
            title: payload.title,
            body: payload.body,
            data: payload.data || {},
          },
        )
        .toPromise();
    } catch (error) {
      console.error('❌ Error enviando notificación a vendedor:', error);
    }
  }

  async enviarNotificacionAAdmins(payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<void> {
    const tokens = await this.obtenerTokensAdmins();

    if (tokens.length === 0) {
      console.warn('No hay tokens de admins registrados');
      return;
    }

    try {
      const response = await this.http
        .post(
          'https://us-central1-your-project-id.cloudfunctions.net/sendNotification',
          {
            tokens,
            title: payload.title,
            body: payload.body,
            data: payload.data || {},
          },
        )
        .toPromise();
    } catch (error) {
      console.error('❌ Error enviando notificación a admins:', error);
    }
  }

  async obtenerTokensVendedoresPorLocal(local: string): Promise<string[]> {
    const usuariosRef = collection(this.firestore, this.COLLECTION_USUARIOS);
    const q = query(
      usuariosRef,
      where('role', '==', 'vendedor'),
      where('active.value', '==', true),
    );

    const snapshot = await getDocs(q);
    const tokens: string[] = [];

    const localNumero = String(local)
      .replace(/[^0-9]/g, '')
      .trim();

    snapshot.forEach((docSnap) => {
      const usuario = docSnap.data();
      const usuarioLocal = String(usuario['local'] || '').trim();

      if (usuarioLocal === localNumero && Array.isArray(usuario['fcmTokens'])) {
        tokens.push(...usuario['fcmTokens']);
      }
    });

    return tokens;
  }

  async enviarNotificacionAVendedoresPorLocales(
    locales: string[],
    payload: { title: string; body: string; data?: Record<string, string> },
  ): Promise<void> {
    const todosLosTokens: string[] = [];

    for (const local of locales) {
      const tokens = await this.obtenerTokensVendedoresPorLocal(local);
      todosLosTokens.push(...tokens);
    }

    const tokensUnicos = [...new Set(todosLosTokens)];

    if (tokensUnicos.length === 0) {
      console.warn('No hay tokens para los locales:', locales);
      return;
    }

    try {
      const response = await this.http
        .post(
          'https://us-central1-your-project-id.cloudfunctions.net/sendNotification',
          {
            tokens: tokensUnicos,
            title: payload.title,
            body: payload.body,
            data: payload.data || {},
          },
        )
        .toPromise();
    } catch (error) {
      console.error('❌ Error enviando notificación por local:', error);
    }
  }

  async enviarNotificacionAVendedoresPorLocalExacto(
    localPedido: string,
    payload: { title: string; body: string; data?: Record<string, string> },
  ): Promise<void> {
    const tokens = await this.obtenerTokensVendedoresPorLocal(localPedido);

    if (tokens.length === 0) {
      console.warn('No hay tokens para el local:', localPedido);
      return;
    }

    try {
      await this.http
        .post(
          'https://us-central1-your-project-id.cloudfunctions.net/sendNotification',
          {
            tokens,
            title: payload.title,
            body: payload.body,
            data: payload.data || {},
          },
        )
        .toPromise();
    } catch (error) {
      console.error('❌ Error enviando notificación a local exacto:', error);
    }
  }
}
