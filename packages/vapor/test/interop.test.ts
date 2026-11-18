import { CollapsibleRoot, Primitive } from 'reka-ui'
import { afterEach, describe, expect, it } from 'vitest'
import AsChildButton from '../src/AsChildButton.vue'
import DialogDemo from '../src/DialogDemo.vue'
import TabsDemo from '../src/TabsDemo.vue'
import WrappedCollapsibleHost from '../src/WrappedCollapsibleHost.vue'
import { cleanup, flush, mount } from './mount'
import { runCoreScenarios } from './scenarios'

// reka-ui compiled as usual (VDOM), used from Vapor components through
// Vue's `vaporInteropPlugin`. This is what works for users today on
// Vue >= 3.6.0-rc.15 without any reka-ui change.

it('fixtures are Vapor, reka-ui is VDOM', () => {
  expect((AsChildButton as any).__vapor).toBe(true)
  expect((CollapsibleRoot as any).__vapor).toBeUndefined()
  expect((Primitive as any).__vapor).toBeUndefined()
})

for (const mode of ['vapor-app+interop', 'vdom-app+interop'] as const) {
  runCoreScenarios(mode)

  describe(`components outside the Vapor-only subset (${mode})`, () => {
    afterEach(cleanup)

    it('tabs switches panels', async () => {
      const { host } = mount(TabsDemo, mode)
      const tabB = host.querySelector('#tab-b') as HTMLElement
      expect(host.querySelector('[role="tablist"]')).toBeTruthy()
      tabB.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
      await flush()
      expect(tabB.getAttribute('aria-selected')).toBe('true')
      expect(host.querySelector('#panel-b')!.textContent?.trim()).toBe('Panel B')
    })

    it('dialog opens into a teleport, focuses, and closes on Escape and DialogClose', async () => {
      const { host } = mount(DialogDemo, mode)
      ;(host.querySelector('#open') as HTMLElement).click()
      await flush()
      const dialog = document.querySelector('#dialog') as HTMLElement
      expect(dialog).toBeTruthy()
      expect(host.contains(dialog)).toBe(false)
      expect(dialog.getAttribute('role')).toBe('dialog')
      expect(dialog.contains(document.activeElement)).toBe(true)

      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await flush()
      expect(document.querySelector('#dialog')).toBeNull()
      expect(host.querySelector('#dialog-state')!.textContent).toBe('closed')

      ;(host.querySelector('#open') as HTMLElement).click()
      await flush()
      ;(document.querySelector('#close') as HTMLElement).click()
      await flush()
      expect(document.querySelector('#dialog')).toBeNull()
    })
  })
}

describe('without `reka-ui/vapor` opt-in', () => {
  afterEach(cleanup)

  it('useForwardPropsEmits called from a Vapor component forwards nothing (reka-ui 2.11 behaviour)', async () => {
    const { setVaporInstanceResolver } = await import('@/shared/instance')
    setVaporInstanceResolver(undefined)
    try {
      const { host } = mount(WrappedCollapsibleHost, 'vapor-app+interop')
      // `default-open` was passed but silently dropped
      expect(host.querySelector('#wrapped-trigger')!.getAttribute('aria-expanded')).toBe('false')
    }
    finally {
      const mod = await import('vue') as any
      setVaporInstanceResolver(() => mod.currentInstance)
    }
  })
})
