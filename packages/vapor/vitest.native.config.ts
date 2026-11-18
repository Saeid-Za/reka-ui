import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'
import { rekaVaporSwap } from './rekaVapor.ts'

// reka-ui is resolved to its *source* so every SFC is compiled against
// the pre-release Vue 3.6 installed in this package, not the 3.5 copy the
// rest of the monorepo uses.
const rekaSrc = fileURLToPath(new URL('../core/src', import.meta.url))

// The `vue` CJS entry does not re-export the Vapor runtime, so every Vue
// runtime package is pinned to its esm-bundler build and deduped to the
// single 3.6 copy (reka source physically sits next to Vue 3.5).
const vueAlias = [
  { find: /^vue$/, replacement: 'vue/dist/vue.runtime.esm-bundler.js' },
  { find: /^@vue\/runtime-vapor$/, replacement: '@vue/runtime-vapor/dist/runtime-vapor.esm-bundler.js' },
  { find: /^@vue\/runtime-dom$/, replacement: '@vue/runtime-dom/dist/runtime-dom.esm-bundler.js' },
  { find: /^@vue\/runtime-core$/, replacement: '@vue/runtime-core/dist/runtime-core.esm-bundler.js' },
  { find: /^@vue\/reactivity$/, replacement: '@vue/reactivity/dist/reactivity.esm-bundler.js' },
  { find: /^@vue\/shared$/, replacement: '@vue/shared/dist/shared.esm-bundler.js' },
]

export default defineConfig({
  // Vapor is opted into per SFC with `<script setup vapor>`.
  // Every SFC — the tests' and reka-ui's own — is compiled in Vapor mode.
  plugins: [rekaVaporSwap(), vue({ features: { vapor: true } })],
  resolve: {
    alias: [
      ...vueAlias,
      { find: /^reka-ui$/, replacement: `${rekaSrc}/index.ts` },
      { find: /^@\//, replacement: `${rekaSrc}/` },
    ],
    dedupe: ['vue', '@vue/runtime-core', '@vue/runtime-dom', '@vue/runtime-vapor', '@vue/reactivity', '@vue/shared'],
  },
  define: {
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test-native/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    server: {
      deps: {
        inline: [/^vue$/, /vue\/dist\//, /@vue\//, /@vueuse\//],
      },
    },
  },
})
