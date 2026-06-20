import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  preview: {
    host: '0.0.0.0',
    port: 8080,
    allowedHosts: ['cloudstore.qallariy.lat', '.qallariy.lat'],
  },
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
        target: `http://${process.env.LLM_HOST || '192.168.0.121'}:8000`,
        changeOrigin: true,
        proxyTimeout: 180000,
        timeout: 180000,
        configure: (proxy) => {
          const startMap = new Map()
          proxy.on('proxyReq', (proxyReq, req) => {
            startMap.set(req, Date.now())
            proxyReq.path = req.url.replace(/^\/model/, '')
          })
          proxy.on('proxyRes', (proxyRes, req) => {
            const ms = Date.now() - (startMap.get(req) || Date.now())
            const body = []
            proxyRes.on('data', chunk => body.push(chunk))
            proxyRes.on('end', () => {
              const bodyStr = Buffer.concat(body).toString('utf8').slice(0, 500)
              console.log(`[LLM] ${req.method} ${req.url} → ${proxyRes.statusCode} (${ms}ms) ${bodyStr}`)
            })
            startMap.delete(req)
          })
          proxy.on('error', (err, req) => {
            console.error(`[LLM ERROR] ${req?.url} ${err.message}`)
          })
        },
      },
    }
  }
})
