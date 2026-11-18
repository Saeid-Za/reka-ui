import type { Plugin } from 'vite'
import process from 'node:process'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { rekaSrc, vueAlias } from '../config.shared.ts'
import { rekaVaporSwap, stripVapor } from '../rekaVapor.ts'

type Mode = 'vdom' | 'interop' | 'vapor'
const mode = (process.env.BENCH_MODE ?? 'vapor') as Mode
const minify = process.env.BENCH_MINIFY !== 'false'
const outDir = process.env.BENCH_OUT ?? `dist/${mode}${minify ? '' : '-unminified'}`

const plugins = {
  // fixtures and reka-ui compiled as VDOM
  vdom: [stripVapor(), vue()],
  // fixtures Vapor (`<script setup vapor>`), reka-ui VDOM through interop
  interop: [vue()],
  // every SFC Vapor, reka-ui's vnode modules swapped
  vapor: [rekaVaporSwap(), vue({ features: { vapor: true } })],
}[mode]

// Per-module rendered size of the output, for the bundle breakdown in BENCHMARKS.md.
function moduleStats(): Plugin {
  return {
    name: 'bench:module-stats',
    generateBundle(_, bundle) {
      const rows: Record<string, number> = {}
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk')
          continue
        for (const [id, info] of Object.entries(file.modules))
          rows[id] = info.renderedLength
      }
      this.emitFile({ type: 'asset', fileName: 'module-stats.json', source: JSON.stringify(rows, null, 1) })
    },
  }
}

export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [...plugins, moduleStats()],
  resolve: {
    alias: [
      ...vueAlias,
      { find: /^reka-ui$/, replacement: `${rekaSrc}/index.ts` },
      { find: /^@\//, replacement: `${rekaSrc}/` },
    ],
    dedupe: ['vue', '@vue/runtime-core', '@vue/runtime-dom', '@vue/runtime-vapor', '@vue/reactivity', '@vue/shared'],
  },
  define: {
    '__BENCH_MODE__': JSON.stringify(mode),
    // `BENCH_OPTIONS_API=true` restores Vue's default, for the PERF_LOG F1 A/B only.
    '__VUE_OPTIONS_API__': process.env.BENCH_OPTIONS_API === 'true' ? 'true' : 'false',
    '__VUE_PROD_DEVTOOLS__': 'false',
    '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': 'false',
    'process.env.NODE_ENV': '"production"',
  },
  build: {
    outDir,
    emptyOutDir: true,
    minify,
    // one chunk per app keeps the size comparison simple
    rolldownOptions: { output: { codeSplitting: false } },
    reportCompressedSize: false,
  },
  logLevel: 'warn',
})
