/**
 * Pure-Vapor stand-in for `@testing-library/vue` (full-suite run only).
 * Same behaviour as the real package (v8), whose `render()` is a thin layer over
 * `@vue/test-utils` `mount()`: here it is layered over the Vapor shim instead.
 * Queries, `waitFor`, `screen` etc. are `@testing-library/dom`, unchanged.
 */
import { fireEvent as domFireEvent, getQueriesForElement, prettyDOM, waitFor } from '@testing-library/dom'
import { afterEach } from 'vitest'
import { mount } from './test-utils'

export * from '@testing-library/dom'

const mountedWrappers = new Set<any>()

/* eslint-disable no-console -- `debug()` prints, like the real package */
export function render(Component: any, { container: customContainer, baseElement: customBaseElement, ...mountOptions }: any = {}) {
  const div = document.createElement('div')
  const baseElement = customBaseElement || customContainer || document.body
  const container = customContainer || baseElement.appendChild(div)
  const wrapper = mount(Component, { ...mountOptions, attachTo: container })
  // VTU (and this shim) mount into an extra div inside `attachTo`; unwrap it like the real package.
  const mountDiv = wrapper.root!.container
  mountDiv.replaceWith(...mountDiv.childNodes)
  wrapper.root!.attached = false
  mountedWrappers.add(wrapper)
  return {
    container,
    baseElement,
    debug: (el: any = baseElement, maxLength?: number, options?: any) =>
      Array.isArray(el) ? el.forEach(e => console.log(prettyDOM(e, maxLength, options))) : console.log(prettyDOM(el, maxLength, options)),
    unmount: () => wrapper.unmount(),
    html: () => wrapper.html(),
    emitted: (name?: string) => wrapper.emitted(name),
    rerender: (props: any) => wrapper.setProps(props),
    ...getQueriesForElement(baseElement),
  }
}

export function cleanup() {
  for (const wrapper of mountedWrappers) {
    const parent = wrapper.element?.parentNode
    if (parent?.parentNode === document.body)
      document.body.removeChild(parent)
    wrapper.unmount()
    mountedWrappers.delete(wrapper)
  }
}

if (typeof afterEach === 'function')
  afterEach(() => cleanup())

async function fireEventImpl(...args: Parameters<typeof domFireEvent>) {
  domFireEvent(...args)
  await waitFor(() => {})
}

export const fireEvent: any = fireEventImpl
for (const key of Object.keys(domFireEvent)) {
  fireEvent[key] = async (...args: any[]) => {
    ;(domFireEvent as any)[key](...args)
    await waitFor(() => {})
  }
}
fireEvent.touch = async (elem: Element) => {
  await fireEvent.focus(elem)
  await fireEvent.blur(elem)
}
fireEvent.update = (elem: any, value: any) => {
  const { tagName, type } = elem
  switch (tagName) {
    case 'OPTION': {
      elem.selected = true
      const select = elem.parentElement.tagName === 'OPTGROUP' ? elem.parentElement.parentElement : elem.parentElement
      return fireEvent.change(select)
    }
    case 'INPUT':
      if (['checkbox', 'radio'].includes(type)) {
        elem.checked = true
        return fireEvent.change(elem)
      }
      if (type === 'file')
        return fireEvent.change(elem)
      elem.value = value
      return fireEvent.input(elem)
    case 'TEXTAREA':
      elem.value = value
      return fireEvent.input(elem)
    case 'SELECT':
      elem.value = value
      return fireEvent.change(elem)
  }
  return null
}
