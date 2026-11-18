import { describe, expect, it, vi } from 'vitest'
import { applyAsChildAttrs, createAsChildApplier, resolveAsChildTarget } from './asChildAttrs'

function button() {
  const el = document.createElement('button')
  el.className = 'own'
  el.setAttribute('title', 'child')
  return el
}

describe('applyAsChildAttrs', () => {
  it('merges classes and styles, keeps child-owned attributes', () => {
    const el = button()
    applyAsChildAttrs(el, { 'class': ['a', { b: true, c: false }], 'style': { color: 'red' }, 'title': 'parent', 'data-state': 'open', 'aria-expanded': false })
    expect(el.className).toBe('own a b')
    expect(el.style.color).toBe('red')
    expect(el.getAttribute('title')).toBe('child')
    expect(el.getAttribute('data-state')).toBe('open')
    expect(el.getAttribute('aria-expanded')).toBe('false')
  })

  it('diffs against the previous application', () => {
    const el = button()
    applyAsChildAttrs(el, { 'class': 'a', 'style': 'color: red', 'data-x': '1' })
    applyAsChildAttrs(el, { class: 'b' })
    expect(el.className).toBe('own b')
    expect(el.style.color).toBe('')
    expect(el.hasAttribute('data-x')).toBe(false)
  })

  it('chains listeners and updates them without re-adding', () => {
    const el = button()
    const first = vi.fn()
    const second = vi.fn()
    const spy = vi.spyOn(el, 'addEventListener')
    applyAsChildAttrs(el, { onClick: first })
    applyAsChildAttrs(el, { onClick: [second] })
    el.click()
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledTimes(1)
    applyAsChildAttrs(el, {})
    el.click()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('sets boolean DOM properties as properties', () => {
    const el = document.createElement('button')
    applyAsChildAttrs(el, { disabled: true })
    expect(el.disabled).toBe(true)
    applyAsChildAttrs(el, { disabled: false })
    expect(el.disabled).toBe(false)
    applyAsChildAttrs(el, {})
    expect(el.disabled).toBe(false)
  })

  it('parses listener options and hyphenates event names like runtime-dom', () => {
    const el = document.createElement('div')
    const spy = vi.spyOn(el, 'addEventListener')
    applyAsChildAttrs(el, { onPointerDownOnce: () => {} })
    expect(spy).toHaveBeenCalledWith('pointer-down', expect.any(Function), { once: true })
  })
})

describe('createAsChildApplier', () => {
  it('keeps nested appliers on the same element independent', () => {
    const el = document.createElement('button')
    const inner = createAsChildApplier()
    const outer = createAsChildApplier()
    inner(el, { role: 'tab', class: 'inner' })
    outer(el, { 'data-reka-collection-item': '', 'class': 'outer', 'role': 'option' })
    inner(el, { 'role': 'tab', 'class': 'inner', 'aria-selected': 'true' })
    expect(el.getAttribute('data-reka-collection-item')).toBe('')
    // the inner (child) layer applied first, so it owns `role`
    expect(el.getAttribute('role')).toBe('tab')
    expect(el.className).toBe('inner outer')
    expect(el.getAttribute('aria-selected')).toBe('true')
  })
})

describe('createAsChildApplier({ override: true })', () => {
  it('lets applied attrs win and restores the element\'s own value afterwards', () => {
    const el = document.createElement('div')
    el.id = 'generated'
    const apply = createAsChildApplier({ override: true })
    apply(el, { id: 'mine' })
    expect(el.id).toBe('mine')
    apply(el, {})
    expect(el.id).toBe('generated')
  })
})

describe('resolveAsChildTarget', () => {
  it('targets the content inside a PopperContent wrapper', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-reka-popper-content-wrapper', '')
    const content = document.createElement('div')
    wrapper.appendChild(content)
    expect(resolveAsChildTarget(wrapper)).toBe(content)
    const plain = document.createElement('div')
    expect(resolveAsChildTarget(plain)).toBe(plain)
  })
})
