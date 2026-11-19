import type { Plugin } from 'vite'
import { fileURLToPath } from 'node:url'

const coreSrc = fileURLToPath(new URL('../../core/src/', import.meta.url))
const vueTest = fileURLToPath(new URL('./vue-test.ts', import.meta.url))
const TEST_FILE_RE = /\.test\.ts$|\/test\/.*\.ts$/

/** Test files (only) import `vue` from suite/vue-test.ts: the render-function bridge. */
export function testFileVue(): Plugin {
  return {
    name: 'reka-ui:vapor-suite-test-vue',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !importer.startsWith(coreSrc) || !TEST_FILE_RE.test(importer.split('?')[0]))
        return null
      if (source === 'vue' || source.endsWith('/vue.runtime.esm-bundler.js'))
        return vueTest
      return null
    },
  }
}
