import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, flush, mount } from '../test/mount'
import PresenceForceMount from './fixtures/PresenceForceMount.vue'

describe('presence forceMount (vapor-only, C1)', () => {
  afterEach(cleanup)

  it('keeps the node mounted but display:none when closed', async () => {
    const { host, exposed } = mount(PresenceForceMount, 'vapor-only')
    await flush()
    const el = () => host.querySelector('[data-testid="body"]') as HTMLElement | null
    expect(el()).toBeTruthy()
    expect(getComputedStyle(el()!).display).not.toBe('none')

    exposed().open.value = false
    await flush()
    expect(el()).toBeTruthy()
    expect(getComputedStyle(el()!).display).toBe('none')

    exposed().open.value = true
    await flush()
    expect(getComputedStyle(el()!).display).not.toBe('none')
  })
})
