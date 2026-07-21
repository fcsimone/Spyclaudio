import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base '/Spyclaudio/' porque o app é publicado em https://fcsimone.github.io/Spyclaudio/
export default defineConfig({
  base: '/Spyclaudio/',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    port: 4173,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
