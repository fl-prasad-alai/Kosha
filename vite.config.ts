import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(__dirname, './src'), '@shared': path.resolve(__dirname, './shared') } },
    // The Gemini API key for the browser: VITE_GEMINI_API_KEY, or GEMINI_API_KEY from an older .env.
    define: { 'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY ?? env.GEMINI_API_KEY ?? '') },
    server: { watch: { ignored: ['**/public/samples/**', '**/.cache/**', '**/.data/**', '**/cache/**'] } },
    build: { outDir: 'dist/web' },
  }
})
