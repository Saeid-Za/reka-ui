import type { ComponentPublicInstance } from 'vue'
// reference: https://github.com/vuejs/rfcs/issues/258#issuecomment-1068697672
import { isClient } from '@vueuse/shared'
import { computed, onUpdated, ref, triggerRef } from 'vue'
import { getInstance, getInstanceRootNode, isVaporInstance } from './instance'
import { resolveElement } from './resolveElement'

/**
 * Expose this component's props and a forwarded child's public values and root node.
 *
 * `$el` preserves Vue's native root node. For text and comment roots,
 * `currentElement` resolves the first element inside the forwarded child, or `undefined`.
 *
 * @returns An object with `forwardRef`, `currentRef`, and `currentElement`.
 */
export function useForwardExpose<T extends ComponentPublicInstance>() {
  // VDOM or Vapor instance; both carry `props` and a writable `exposed`.
  const instance = getInstance()!
  const isVapor = isVaporInstance(instance)

  const currentRef = ref<Element | T | null>()
  const currentElement = computed(() => resolveCurrentElement())

  // When using as-child with conditional rendering (v-if/v-else), the underlying
  // DOM element ($el) changes but currentRef (component instance) stays the same.
  // Since $el is not reactive, we sync currentElement after DOM updates.
  onUpdated(() => {
    if (currentElement.value !== resolveCurrentElement()) {
      triggerRef(currentRef)
    }
  })

  function resolveCurrentElement() {
    return resolveElement(currentRef.value)
  }

  // Template refs are never set during SSR, so nothing reads `exposed` there.
  // Skip building it to save a getter per prop on every instance.
  if (!isClient) {
    return {
      forwardRef: (ref: Element | T | null) => { currentRef.value = ref },
      currentRef,
      currentElement,
    }
  }

  // Do give us credit if you reference our code :D
  // localExpose should only be assigned once else will create infinite loop
  const localExpose: Record<string, any> | null = Object.assign({}, instance.exposed)
  const ret: Record<string, any> = {}

  if (isVapor) {
    // Vapor: props are read on demand through a Proxy instead of one getter per
    // prop. Enumerating a Vapor props proxy resolves every prop, and the getters
    // cost a closure each, on every instance.
    for (const key in localExpose) {
      Object.defineProperty(ret, key, {
        enumerable: true,
        configurable: true,
        get: () => localExpose![key],
      })
    }
    defineRootElement(ret)
    const props = instance.props as Record<string, any>
    const isProp = (key: string | symbol): key is string => typeof key === 'string' && key in props
    // A Vapor template ref resolves to a proxy over the `exposed` object it
    // first sees and caches it, so `ret` is updated in place instead of being
    // replaced. A Vapor child ref is that proxy itself (no `$`).
    instance.exposed = new Proxy(ret, {
      get: (target, key, receiver) => key in target ? Reflect.get(target, key, receiver) : isProp(key) ? props[key] : undefined,
      has: (target, key) => key in target || isProp(key),
      ownKeys: target => [...new Set([...Object.keys(props), ...Reflect.ownKeys(target)])],
      getOwnPropertyDescriptor: (target, key) => Reflect.getOwnPropertyDescriptor(target, key)
        ?? (isProp(key) ? { enumerable: true, configurable: true, writable: false, value: props[key] } : undefined),
    })

    let forwardedKeys: string[] = []
    // Vapor sets dynamic template refs inside a render effect, so this must
    // only write reactive state: reading `currentRef` here would make that
    // effect depend on what it writes and re-run itself forever.
    let forwarded: Element | T | null = null
    const forwardRef = (ref: Element | T | null) => {
      forwarded = ref && typeof ref === 'object' && '$el' in ref && !ref.$el ? null : ref
      currentRef.value = forwarded
      for (const key of forwardedKeys)
        delete ret[key]
      forwardedKeys = []
      if (!forwarded || forwarded instanceof Element)
        return
      for (const key of Object.keys(forwarded)) {
        if (key === '$el' || key in localExpose! || isProp(key))
          continue
        forwardedKeys.push(key)
        Object.defineProperty(ret, key, {
          enumerable: true,
          configurable: true,
          get: () => {
            const current = currentRef.value
            return current instanceof Element ? undefined : (current as Record<string, any> | null | undefined)?.[key]
          },
        })
      }
    }
    return { forwardRef, currentRef, currentElement }
  }

  // retrieve props for current instance
  for (const key in instance.props) {
    Object.defineProperty(ret, key, {
      enumerable: true,
      configurable: true,
      get: () => instance.props[key],
    })
  }

  // retrieve default exposed value
  if (Object.keys(localExpose).length > 0) {
    for (const key in localExpose) {
      Object.defineProperty(ret, key, {
        enumerable: true,
        configurable: true,
        get: () => localExpose![key],
      })
    }
  }

  defineRootElement(ret)
  instance.exposed = ret

  // Fall back to the root element when no ref is forwarded.
  function defineRootElement(target: Record<string, any>) {
    Object.defineProperty(target, '$el', {
      enumerable: true,
      configurable: true,
      get: () => {
        const ref = currentRef.value
        return ref ? (ref instanceof Element ? ref : ref.$el) : getInstanceRootNode(instance)
      },
    })
  }

  /**
   * Set the forwarded ref and merge the child's exposed values.
   *
   * Null refs and wrapped refs without an element clear forwarded state and the
   * cached element so detached content can be collected.
   *
   * @param ref - The current DOM element, component instance, or null on removal.
   */
  function forwardRef(ref: Element | T | null) {
    // A wrapped null element is still a ref clear.
    currentRef.value = ref && '$el' in ref && !ref.$el ? null : ref

    if (!ref || !currentRef.value) {
      instance.exposed = ret
      // Drop the cached element even if currentElement is no longer read.
      void currentElement.value
      return
    }

    // ref not is Element
    // and `useForwardExpose.test.ts > useForwardRef > should forward plain DOM element ref - 2` Passing in `$el`
    if (!(ref instanceof Element) && !Object.hasOwn(ref, '$el')) {
      // Retrieves the `exposed` data that has not been unwrapped by `vue` from `$.exposed`.
      const childExposed = ref.$.exposed
      const merged = Object.defineProperties({}, Object.getOwnPropertyDescriptors(ret))

      for (const key in childExposed) {
        Object.defineProperty(merged, key, {
          enumerable: true,
          configurable: true,
          get: () => {
            const forwarded = currentRef.value
            return forwarded instanceof Element ? undefined : forwarded?.$?.exposed?.[key]
          },
        })
      }

      instance.exposed = merged
    }
  }

  return { forwardRef, currentRef, currentElement }
}
