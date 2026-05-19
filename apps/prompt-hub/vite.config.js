import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
    watch: {
      // Backend grava esses arquivos durante o uso; ignorar evita full reload da página
      ignored: ['**/.library.json', '**/.library-embeddings.json', '**/.hf_session.json'],
    },
  },
})
