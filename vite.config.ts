import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const env = loadEnv(mode, '.', '')
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(env.VITE_SUPABASE_URL ?? '')) {
      throw new Error('VITE_SUPABASE_URL is missing or malformed — copy .env.example to .env before building')
    }
    if ((env.VITE_SUPABASE_ANON_KEY ?? '').trim().length < 20) {
      throw new Error('VITE_SUPABASE_ANON_KEY is missing — copy .env.example to .env before building')
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    clearScreen: false,
    server: {
      port: 5173,
      strictPort: true,
    },
    build: {
      target: 'chrome120',
    },
  }
})
