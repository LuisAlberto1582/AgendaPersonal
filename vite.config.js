import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ command, isPreview }) => ({
  plugins: [react(), tailwindcss()],
  // GitHub Pages sirve el sitio en /AgendaPersonal/; en `npm run dev` se mantiene la raíz
  base: command === 'build' || isPreview ? '/AgendaPersonal/' : '/',
}));
