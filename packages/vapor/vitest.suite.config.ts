import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { createConfig } from './config.shared.ts'
import { injectExposeRoot, rekaVaporSwap, SWAPS } from './rekaVapor.ts'
import { inlineVaporTemplates } from './suite/inlineTemplates.ts'
import { vaporSsrTwins } from './suite/ssrTwins.ts'
import { stubbableComponents } from './suite/stubsPlugin.ts'
import { testFileVue } from './suite/testFileVue.ts'
import { vueSuiteProxyPlugin } from './suite/vueSuiteProxyPlugin.ts'

// Reka's own jsdom suite (packages/core/src/**/*.test.ts), unchanged, in pure
// Vapor: every SFC compiled as Vapor, `createVaporApp`, no interop plugin.
const core = fileURLToPath(new URL('../core/', import.meta.url))
const suite = fileURLToPath(new URL('./suite/', import.meta.url))
// The real @testing-library/vue's own @testing-library/dom (pure DOM, no Vue).
const coreRequire = createRequire(`${core}package.json`)
const testingLibraryDom = coreRequire.resolve('@testing-library/dom', { paths: [dirname(coreRequire.resolve('@testing-library/vue'))] })

// The real server renderer, the one `vue` itself ships with (Vapor SSR, suite/ssr.ts).
const vueRequire = createRequire(createRequire(import.meta.url).resolve('vue/package.json'))
const serverRenderer = join(dirname(vueRequire.resolve('@vue/server-renderer/package.json')), 'dist/server-renderer.esm-bundler.js')
const vueRuntime = join(dirname(vueRequire.resolve('vue/package.json')), 'dist/vue.runtime.esm-bundler.js')

const config = createConfig({
  plugins: [vueSuiteProxyPlugin(), vaporSsrTwins(injectExposeRoot, SWAPS), testFileVue(), inlineVaporTemplates(), rekaVaporSwap(), vue({ features: { vapor: true } }), stubbableComponents()],
  include: [],
})

config.resolve!.alias = [
  { find: /^@vue\/test-utils$/, replacement: `${suite}test-utils.ts` },
  { find: /^@testing-library\/vue$/, replacement: `${suite}testing-library.ts` },
  { find: /^@vue\/test-utils\/dist\/(.*)$/, replacement: `${core}node_modules/@vue/test-utils/dist/$1` },
  { find: /^@testing-library\/dom$/, replacement: testingLibraryDom },
  { find: /^@iconify\/vue$/, replacement: `${suite}iconify.ts` },
  { find: /^(?:@vue|vue)\/server-renderer$/, replacement: `${suite}server-renderer.ts` },
  { find: /^vapor-suite:real-server-renderer$/, replacement: serverRenderer },
  { find: /^vapor-suite:real-vue$/, replacement: vueRuntime },
  ...(config.resolve!.alias as any[]),
]
Object.assign(config.test!, {
  dir: `${core}src`,
  include: ['**/*.test.ts'],
  exclude: ['**/node_modules/**', '**/*.browser.test.ts', '**/__probe__/**'],
  setupFiles: [`${suite}setup.ts`],
  globalSetup: `${suite}global.ts`,
  // Never write snapshots: the stored ones are the VDOM output and stay the reference.
  update: false,
  snapshotOptions: { updateSnapshot: 'none' },
  environmentOptions: { jsdom: { resources: 'usable' } },
})
const inlineDeps = (config.test!.server!.deps!.inline as any[]).filter(
  (dep: unknown) => !(dep instanceof RegExp && dep.source === 'vue'),
)
config.test!.server!.deps!.inline = [...inlineDeps, `${suite}vueSuiteProxy.ts`, 'vitest-canvas-mock']
config.test!.server!.deps!.external = [
  ...(config.test!.server!.deps!.external as any[] ?? []),
  'vapor-suite:real-vue',
]

export default config
