import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, flush, mount } from '../test/mount'
import PresenceForceMount from './fixtures/PresenceForceMount.vue'

describe('forceMount Presence (vdom)', () => {
  afterEach(cleanup)

  it('stays visible when present is false (VDOM parity)', async () => {
    const { host } = mount(PresenceForceMount, 'vdom')
    await flush()
    const el = () => host.querySelector('[data-testid="body"]') as HTMLElement | null
    expect(el()).toBeTruthy()
    expect(getComputedStyle(el()!).display).not.toBe('none')
  })
})
