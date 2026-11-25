import {
  Injectable,
  Inject,
  PLATFORM_ID,
  inject,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import { Auth, signInWithEmailAndPassword, signOut } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { User } from '../../pages/interfaces';
import { isPlatformBrowser } from '@angular/common';
import { onAuthStateChanged } from 'firebase/auth';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private currentUser: User | null = null;
  private isBrowser: boolean;
  private userSubject = new BehaviorSubject<User | null>(null);
  user$ = this.userSubject.asObservable();
  private loginConfirmadoSubject = new BehaviorSubject<boolean>(false);
  loginConfirmado$ = this.loginConfirmadoSubject.asObservable();
  private injector = inject(Injector);

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    @Inject(PLATFORM_ID) platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      try {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          if (parsed && parsed.id) {
            this.currentUser = parsed;
          }
        }
      } catch (err) {
        console.error('Error leyendo usuario desde localStorage:', err);
      }

      runInInjectionContext(this.injector, () => {
        onAuthStateChanged(this.auth, (firebaseUser) => {
          if (firebaseUser && this.currentUser) {
            this.userSubject.next(this.currentUser);
          } else if (!firebaseUser) {
            this.currentUser = null;
            this.userSubject.next(null);
            localStorage.removeItem('currentUser');
          }
        });
      });
    }
  }

  async login(
    email: string,
    password: string,
    expectedRole: 'vendedor' | 'bodega' | 'admin' | '',
  ): Promise<boolean> {
    try {
      await signInWithEmailAndPassword(this.auth, email, password);

      const firebaseUser = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject('Timeout al esperar auth state'),
          5000,
        );

        runInInjectionContext(this.injector, () => {
          const unsubscribe = onAuthStateChanged(this.auth, (user) => {
            if (user) {
              clearTimeout(timeout);
              unsubscribe();
              resolve(user);
            }
          });
        });
      });

      const userDocRef = doc(this.firestore, 'usuarios', firebaseUser.uid);
      const userSnap = await runInInjectionContext(this.injector, () =>
        getDoc(userDocRef),
      );

      if (!userSnap.exists()) {
        console.error('Usuario no registrado en la colección usuarios.');
        return false;
      }

      const userData = userSnap.data() as User;

      if (
        userData.role.toLowerCase() !== expectedRole.toLowerCase() &&
        userData.role.toLowerCase() !== 'admin'
      ) {
        console.warn('Rol incorrecto.');
        return false;
      }

      if (!userData.active?.value) {
        console.warn('Usuario inactivo.');
        return false;
      }

      this.currentUser = userData;
      this.userSubject.next(userData);

      if (this.isBrowser) {
        localStorage.setItem('currentUser', JSON.stringify(userData));
      }

      this.loginConfirmadoSubject.next(true);

      return true;
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
    this.currentUser = null;
    this.userSubject.next(null);
    this.loginConfirmadoSubject.next(false);

    if (this.isBrowser) {
      localStorage.removeItem('currentUser');
    }
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Vuelve a leer el usuario desde Firestore. El usuario se guarda en localStorage al iniciar
   * sesión, así que permisos que el admin cambia después (p. ej. `recolectorCaja`) no se verían
   * hasta el siguiente login.
   */
  async refrescarUsuario(): Promise<User | null> {
    const actual = this.currentUser;
    if (!actual?.id) return actual;
    try {
      const snap = await runInInjectionContext(this.injector, () =>
        getDoc(doc(this.firestore, 'usuarios', actual.id!)),
      );
      if (!snap.exists()) return this.currentUser;
      const data = { ...(snap.data() as User), id: actual.id };
      this.currentUser = data;
      this.userSubject.next(data);
      if (this.isBrowser) localStorage.setItem('currentUser', JSON.stringify(data));
    } catch (err) {
      console.warn('No se pudo refrescar el usuario:', err);
    }
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }
}
