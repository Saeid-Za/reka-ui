import type { Plugin } from 'vite'
import { fileURLToPath } from 'node:url'

const coreSrc = fileURLToPath(new URL('../../core/src/', import.meta.url))
const suiteDir = fileURLToPath(new URL('./', import.meta.url))
const proxy = `${suiteDir}vueSuiteProxy.ts`
const REAL_VUE = /[/\\]node_modules[/\\]vue[/\\]/
const REAL_VUE_PKG = /[/\\]node_modules[/\\]@vue[/\\]/
const VITE_VUE = /[/\\]@vitejs[/\\]plugin-vue[/\\]/
/** Share one Vue instance across the suite after `vi.resetModules()` (S2 / 9.4). */
export function vueSuiteProxyPlugin(): Plugin {
  return {
    name: 'reka-ui:vapor-suite-vue-proxy',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source !== 'vue' || !importer)
        return null
      const id = importer.split('?')[0]
      if (REAL_VUE.test(id) || REAL_VUE_PKG.test(id) || VITE_VUE.test(id))
        return null
      if (
        id.startsWith(coreSrc)
        || id.startsWith(suiteDir)
        || id.startsWith('\0vssr:')
        || id.startsWith('\0reka-vapor-swap:')
      ) {
        return proxy
      }
      return null
    },
  }
}
