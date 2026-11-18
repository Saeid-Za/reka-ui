import { describe, expect, it, vi } from 'vitest'
import { applyAsChildAttrs } from './asChildAttrs'

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
