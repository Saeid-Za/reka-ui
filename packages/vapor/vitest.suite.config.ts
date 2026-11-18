import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { createConfig } from './config.shared.ts'
import { rekaVaporSwap } from './rekaVapor.ts'
import { inlineVaporTemplates } from './suite/inlineTemplates.ts'
import { testFileVue } from './suite/testFileVue.ts'

// Reka's own jsdom suite (packages/core/src/**/*.test.ts), unchanged, in pure
// Vapor: every SFC compiled as Vapor, `createVaporApp`, no interop plugin.
// See vapor-proposal/FULL_SUITE.md.
const core = fileURLToPath(new URL('../core/', import.meta.url))
const suite = fileURLToPath(new URL('./suite/', import.meta.url))
// The real @testing-library/vue's own @testing-library/dom (pure DOM, no Vue).
const coreRequire = createRequire(`${core}package.json`)
const testingLibraryDom = coreRequire.resolve('@testing-library/dom', { paths: [dirname(coreRequire.resolve('@testing-library/vue'))] })

const config = createConfig({
  plugins: [testFileVue(), inlineVaporTemplates(), rekaVaporSwap(), vue({ features: { vapor: true } })],
  include: [],
})

config.resolve!.alias = [
  { find: /^@vue\/test-utils$/, replacement: `${suite}test-utils.ts` },
  { find: /^@testing-library\/vue$/, replacement: `${suite}testing-library.ts` },
  { find: /^@vue\/test-utils\/dist\/(.*)$/, replacement: `${core}node_modules/@vue/test-utils/dist/$1` },
  { find: /^@testing-library\/dom$/, replacement: testingLibraryDom },
  { find: /^@iconify\/vue$/, replacement: `${suite}iconify.ts` },
  { find: /^(?:@vue|vue)\/server-renderer$/, replacement: `${suite}server-renderer.ts` },
  ...(config.resolve!.alias as any[]),
]
Object.assign(config.test!, {
  dir: `${core}src`,
  include: ['**/*.test.ts'],
  exclude: ['**/node_modules/**', '**/*.browser.test.ts'],
  setupFiles: [`${suite}setup.ts`],
  globalSetup: `${suite}global.ts`,
  // Never write snapshots: the stored ones are the VDOM output and stay the reference.
  update: false,
  snapshotOptions: { updateSnapshot: 'none' },
  environmentOptions: { jsdom: { resources: 'usable' } },
})
config.test!.server!.deps!.inline = [...(config.test!.server!.deps!.inline as any[]), 'vitest-canvas-mock']

export default config
