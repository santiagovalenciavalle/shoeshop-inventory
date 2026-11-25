import { beforeUserCreated } from 'firebase-functions/v2/identity';

export const asignarRolAutenticado = beforeUserCreated((event) => {
  return {
    customClaims: {
      role: 'authenticated',
    },
  };
});
