/// <reference types="vitest" />
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const normalizeModuleId = (id: string) => id.replace(/\\/g, '/')

const manualChunkGroups = [
  { name: 'react', packages: ['react', 'react-dom', 'react-router-dom'] },
  { name: 'motion', packages: ['framer-motion'] },
  { name: 'grid', packages: ['react-grid-layout'] },
  { name: 'http', packages: ['axios'] },
  { name: 'ogl', packages: ['ogl'] },
  { name: 'icons', packages: ['lucide-react'] },
  { name: 'utils', packages: ['clsx', 'tailwind-merge', 'class-variance-authority'] },
]

const uiPackages = [
  '@radix-ui/react-avatar',
  '@radix-ui/react-checkbox',
  '@radix-ui/react-dialog',
  '@radix-ui/react-dropdown-menu',
  '@radix-ui/react-label',
  '@radix-ui/react-progress',
  '@radix-ui/react-radio-group',
  '@radix-ui/react-select',
  '@radix-ui/react-separator',
  '@radix-ui/react-slot',
  '@radix-ui/react-tabs',
  'sonner',
]

const resolveManualChunk = (id: string) => {
  const normalizedId = normalizeModuleId(id)

  for (const group of manualChunkGroups) {
    if (group.packages.some((pkg) => normalizedId.includes(`/node_modules/${pkg}/`))) {
      return group.name
    }
  }

  const matchedPackage = uiPackages.find((pkg) => normalizedId.includes(`/node_modules/${pkg}/`))
  if (matchedPackage) {
    const chunkSuffix = matchedPackage.replace('@radix-ui/react-', '')
    return `ui-${chunkSuffix}`
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', { target: '19' }]],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/docs': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/openapi.json': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (
          warning.code === 'MODULE_LEVEL_DIRECTIVE' &&
          warning.message?.includes('"use no memo"')
        ) {
          return
        }
        warn(warning)
      },
      output: {
        manualChunks(id) {
          return resolveManualChunk(id)
        },
      },
    },
  },
})
