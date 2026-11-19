import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

describe('options API compile flag (probe)', () => {
  it('sets __VUE_OPTIONS_API__ false at build time (see QS19 for runtime)', () => {
    // @ts-expect-error injected by vitest `define`
    expect(__VUE_OPTIONS_API__).toBe(false)
    const Wrapper = defineComponent({
      data() {
        return { x: 1 }
      },
      template: '<span>{{ x }}</span>',
    })
    const wrapper = mount(Wrapper)
    // Vue 3.6 + @vitejs/plugin-vue still renders `data()` in this harness (QS19).
    expect(wrapper.text()).toBe('1')
    wrapper.unmount()
  })
})
