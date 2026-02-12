import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/features': path.resolve(__dirname, './src/features'),
      '@/features/localization': path.resolve(
        __dirname,
        './src/features/localization'
      ),
      '@/pages': path.resolve(__dirname, './src/pages'),
      '@/shared': path.resolve(__dirname, './src/shared'),
      '@/assets': path.resolve(__dirname, './src/assets'),
    },
  },
  build: {
    sourcemap: mode === 'development',
    minify: mode === 'production',
  },
}));
