import { CheckboxRoot, CollapsibleRoot, CollapsibleTrigger, Presence, Primitive } from 'reka-ui'
import { afterEach, describe, expect, it } from 'vitest'
import PresenceAttrsDemo from '../src/PresenceAttrsDemo.vue'
import { cleanup, flush, mount } from '../test/mount'
import { runCoreScenarios } from '../test/scenarios'

// reka-ui *source* compiled in Vapor mode (every SFC, see
// vitest.native.config.ts) and mounted with `createVaporApp` and no interop
// plugin: no virtual DOM runtime is involved in rendering.

it('reka-ui components are compiled as Vapor components', () => {
  for (const component of [Primitive, Presence, CollapsibleRoot, CollapsibleTrigger, CheckboxRoot])
    expect((component as any).__vapor).toBe(true)
})

runCoreScenarios('vapor-only')

// Presence.vapor applies its attrs to the slot's element by hand (PERF_LOG E8).
describe('presence.vapor attrs (vapor-only)', () => {
  afterEach(cleanup)

  it('re-applies changed attrs to the rendered child and after re-entering', async () => {
    const { host, exposed } = mount(PresenceAttrsDemo, 'vapor-only')
    await flush()
    const el = () => host.querySelector('#pres')
    expect(el()!.getAttribute('data-tone')).toBe('a')

    exposed().tone.value = 'b'
    await flush()
    expect(el()!.getAttribute('data-tone')).toBe('b')

    exposed().present.value = false
    await flush()
    expect(el()).toBeNull()

    // changed while nothing is rendered, then shown again
    exposed().tone.value = 'c'
    await flush()
    exposed().present.value = true
    await flush()
    expect(el()!.getAttribute('data-tone')).toBe('c')
  })
})

// Per-component coverage (incl. Tabs/Collection and Dialog/overlays) is in
// families-vapor-only.test.ts. Remaining known gap, tracked in CHANGES.md:
it.todo('virtualizers (Listbox/Tree/ScrollArea/Combobox): cloneVNode on slot output')
