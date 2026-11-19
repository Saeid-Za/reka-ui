import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, flush, mount } from '../test/mount'
import KeepAliveDemo from './fixtures/KeepAliveDemo.vue'

describe('keepAlive with Reka in native Vapor SFC', () => {
  afterEach(cleanup)

  it('drops trigger reference when KeepAlive deactivates content and restores on reactivate', async () => {
    const { host, exposed } = mount(KeepAliveDemo, 'vapor-only')
    await flush()

    const trigger = () => host.querySelector('#trigger')
    const content = () => document.body.querySelector('#dialog-content')

    expect(content()).not.toBeNull()
    expect(trigger()?.getAttribute('aria-controls')).toBe('dialog-content')

    // Deactivate content via KeepAlive
    exposed().active.value = false
    await flush()

    // Trigger should drop the reference while deactivated
    expect(trigger()?.getAttribute('aria-controls')).toBeNull()

    // Reactivate content via KeepAlive
    exposed().active.value = true
    await flush()

    // Trigger should re-acquire the reference once reactivated
    expect(content()).not.toBeNull()
    expect(trigger()?.getAttribute('aria-controls')).toBe('dialog-content')
  })
})
