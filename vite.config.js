import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/admin-api": {
        target: "https://localhost:443",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/admin-api/, "/api"),
      },
    },
  },
})
