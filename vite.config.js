import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // When running plain `vite` (not `netlify dev`), forward function calls to netlify dev on 8888
      '/.netlify/functions': 'http://localhost:8888',
    },
  },
})
