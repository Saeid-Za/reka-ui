import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

const require = createRequire(import.meta.url)
const vueBundler = require.resolve('vue/dist/vue.runtime.esm-bundler.js')

// H5: probe-only config — full suite with Options API off is QS19 (esbuild alias breaks most SFC tests).
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      { find: /^vue$/, replacement: vueBundler },
      { find: '@', replacement: resolve(__dirname, 'src') },
    ],
  },
  define: {
    __VUE_OPTIONS_API__: 'false',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/__probe__/**/*.test.ts'],
  },
})
