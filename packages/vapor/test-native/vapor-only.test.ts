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

// Known gaps of this first step, tracked in CHANGES.md (phase 2):
it.todo('tabs / RovingFocus / Listbox: `useCollection` builds CollectionSlot/CollectionItem with h() + Slot')
it.todo('dialog and other overlays: `useContentMounted` reads instance.vnode.el / $forceUpdate; DismissableLayer, FocusScope and Teleport need a Vapor pass')
it.todo('virtualizers: cloneVNode on slot output (Listbox/Tree/ScrollArea virtualizers)')
