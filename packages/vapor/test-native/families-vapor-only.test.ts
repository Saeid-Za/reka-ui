import { afterEach, describe, it } from 'vitest'
import { families } from '../test/families'
import { cleanup, mount } from '../test/mount'

// Family coverage with reka-ui source compiled as Vapor, `createVaporApp`, no interop.
describe('families (vapor-only)', () => {
  afterEach(cleanup)
  for (const family of families) {
    // Known gaps are expected failures, so the run fails once a gap is fixed.
    ;(family.vaporOnlyGap ? it.fails : it)(family.vaporOnlyGap ? `${family.name} [known gap]` : family.name, async () => {
      const teardown = family.setup?.()
      try {
        const { host } = mount(family.component, 'vapor-only')
        await family.check(host)
      }
      finally {
        teardown?.()
      }
    })
  }
})
