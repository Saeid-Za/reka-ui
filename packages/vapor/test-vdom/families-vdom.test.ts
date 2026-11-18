import { afterEach, describe, expect, it } from 'vitest'
import AsChildButton from '../src/AsChildButton.vue'
import { families } from '../test/families'
import { cleanup, mount } from '../test/mount'

// Baseline: fixtures and reka-ui both compiled as VDOM, `createApp`, no interop.
it('fixtures are compiled as VDOM components here', () => {
  expect((AsChildButton as any).__vapor).toBeFalsy()
})

describe('families (vdom)', () => {
  afterEach(cleanup)
  for (const family of families) {
    it(family.name, async () => {
      const teardown = family.setup?.()
      try {
        const { host } = mount(family.component, 'vdom')
        await family.check(host)
      }
      finally {
        teardown?.()
      }
    })
  }
})
