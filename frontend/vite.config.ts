import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // appType 'spa' (the default) enables history API fallback on the dev server
  // so reloading any client-side route returns index.html instead of a 404.
  appType: 'spa',
})
