import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiPort = env.VITE_API_PORT || '8106';

  return {
    plugins: [react()],
    build: {
      outDir: 'build',
      sourcemap: false,
    },
    server: {
      open: false,
      proxy: {
        '/api/th/leaderboard': {
          target: 'http://localhost:8108',
          changeOrigin: true,
          // No rewrite needed because the backend now has /api prefix
        },
        '/api': {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/analytics-api': {
          target: 'http://localhost:8108',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/analytics-api/, '/api'),
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
      globals: true,
    },
  };
});
