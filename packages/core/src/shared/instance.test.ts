import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { findBlockElement, getAssignedPropKeys, getInstance, getInstanceRootNode, hasAssignedProp, isVaporInstance, setVaporInstanceResolver } from './instance'

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
    expect(isVaporInstance(seen)).toBe(false)
  })

  it('getInstance prefers a registered Vapor instance', () => {
    const vapor = fakeVapor()
    setVaporInstanceResolver(() => vapor)
    try {
      expect(getInstance()).toBe(vapor)
    }
    finally {
      setVaporInstanceResolver(undefined)
    }
  })

  it('getInstance ignores a non-Vapor value from the resolver', () => {
    setVaporInstanceResolver(() => ({ vapor: false }))
    try {
      expect(getInstance()).toBeNull()
    }
    finally {
      setVaporInstanceResolver(undefined)
    }
  })

  it('reads assigned prop keys from VDOM vnode props', () => {
    let keys: string[] = []
    const Child = defineComponent({ props: { a: Boolean, b: String }, setup() {
      keys = getAssignedPropKeys(getInstance())
      return () => h('div')
    } })
    mount(defineComponent({ render: () => h(Child, { 'a': true, 'data-x': '1' }) }))
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
})
