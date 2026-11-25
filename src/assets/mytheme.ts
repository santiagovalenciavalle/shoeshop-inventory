import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

export const MyPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#e6f7ff',
      100: '#c0e8ff',
      200: '#99d9ff',
      300: '#73caff',
      400: '#4dbbff',
      500: '#26aaff',
      600: '#2099e6',
      700: '#1a88cc',
      800: '#1477b3',
      900: '#0e66a1',
      950: '#085a8f',
    },
  },
});
