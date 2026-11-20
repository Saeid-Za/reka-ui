// @vapor-twin-of useForwardExpose.ts 3516683eaa23
// Vapor half of `useForwardExpose`. Registered by `instance.vapor.ts` (the
// `reka-ui/vapor` entry), so the default build never includes it.
import type { VaporInstanceLike } from './instance'
import { isClient } from '@vueuse/shared'
import { computed, onUpdated, ref, triggerRef } from 'vue'
import { getInstanceRootNode } from './instance'
import { resolveElement } from './resolveElement'

// One Proxy handler for every instance; the instance's props are looked up by
// the proxy target, so no per-instance handler closures are allocated.
const propsOf = new WeakMap<object, Record<string, any>>()
/** The prop key of the instance behind `target`, if `key` is one. */
function propKey(target: object, key: string | symbol) {
  return typeof key === 'string' && key in propsOf.get(target)! ? key : undefined
}
const exposeHandler: ProxyHandler<Record<string, any>> = {
  get: (target, key, receiver) => {
    if (key in target)
      return Reflect.get(target, key, receiver)
    const prop = propKey(target, key)
    return prop && propsOf.get(target)![prop]
  },
  has: (target, key) => key in target || !!propKey(target, key),
  ownKeys: target => [...new Set([...Object.keys(propsOf.get(target)!), ...Reflect.ownKeys(target)])],
  getOwnPropertyDescriptor: (target, key) => Reflect.getOwnPropertyDescriptor(target, key)
    ?? (propKey(target, key) ? { enumerable: true, configurable: true, writable: false, value: propsOf.get(target)![key as string] } : undefined),
}

/**
 * `useForwardExpose` for a Vapor component instance.
 *
 * Props are read on demand through a Proxy instead of one getter per prop:
 * enumerating a Vapor props proxy resolves every prop, and the getters cost a
 * closure each, on every instance. The shared prelude (`currentRef`,
 * `currentElement`, `onUpdated`, SSR) is repeated from `useForwardExpose.ts`
 * so the whole composable keeps one closure scope per instance.
 *
 * @param instance - The current Vapor component instance.
 * @returns An object with `forwardRef`, `currentRef`, and `currentElement`.
 */
export function useVaporForwardExpose(instance: VaporInstanceLike) {
  const currentRef = ref<any>()
  instance.forwarded = currentRef
  const currentElement = computed(() => resolveCurrentElement())

  // See useForwardExpose.ts: $el is not reactive, so sync after DOM updates.
  onUpdated(() => {
    if (currentElement.value !== resolveCurrentElement())
      triggerRef(currentRef)
  })

  function resolveCurrentElement() {
    return resolveElement(currentRef.value)
  }

  if (!isClient) {
    return {
      forwardRef: (ref: any) => { currentRef.value = ref },
      currentRef,
      currentElement,
    }
  }

  const localExpose: Record<string, any> = Object.assign({}, instance.exposed)
  const ret: Record<string, any> = {}
  for (const key in localExpose) {
    Object.defineProperty(ret, key, {
      enumerable: true,
      configurable: true,
      get: () => localExpose[key],
    })
  }
  // Fall back to the root element when no ref is forwarded.
  Object.defineProperty(ret, '$el', {
    enumerable: true,
    configurable: true,
    get: () => {
      const ref = currentRef.value
      return ref ? (ref instanceof Element ? ref : ref.$el) : getInstanceRootNode(instance)
    },
  })
  const props = instance.props as Record<string, any>
  propsOf.set(ret, props)
  // A Vapor template ref resolves to a proxy over the `exposed` object it
  // first sees and caches it, so `ret` is updated in place instead of being
  // replaced. A Vapor child ref is that proxy itself (no `$`).
  instance.exposed = new Proxy(ret, exposeHandler)

  let forwardedKeys: string[] = []
  // Vapor sets dynamic template refs inside a render effect, so this must
  // only write reactive state: reading `currentRef` here would make that
  // effect depend on what it writes and re-run itself forever.
  const forwardRef = (ref: any) => {
    // In Vapor mode, a template ref target may be a plain element ref object `{ $el: null }`
    // (when unmounted or before mounting), or an object with a dynamic property getter for `$el`
    // (e.g. `Primitive.vapor.vue` or custom components with dynamic element resolution).
    // Static `{ $el: null }` is coerced to null so fallback to instance's root element works.
    // Dynamic getters are preserved even if `$el` currently evaluates to null/undefined (such as
    // during empty slot branches), ensuring subsequent DOM insertions are tracked via the getter.
    const isPlainElRef = ref && typeof ref === 'object' && '$el' in ref && !Object.getOwnPropertyDescriptor(ref, '$el')?.get && !ref.$el
    const forwarded = isPlainElRef ? null : ref
    currentRef.value = forwarded
    for (const key of forwardedKeys)
      delete ret[key]
    forwardedKeys = []
    if (!forwarded || forwarded instanceof Element)
      return
    for (const key of Object.keys(forwarded)) {
      if (key === '$el' || key in localExpose || key in props)
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
