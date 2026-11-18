// Vapor half of `useForwardExpose`. Registered by `instance.vapor.ts` (the
// `reka-ui/vapor` entry), so the default build never includes it.
import type { VaporInstanceLike } from './instance'
import { isClient } from '@vueuse/shared'
import { computed, onUpdated, ref, triggerRef } from 'vue'
import { getInstanceRootNode } from './instance'
import { resolveElement } from './resolveElement'

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
  const forwardRef = (ref: any) => {
    const forwarded = ref && typeof ref === 'object' && '$el' in ref && !ref.$el ? null : ref
    currentRef.value = forwarded
    for (const key of forwardedKeys)
      delete ret[key]
    forwardedKeys = []
    if (!forwarded || forwarded instanceof Element)
      return
    for (const key of Object.keys(forwarded)) {
      if (key === '$el' || key in localExpose || isProp(key))
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
