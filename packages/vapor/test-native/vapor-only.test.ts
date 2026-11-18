import { CheckboxRoot, CollapsibleRoot, CollapsibleTrigger, Presence, Primitive } from 'reka-ui'
import { expect, it } from 'vitest'
import { runCoreScenarios } from '../test/scenarios'

// reka-ui *source* compiled in Vapor mode (every SFC, see
// vitest.native.config.ts) and mounted with `createVaporApp` and no interop
// plugin: no virtual DOM runtime is involved in rendering.

it('reka-ui components are compiled as Vapor components', () => {
  for (const component of [Primitive, Presence, CollapsibleRoot, CollapsibleTrigger, CheckboxRoot])
    expect((component as any).__vapor).toBe(true)
})

runCoreScenarios('vapor-only')

// Per-component coverage (incl. Tabs/Collection and Dialog/overlays) is in
// families-vapor-only.test.ts. Remaining known gap, tracked in CHANGES.md:
it.todo('virtualizers (Listbox/Tree/ScrollArea/Combobox): cloneVNode on slot output')
