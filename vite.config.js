import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8080,
    host: '0.0.0.0',
    allowedHosts: ['cloudstore.qallariy.lat', '.qallariy.lat'],
    proxy: {
      '/rest': 'http://localhost:3333',
      '/auth': 'http://localhost:3333',
      '/storage': 'http://localhost:3333',
      '/functions': 'http://localhost:3333',
      '/model': {
        target: 'http://192.168.0.121:8000',
        changeOrigin: true,
        proxyTimeout: 180000,
        timeout: 180000,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.path = req.url.replace(/^\/model/, '')
          })
        },
      },
    }
  }
})
