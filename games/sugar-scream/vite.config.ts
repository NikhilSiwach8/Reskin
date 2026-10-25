import { defineConfig } from 'vite';
import { mockRgs } from './src/rgs/mockRgs.ts';

export default defineConfig({
  base: './',
  plugins: [mockRgs()],
  build: { target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 1500 },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 120000 },
});
