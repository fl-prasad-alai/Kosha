import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src'), '@shared': path.resolve(__dirname, './shared') } },
  server: { proxy: { '/api': 'http://localhost:8080' }, watch: { ignored: ['**/public/samples/**', '**/.cache/**', '**/.data/**', '**/cache/**', '**/server/**'] } },
  build: { outDir: 'dist/web' },
})
