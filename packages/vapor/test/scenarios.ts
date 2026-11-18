import type { Mode } from './mount'
import { afterEach, describe, expect, it } from 'vitest'
import AsChildButton from '../src/AsChildButton.vue'
import CheckboxDemo from '../src/CheckboxDemo.vue'
import CollapsibleDemo from '../src/CollapsibleDemo.vue'
import ForwardExposeDemo from '../src/ForwardExposeDemo.vue'
import RefDemo from '../src/RefDemo.vue'
import WrappedCollapsibleHost from '../src/WrappedCollapsibleHost.vue'
import { cleanup, flush, mount } from './mount'

/**
 * Behaviour every supported mode has to pass. Shared by the interop suite
 * (reka-ui compiled as VDOM) and the Vapor-only suite (reka-ui compiled as Vapor).
 */
export function runCoreScenarios(mode: Mode) {
  afterEach(cleanup)

  describe(`Primitive as-child (${mode})`, () => {
    it('merges attrs, classes and listeners onto the slotted element', async () => {
      const { host, exposed } = mount(AsChildButton, mode)
      const button = host.querySelector('#child') as HTMLButtonElement
      expect(button).toBeTruthy()
      // no wrapper element is rendered
      expect(host.querySelectorAll('button')).toHaveLength(1)
      expect(button.classList.contains('own')).toBe(true)
      expect(button.classList.contains('from-primitive')).toBe(true)
      expect(button.getAttribute('data-from-parent')).toBe('yes')

      button.click()
      await flush()
      expect(exposed().clicks.value).toBe(1)
      expect(exposed().childClicks.value).toBe(1)
      expect(button.textContent).toContain('clicked 1')
    })

    // reka-ui's VDOM Slot gives the child's own props priority
    // (`mergeProps(attrs, child.props)`). Vue's interop applies the clone extras
    // as fallthrough attrs, where the parent wins: a known divergence.
    const childWins = mode === 'vapor-only' ? it : it.fails
    childWins('lets the child\'s own attribute win over Primitive attrs', () => {
      const { host } = mount(AsChildButton, mode)
      expect(host.querySelector('#child')!.getAttribute('title')).toBe('from-child')
    })

    it('keeps the merged attrs reactive', async () => {
      const { host, exposed } = mount(AsChildButton, mode)
      const button = host.querySelector('#child') as HTMLButtonElement
      expect(button.classList.contains('is-active')).toBe(false)
      expect(button.getAttribute('aria-pressed')).toBe('false')

      exposed().active.value = true
      await flush()
      expect(button.classList.contains('is-active')).toBe(true)
      expect(button.classList.contains('own')).toBe(true)
      expect(button.getAttribute('aria-pressed')).toBe('true')

      exposed().active.value = false
      await flush()
      expect(button.classList.contains('is-active')).toBe(false)
      expect(button.getAttribute('aria-pressed')).toBe('false')
    })
  })

  describe(`Collapsible (${mode})`, () => {
    it('toggles with an as-child trigger and Presence-driven content', async () => {
      const { host } = mount(CollapsibleDemo, mode)
      const trigger = host.querySelector('#trigger') as HTMLButtonElement
      const content = () => host.querySelector('#content') as HTMLElement
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      expect(trigger.getAttribute('data-state')).toBe('closed')
      expect(trigger.getAttribute('type')).toBe('button')
      expect(content().hidden).toBe(true)
      expect(content().textContent?.trim()).toBe('')

      trigger.click()
      await flush()
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
      expect(trigger.getAttribute('aria-controls')).toBe('content')
      expect(content().hidden).toBe(false)
      expect(content().textContent?.trim()).toBe('secret')
      expect(host.querySelector('#state')!.textContent).toBe('open')

      trigger.click()
      await flush()
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      expect(content().hidden).toBe(true)
      expect(host.querySelector('#state')!.textContent).toBe('closed')
    })

    it('forwards only assigned props and all emits through useForwardPropsEmits', async () => {
      const { host, exposed } = mount(WrappedCollapsibleHost, mode)
      const trigger = host.querySelector('#wrapped-trigger') as HTMLButtonElement
      // `default-open` was assigned by the host, so it is forwarded
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
      expect(host.querySelector('#wrapped-content')!.textContent?.trim()).toBe('wrapped')

      trigger.click()
      await flush()
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      // `update:open` reached the host through the forwarded `onUpdate:open`
      expect(exposed().events.value).toEqual([false])
    })
  })

  describe(`Checkbox (${mode})`, () => {
    it('toggles, updates v-model and mounts/unmounts the indicator', async () => {
      const { host } = mount(CheckboxDemo, mode)
      const checkbox = host.querySelector('#cb') as HTMLButtonElement
      expect(checkbox.getAttribute('role')).toBe('checkbox')
      expect(checkbox.getAttribute('aria-checked')).toBe('false')
      expect(host.querySelector('#indicator')).toBeNull()

      checkbox.click()
      await flush()
      expect(checkbox.getAttribute('aria-checked')).toBe('true')
      expect(checkbox.getAttribute('data-state')).toBe('checked')
      expect(host.querySelector('#indicator')).toBeTruthy()
      expect(host.querySelector('#value')!.textContent).toBe('true')

      checkbox.click()
      await flush()
      expect(checkbox.getAttribute('aria-checked')).toBe('false')
      expect(host.querySelector('#indicator')).toBeNull()
      expect(host.querySelector('#value')!.textContent).toBe('false')
    })
  })

  describe(`template refs (${mode})`, () => {
    it('resolve $el and exposed props of reka-ui components', async () => {
      const { exposed } = mount(RefDemo, mode)
      await flush()
      const prim = exposed().prim.value
      const root = exposed().root.value
      expect(prim.$el).toBeInstanceOf(HTMLElement)
      expect(prim.$el.id).toBe('prim')
      expect(prim.$el.tagName).toBe('SECTION')
      expect(root.$el.id).toBe('croot')
      // useForwardExpose exposes the component's props
      expect(root.defaultOpen).toBe(true)
      expect(root.open).toBe(true)
    })

    it('work for an app component that calls useForwardExpose', async () => {
      const { exposed } = mount(ForwardExposeDemo, mode)
      await flush()
      const wrapper = exposed().wrapper.value
      expect(wrapper.$el).toBeInstanceOf(HTMLElement)
      expect(wrapper.$el.id).toBe('fwd')
      expect(wrapper.$el.tagName).toBe('ARTICLE')
      expect(wrapper.label).toBe('forwarded')
      expect(wrapper.$el.getAttribute('aria-label')).toBe('forwarded')
    })
  })
}
