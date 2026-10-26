import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' : GitHub Pages 하위 경로(https://계정.github.io/저장소/)에서도 그대로 동작
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
