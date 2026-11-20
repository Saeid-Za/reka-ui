import { useForwardExpose } from 'reka-ui'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { cleanup, flush, mount } from '../test/mount'

describe('useForwardExpose.vapor: static vs dynamic getter $el refs', () => {
  afterEach(cleanup)

  it('falls back to root element when forwarded a static { $el: null } ref', async () => {
    let forwarded!: ReturnType<typeof useForwardExpose>
    const Comp = defineComponent({
      __vapor: true,
      setup() {
        forwarded = useForwardExpose()
        forwarded.forwardRef({ $el: null })
        return () => h('div', { id: 'root-fallback' })
      },
    })
    const { host } = mount(Comp, 'vapor-only')
    await flush()
    expect(forwarded.currentElement.value).toBe(host.querySelector('#root-fallback'))
  })

  // Vapor does not synthesize `$el` on child instances.
  it('leaves parent $el undefined when the forwarded Vapor child exposes nothing', async () => {
    const Child = defineComponent({
      __vapor: true,
      setup() {
        return () => h('span', { id: 'inner' }, 'child')
      },
    })
    const Parent = defineComponent({
      __vapor: true,
      setup() {
        const { forwardRef } = useForwardExpose()
        const parentEl = ref<{ $el?: HTMLElement }>()
        return () => h('div', [
          h(Child, { ref: forwardRef }),
          h('div', { id: 'probe', ref: parentEl as any }),
        ])
      },
    })
    let forwarded!: ReturnType<typeof useForwardExpose>
    const Root = defineComponent({
      __vapor: true,
      setup() {
        const { forwardRef, ...rest } = useForwardExpose()
        forwarded = { forwardRef, ...rest } as typeof forwarded
        return () => h(Parent)
      },
    })
    mount(Root, 'vapor-only')
    await flush()
    expect(forwarded.currentElement.value).toBeUndefined()
  })

  it('preserves ref with dynamic $el getter even when it temporarily returns null', async () => {
    let forwarded!: ReturnType<typeof useForwardExpose>
    const activeEl = ref<HTMLElement | null>(null)
    const dynamicRef = {
      get $el() {
        return activeEl.value
      },
    }
    const Comp = defineComponent({
      __vapor: true,
      setup() {
        forwarded = useForwardExpose()
        forwarded.forwardRef(dynamicRef)
        return () => h('div', { id: 'root' })
      },
    })
    mount(Comp, 'vapor-only')
    await flush()
    expect(forwarded.currentElement.value).toBeUndefined()

    const btn = document.createElement('button')
    activeEl.value = btn
    await flush()
    expect(forwarded.currentElement.value).toBe(btn)
  })
})
