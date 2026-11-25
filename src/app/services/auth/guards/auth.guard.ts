import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const expectedRole = route.data['role'];
  const user = authService.getCurrentUser();

  if (!user) {
    router.navigate(['/login_' + expectedRole]);
    return false;
  }

  if (user.role === expectedRole || user.role === 'admin') {
    return true;
  }

  router.navigate(['/login_' + expectedRole]);
  return false;
};
