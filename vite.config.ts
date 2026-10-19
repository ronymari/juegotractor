import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()], server: { proxy: { '/api': 'http://127.0.0.1:3001' } }, build: { sourcemap: false, rollupOptions:{output:{manualChunks:process.env.VITE_BACKEND==='local'?{motion:['motion/react']}:{supabase:['@supabase/supabase-js'],motion:['motion/react']}}} } })
