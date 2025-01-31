import { defineConfig } from 'vite'; // ^4.4.0
import react from '@vitejs/plugin-react'; // ^4.0.0
import tsconfigPaths from 'vite-tsconfig-paths'; // ^4.2.0

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths()
  ],

  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@pages': '/src/pages',
      '@hooks': '/src/hooks',
      '@store': '/src/store',
      '@utils': '/src/utils',
      '@types': '/src/types',
      '@assets': '/src/assets',
      '@config': '/src/config',
      '@lib': '/src/lib',
      '@layouts': '/src/layouts'
    }
  },

  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks for better caching
          vendor: ['react', 'react-dom', '@blitzy/page-builder', '@blitzy/ui-kit'],
          redux: ['@reduxjs/toolkit', 'react-redux']
        }
      }
    }
  },

  server: {
    port: 3000,
    strictPort: true,
    host: true,
    cors: true,
    hmr: {
      overlay: true
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL,
        changeOrigin: true,
        secure: false
      }
    }
  },

  preview: {
    port: 3000,
    strictPort: true,
    host: true
  }
});