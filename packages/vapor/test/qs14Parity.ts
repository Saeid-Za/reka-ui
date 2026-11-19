import type { Mode } from './mount'
import { afterEach, describe, expect, it } from 'vitest'
import Qs14ComboboxContentForceMount from '../test-native/fixtures/Qs14ComboboxContentForceMount.vue'
import Qs14ComboboxUnmountOnHide from '../test-native/fixtures/Qs14ComboboxUnmountOnHide.vue'
import Qs14DialogContentForceMount from '../test-native/fixtures/Qs14DialogContentForceMount.vue'
import Qs14DialogUnmountOnHide from '../test-native/fixtures/Qs14DialogUnmountOnHide.vue'
import { cleanup, flush, mount } from './mount'

function visible(el: HTMLElement | null) {
  return !!el && getComputedStyle(el).display !== 'none'
}

export function runQs14Parity(mode: Mode) {
  describe(`QS14 caller v-show parity (${mode})`, () => {
    afterEach(cleanup)

    it('DialogContent forceMount: closed content stays visible', async () => {
      const { host } = mount(Qs14DialogContentForceMount, mode)
      await flush()
      const el = () => host.querySelector('[data-testid="content"]') as HTMLElement | null
      expect(el()).toBeTruthy()
      expect(visible(el())).toBe(true)
    })

    it('Dialog unmountOnHide=false: hide when closed, show when reopened', async () => {
      const { host, exposed } = mount(Qs14DialogUnmountOnHide, mode)
      await flush()
      const el = () => host.querySelector('[data-testid="content"]') as HTMLElement | null
      expect(visible(el())).toBe(true)
      exposed().open.value = false
      await flush()
      await flush()
      expect(el()).toBeTruthy()
      expect(visible(el())).toBe(false)
      exposed().open.value = true
      await flush()
      expect(visible(el())).toBe(true)
    })

    it('Combobox unmountOnHide=false: hide when closed, show when reopened', async () => {
      const { exposed } = mount(Qs14ComboboxUnmountOnHide, mode)
      await flush()
      const el = () => document.body.querySelector('[data-testid="content"]') as HTMLElement | null
      expect(visible(el())).toBe(true)
      exposed().open.value = false
      await flush()
      await flush()
      expect(el()).toBeTruthy()
      expect(visible(el())).toBe(false)
      exposed().open.value = true
      await flush()
      expect(visible(el())).toBe(true)
    })

    it('ComboboxContent forceMount with root closed matches VDOM visibility', async () => {
      const { exposed } = mount(Qs14ComboboxContentForceMount, mode)
      await flush()
      exposed().open.value = false
      await flush()
      const el = () => document.body.querySelector('[data-testid="content"]') as HTMLElement | null
      expect(el()).toBeTruthy()
      expect(visible(el())).toBe(true)
    })
  })
}
