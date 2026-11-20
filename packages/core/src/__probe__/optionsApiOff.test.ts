import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'

describe('options API compile flag (probe)', () => {
  it('sets __VUE_OPTIONS_API__ false at build time', () => {
    // @ts-expect-error injected by vitest `define`
    expect(__VUE_OPTIONS_API__).toBe(false)
    const Wrapper = defineComponent({
      data() {
        return { x: 1 }
      },
      template: '<span>{{ x }}</span>',
    })
    const wrapper = mount(Wrapper)
    // Vue 3.6 + @vitejs/plugin-vue still renders `data()` in this harness even with
    // the flag off; this pins the current behaviour.
    expect(wrapper.text()).toBe('1')
    wrapper.unmount()
  })
})
