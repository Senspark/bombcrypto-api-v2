import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiPort = env.VITE_API_PORT || '8106';
  const payRockPort = env.VITE_PAY_ROCK_PORT || '8107';

  return {
    plugins: [react()],
    build: {
      outDir: 'build',
      sourcemap: false,
    },
    server: {
      open: false,
      proxy: {
        '/api': {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/pay-rock-api': {
          target: `http://localhost:${payRockPort}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/pay-rock-api/, ''),
        },
      },
    },
  };
});
