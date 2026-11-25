import { Injectable, inject, Injector } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
} from '@angular/fire/firestore';
import { Auth, createUserWithEmailAndPassword } from '@angular/fire/auth';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { User } from '../../../pages/interfaces';

import { enContexto } from '../../../shared/utils/firestore-contexto';
@Injectable({
  providedIn: 'root',
})
export class UsuarioService {
  private readonly _inj = inject(Injector);

  private readonly COLLECTION_NAME = 'usuarios';

  private usuariosSubject = new BehaviorSubject<User[]>([]);
  usuarios$ = this.usuariosSubject.asObservable();

  private initialized = false;

  constructor(
    private firestore: Firestore,
    private auth: Auth,
  ) {}

  initUsuarios(): void {
    const storedUser = localStorage.getItem('currentUser');

    if (!storedUser) {
      console.warn(
        'No se puede inicializar usuarios: no existe currentUser en localStorage',
      );
      return;
    }

    const currentUser = JSON.parse(storedUser);

    if (!currentUser || !currentUser.id) {
      console.warn('Usuario inválido en localStorage');
      return;
    }

    if (this.initialized) return;
    this.initialized = true;

    const usuariosCollection = collection(this.firestore, this.COLLECTION_NAME);
    enContexto(this._inj, () => collectionData(usuariosCollection, { idField: 'id' })).subscribe({
      next: (usuariosFirestore: User[]) => {
        const usuariosFiltrados = usuariosFirestore.filter(
          (u) => u.email !== 'admin@example.com',
        );
        this.usuariosSubject.next([...usuariosFiltrados]);
      },
      error: (err) => console.error('Error al cargar usuarios:', err),
    });
  }

  getUsuarios(): User[] {
    return this.usuariosSubject.getValue();
  }

  getBodeguerosActivosConNumero(): Observable<string[]> {
    return this.usuarios$.pipe(
      map((usuarios) => {
        const bodegueros = usuarios.filter(
          (u) =>
            u.role === 'bodega' && u.active?.value === true && u.numeroBodega,
        );
        return bodegueros.map((b) => b.numeroBodega);
      }),
    );
  }

  getBodeguerosActivos(): Observable<string[]> {
    return this.usuarios$.pipe(
      map((usuarios) => {
        const bodegueros = usuarios.filter(
          (u) => u.role === 'bodega' && u.active?.value === true,
        );
        return bodegueros.map((b) => b.name);
      }),
    );
  }

  async agregarUsuario(usuario: Omit<User, 'id'>): Promise<void> {
    try {
      let uid: string;
      let userRef;

      if (usuario.role !== 'patinador') {
        const cred = await createUserWithEmailAndPassword(
          this.auth,
          usuario.email!,
          usuario.password!,
        );
        uid = cred.user.uid;
        userRef = doc(this.firestore, this.COLLECTION_NAME, uid);
      } else {
        userRef = doc(collection(this.firestore, this.COLLECTION_NAME));
        uid = userRef.id;
      }

      const { password, ...userData } = usuario;

      const userToSave: Omit<User, 'password'> = {
        id: uid,
        ...userData,
      };

      await setDoc(userRef, userToSave);
    } catch (err) {
      console.error('Error al agregar usuario:', err);
      throw err;
    }
  }

  async eliminarUsuario(uid: string): Promise<void> {
    try {
      const usuarioRef = doc(this.firestore, this.COLLECTION_NAME, uid);
      await deleteDoc(usuarioRef);
    } catch (err) {
      console.error('Error al eliminar usuario:', err);
    }
  }

  async actualizarUsuario(
    uid: string,
    datosActualizados: Partial<User>,
  ): Promise<void> {
    if ('password' in datosActualizados) {
      delete datosActualizados.password;
    }

    try {
      const usuarioRef = doc(this.firestore, this.COLLECTION_NAME, uid);
      await updateDoc(usuarioRef, datosActualizados);
    } catch (err) {
      console.error('Error al actualizar usuario:', err);
    }
  }
}
