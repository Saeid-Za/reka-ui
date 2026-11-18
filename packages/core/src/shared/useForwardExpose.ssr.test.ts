// @vitest-environment node
import type { ComponentInternalInstance } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { createSSRApp, defineComponent, getCurrentInstance, h } from 'vue'
import { isVapor } from '@/test'
import { useForwardExpose } from './useForwardExpose'

// Vapor SSR marks component boundaries with `<!--{-->` / `<!--}-->`.
const VAPOR_BOUNDARY_RE = /<!--[{}]-->/g

describe('given useForwardExpose rendered on the server', () => {
  it('does not build `exposed`', async () => {
    let instance: ComponentInternalInstance | null = null
    // Vapor SSR renders compiled templates, not render functions: same component, as a
    // template. On the server it is a runtime-core instance in both modes.
    const comp = isVapor
      ? defineComponent({
          props: { foo: String, bar: Number },
          setup() {
            const { forwardRef } = useForwardExpose()
            instance = getCurrentInstance()
            return { forwardRef }
          },
          template: '<div :ref="forwardRef">content</div>',
        })
      : defineComponent({
          props: { foo: String, bar: Number },
          setup() {
            const { forwardRef } = useForwardExpose()
            instance = getCurrentInstance()
            return () => h('div', { ref: forwardRef }, 'content')
          },
        })
    const root = isVapor
      ? { components: { Comp: comp }, template: '<Comp foo="a" :bar="1" />' }
      : { render: () => h(comp, { foo: 'a', bar: 1 }) }

    const html = await renderToString(createSSRApp(root))

    expect(isVapor ? html.replace(VAPOR_BOUNDARY_RE, '') : html).toBe('<div>content</div>')
    expect(instance!.exposed).toBeNull()
  })

  it('keeps values exposed before it', async () => {
    let instance: ComponentInternalInstance | null = null
    const setup = (expose: (exposed: Record<string, unknown>) => void) => {
      expose({ focus: () => {} })
      const { forwardRef } = useForwardExpose()
      instance = getCurrentInstance()
      return forwardRef
    }
    const comp = isVapor
      ? defineComponent({ setup: (_, { expose }) => ({ forwardRef: setup(expose) }), template: '<div :ref="forwardRef" />' })
      : defineComponent({
          setup(_, { expose }) {
            const forwardRef = setup(expose)
            return () => h('div', { ref: forwardRef })
          },
        })
    const root = isVapor ? { components: { Comp: comp }, template: '<Comp />' } : { render: () => h(comp) }

    await renderToString(createSSRApp(root))

    expect(Object.keys(instance!.exposed!)).toEqual(['focus'])
  })
})
