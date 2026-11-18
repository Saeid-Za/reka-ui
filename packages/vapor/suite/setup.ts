import { readFileSync } from 'node:fs'
import { beforeAll, expect } from 'vitest'
// Full-suite setup: marks the run as Vapor (`isVapor` in core/src/test/mode.ts),
// then Reka's own `vitest.setup.ts` plus the Vapor resolver import every Vue 3.6 app
// using reka-ui composables in Vapor components does once.
import './mode'
import '@/vapor'
import '../../core/vitest.setup'

// The server copy of Reka (ssrTwins.ts) is compiled on first use. In a file that
// renders on the server, compile it before the tests run, so its first test does not
// pay for it within its timeout (the VDOM run has no second copy to compile).
beforeAll(async () => {
  const testPath = expect.getState().testPath
  if (testPath && readFileSync(testPath, 'utf8').includes('renderToString'))
    await import('vssr:@/index.ts')
}, 120_000)
