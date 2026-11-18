import type { PluginOption } from 'vite'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// reka-ui is resolved to its *source* so every SFC is compiled against
// the pre-release Vue 3.6 installed in this package, not the 3.5 copy the
// rest of the monorepo uses.
export const rekaSrc = fileURLToPath(new URL('../core/src', import.meta.url))

// The `vue` CJS entry does not re-export the Vapor runtime, so every Vue
// runtime package is pinned to its esm-bundler build and deduped to the
// single 3.6 copy (reka source physically sits next to Vue 3.5).
export const vueAlias = [
  { find: /^vue$/, replacement: 'vue/dist/vue.runtime.esm-bundler.js' },
  { find: /^@vue\/runtime-vapor$/, replacement: '@vue/runtime-vapor/dist/runtime-vapor.esm-bundler.js' },
  { find: /^@vue\/runtime-dom$/, replacement: '@vue/runtime-dom/dist/runtime-dom.esm-bundler.js' },
  { find: /^@vue\/runtime-core$/, replacement: '@vue/runtime-core/dist/runtime-core.esm-bundler.js' },
  { find: /^@vue\/reactivity$/, replacement: '@vue/reactivity/dist/reactivity.esm-bundler.js' },
  { find: /^@vue\/shared$/, replacement: '@vue/shared/dist/shared.esm-bundler.js' },
]

const rekaAlias = [
  { find: /^reka-ui$/, replacement: `${rekaSrc}/index.ts` },
  { find: /^@\//, replacement: `${rekaSrc}/` },
]

// Externalized deps would load the monorepo's Vue 3.5 copy, so everything that
// imports `vue` runs through Vite and gets the aliases above.
const inlineDeps = [/^vue$/, /vue\/dist\//, /@vue\//, /@vueuse\//, /@tanstack\/vue-virtual/, /@floating-ui\/vue/]

export function createConfig(options: { plugins: PluginOption[], include: string[], optionsApi?: boolean }) {
  return defineConfig({
    plugins: options.plugins,
    resolve: {
      alias: [...vueAlias, ...rekaAlias],
      dedupe: ['vue', '@vue/runtime-core', '@vue/runtime-dom', '@vue/runtime-vapor', '@vue/reactivity', '@vue/shared'],
    },
    define: {
      // Pure Vapor runs with the Options API compiled out, as a Vapor-only app would ship.
      __VUE_OPTIONS_API__: String(options.optionsApi ?? true),
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
    },
    test: {
      environment: 'jsdom',
      globals: true,
      include: options.include,
      setupFiles: ['./test/setup.ts'],
      server: {
        deps: {
          inline: inlineDeps,
        },
      },
    },
  })
}
