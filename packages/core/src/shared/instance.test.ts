import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { isVapor } from '@/test'
import { exposeRootElement, findBlockElement, getAssignedPropKeys, getInstance, getInstanceRootNode, hasAssignedProp, isVaporInstance, setVaporInstanceResolver } from './instance'

function fakeVapor(overrides: Record<string, any> = {}) {
  return { vapor: true, type: {}, props: {}, rawProps: {}, exposed: null, block: null, parent: null, ...overrides } as any
}

describe('instance helpers', () => {
  it('getInstance falls back to getCurrentInstance for VDOM components', () => {
    let seen: any
    mount(defineComponent({ setup() {
      seen = getInstance()
      return () => h('div')
    } }))
    expect(seen).toBeTruthy()
    // Under the pure-Vapor suite the same component is a Vapor one, so the
    // helper must return its Vapor instance instead.
    expect(isVaporInstance(seen)).toBe(isVapor)
  })

  it('getInstance prefers a registered Vapor instance', () => {
    const vapor = fakeVapor()
    const previous = setVaporInstanceResolver(() => vapor)
    try {
      expect(getInstance()).toBe(vapor)
    }
    finally {
      // Put back the resolver the Vapor entry registered (none under VDOM).
      setVaporInstanceResolver(previous)
    }
  })

  it('getInstance ignores a non-Vapor value from the resolver', () => {
    const previous = setVaporInstanceResolver(() => ({ vapor: false }))
    try {
      expect(getInstance()).toBeNull()
    }
    finally {
      // Put back the resolver the Vapor entry registered (none under VDOM).
      setVaporInstanceResolver(previous)
    }
  })

  it('reads assigned prop keys from VDOM vnode props', () => {
    let keys: string[] = []
    const Child = defineComponent({ props: { a: Boolean, b: String }, setup() {
      keys = getAssignedPropKeys(getInstance())
      return () => h('div')
    } })
    mount(defineComponent({ render: () => h(Child, { 'a': true, 'data-x': '1' }) }))
    // Pure-Vapor suite: the same keys, read from the Vapor instance's raw props.
    expect(keys).toEqual(['a', 'data-x'])
  })

  it('reads assigned prop keys from Vapor raw props, including dynamic sources', () => {
    const vapor = fakeVapor({ rawProps: { defaultOpen: () => true, $: [{ 'onUpdate:open': () => {} }, () => ({ dir: 'rtl' })] } })
    expect(getAssignedPropKeys(vapor).sort()).toEqual(['defaultOpen', 'dir', 'onUpdate:open'])
    expect(hasAssignedProp(vapor, 'default-open')).toBe(true)
    expect(hasAssignedProp(vapor, 'open')).toBe(false)
    expect(getAssignedPropKeys(null)).toEqual([])
  })

  it('finds the first element of a Vapor block', () => {
    const a = document.createElement('a')
    const span = document.createElement('span')
    const comment = document.createComment('if')
    expect(findBlockElement(span)).toBe(span)
    expect(findBlockElement([comment, { nodes: [document.createTextNode('x'), a] }, span])).toBe(a)
    expect(findBlockElement(fakeVapor({ block: [comment, { nodes: span }] }))).toBe(span)
    expect(findBlockElement([comment])).toBeUndefined()
    expect(getInstanceRootNode(fakeVapor({ block: { nodes: [a] } }))).toBe(a)
  })

  it('exposeRootElement adds a $el getter to Vapor instances only', () => {
    const el = document.createElement('span')
    const vapor = fakeVapor({ block: [document.createComment(''), el] })
    const previous = setVaporInstanceResolver(() => vapor)
    try {
      exposeRootElement()
      expect(vapor.exposed.$el).toBe(el)
      // an existing `$el` is kept
      const own = fakeVapor({ exposed: { $el: 'own' } })
      setVaporInstanceResolver(() => own)
      exposeRootElement()
      expect(own.exposed.$el).toBe('own')
    }
    finally {
      // Put back the resolver the Vapor entry registered (none under VDOM).
      setVaporInstanceResolver(previous)
    }
    let exposed: any
    mount(defineComponent({ setup() {
      exposeRootElement()
      exposed = getInstance()!.exposed
      return () => h('div')
    } }))
    // Pure-Vapor suite: the component is a Vapor one, so it gets the getter.
    if (isVapor)
      expect(exposed.$el).toBeInstanceOf(HTMLDivElement)
    else
      expect(exposed).toBeNull()
  })
})
