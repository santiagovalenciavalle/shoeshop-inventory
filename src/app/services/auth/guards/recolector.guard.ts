import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth.service';

/**
 * Deja entrar solo a admin o a un vendedor que el admin habilitó como recolector de caja.
 * Vuelve a leer el usuario de Firestore para no depender del permiso guardado al iniciar sesión.
 */
export const recolectorGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.getCurrentUser()) {
    router.navigate(['/login_vendedor']);
    return false;
  }

  const user = (await authService.refrescarUsuario()) ?? authService.getCurrentUser();
  if (user && (user.role === 'admin' || (user.role === 'vendedor' && user.recolectorCaja === true))) {
    return true;
  }

  router.navigate(['/vendedor']);
  return false;
};
