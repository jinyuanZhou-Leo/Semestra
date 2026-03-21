// input:  [Vite + Vitest APIs, React/Tailwind plugins, React Compiler preset wiring, environment-gated Vite DevTools config, and dev proxy rules]
// output: [default exported `defineConfig(...)` result for Vite/Vitest]
// pos:    [Primary toolchain configuration for dev server, tests, production bundling, and opt-in standalone Vite DevTools on Vite 8]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

/// <reference types="vitest" />
import path from "path"
import babel, { defineRolldownBabelPreset } from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from 'vitest/config'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'

const compilerPreset = defineRolldownBabelPreset({
  ...reactCompilerPreset({ target: '19' }),
  rolldown: {
    filter: {
      id: {
        include: ['src/**/*.tsx', 'src/**/*.jsx'],
        exclude: [
          'src/**/*.test.*',
          'src/**/*.spec.*',
          'src/test/**',
          'src/utils/**',
          'src/types/**',
          'src/services/**',
          'src/calendar-core/**',
        ],
      },
      moduleType: {
        include: ['tsx', 'jsx'],
      },
    },
    optimizeDeps: {
      include: ['react/compiler-runtime'],
    },
  },
})

const devToolsEnabled = process.env.SEMESTRA_VITE_DEVTOOLS === '1'

// https://vite.dev/config/
export default defineConfig({
  devtools: {
    enabled: devToolsEnabled,
  },
  plugins: [
    react(),
    babel({
      presets: [compilerPreset],
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
})
