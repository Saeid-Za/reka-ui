import { afterEach, describe, it } from 'vitest'
import { families } from './families'
import { cleanup, mount } from './mount'

// Family coverage with reka-ui as published today (VDOM) inside Vapor apps.
for (const mode of ['vapor-app+interop', 'vdom-app+interop'] as const) {
  describe(`families (${mode})`, () => {
    afterEach(cleanup)
    for (const family of families) {
      it(family.name, async () => {
        const teardown = family.setup?.()
        try {
          const { host } = mount(family.component, mode)
          await family.check(host)
        }
        finally {
          teardown?.()
        }
      })
    }
  })
}
