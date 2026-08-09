import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Vite 配置
// - 端口 5173
// - /api 代理转发到后端 3001
// - PWA 友好（manifest 通过 index.html link 引入）
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000
  }
})
