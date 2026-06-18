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
    }
  }
})
