import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_PROXY_TARGET || env.VITE_API_BASE_URL || 'http://localhost:3000'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/pos': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
