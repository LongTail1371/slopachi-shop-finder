import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  base: process.env['VITE_BASE'] ?? '/',
  publicDir: resolve(__dirname, '../data'),
  server: { fs: { allow: [resolve(__dirname, '..')] } },
});
