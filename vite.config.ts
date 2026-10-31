import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // iOS kabuğu dosyaları yerel olarak açtığı için yollar göreli olmalı.
  base: './',
  plugins: [react()],
})
