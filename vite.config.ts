import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    hmr: false, 
    headers: { 'Cache-Control': 'no-store' },
    port: 1234,
    strictPort: true,  // fail if taken
  }
})
