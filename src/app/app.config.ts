/** @format */

import {
  ApplicationConfig,
  provideZoneChangeDetection,
  isDevMode,
  LOCALE_ID,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { HttpClientModule, provideHttpClient } from '@angular/common/http';
import { DialogService } from 'primeng/dynamicdialog';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { provideFirestore } from '@angular/fire/firestore';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { getMessaging, provideMessaging } from '@angular/fire/messaging';
import { getStorage } from 'firebase/storage';
import { provideStorage } from '@angular/fire/storage';
import { provideServiceWorker } from '@angular/service-worker';
import { MyPreset } from '../assets/mytheme';
import { getFunctions } from 'firebase/functions';
import { provideFunctions } from '@angular/fire/functions';
import localeEsCO from '@angular/common/locales/es-CO';
import { registerLocaleData } from '@angular/common';

const firebaseConfig = {
  projectId: 'your-project-id',
  appId: '1:000000000000:web:0000000000000000',
  databaseURL: 'https://your-project-default-rtdb.firebaseio.com',
  storageBucket: 'your-project.firebasestorage.app',
  apiKey: 'YOUR_FIREBASE_API_KEY',
  authDomain: 'your-project.firebaseapp.com',
  messagingSenderId: '000000000000',
  measurementId: 'G-XXXXXXXXXX',
};

// const firebaseConfig = {
//   apiKey: 'YOUR_FIREBASE_API_KEY',
//   authDomain: 'your-project.firebaseapp.com',
//   projectId: 'your-project-id',
//   storageBucket: 'your-project.firebasestorage.app',
//   messagingSenderId: '000000000000',
//   appId: '1:000000000000:web:0000000000000000',
//   measurementId: 'G-XXXXXXXXXX',
// };

// const firebaseConfig = {
//   apiKey: 'YOUR_FIREBASE_API_KEY',
//   authDomain: 'your-project.firebaseapp.com',
//   projectId: 'your-project-id',
//   storageBucket: 'your-project.firebasestorage.app',
//   messagingSenderId: '000000000000',
//   appId: '1:000000000000:web:0000000000000000',
//   measurementId: 'G-XXXXXXXXXX',
// };

registerLocaleData(localeEsCO);
export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'es-CO' },
    provideFunctions(() => getFunctions(undefined, 'us-central1')),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideAnimations(),
    provideHttpClient(),
    HttpClientModule,
    DialogService,
    providePrimeNG({
      theme: {
        preset: MyPreset,
      },
    }),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => getAuth()),
    // Caché local persistente (IndexedDB, compartida entre pestañas). Los datos en tiempo real
    // siguen llegando igual; al recargar la app se muestran al instante desde el disco y el
    // servidor solo envía lo que cambió, en lugar de volver a bajar todo.
    provideFirestore(() => {
      const app = getApp();
      try {
        return initializeFirestore(app, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        });
      } catch {
        // Ya estaba inicializado (recarga en caliente) o el navegador no soporta la caché persistente
        return getFirestore(app);
      }
    }),
    provideStorage(() => getStorage()),
    provideMessaging(() => getMessaging()),

    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Inmediato: con listeners de Firestore la app casi nunca queda "estable" y la
      // detección de versiones nuevas se retrasaba.
      registrationStrategy: 'registerImmediately',
    }),
  ],
};
