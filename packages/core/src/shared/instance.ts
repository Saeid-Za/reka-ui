import type { ComponentInternalInstance } from 'vue'
import { camelize, getCurrentInstance } from 'vue'

/**
 * Structural view of the parts of a Vue 3.6 Vapor component instance
 * (`VaporComponentInstance`) that reka-ui reads.
 *
 * Vapor components have no vnode and `getCurrentInstance()` returns `null`
 * inside them by design, so composables that need the instance go through
 * the helpers in this file instead of touching `vnode` directly.
 */
export interface VaporInstanceLike {
  vapor: true
  type: { name?: string, __name?: string, props?: any, emits?: any }
  props: Record<string, any>
  /** Static keys hold getters; `$` holds dynamic `v-bind` sources. */
  rawProps: Record<string, unknown> & { $?: Array<Record<string, unknown> | (() => Record<string, unknown>)> }
  exposed: Record<string, any> | null
  block: unknown
  parent: { type?: { name?: string } } | null
}

export type RekaInstance = ComponentInternalInstance | VaporInstanceLike

let resolveVaporInstance: (() => unknown) | undefined

/**
 * Register how to read the current Vapor instance.
 *
 * Called once by the Vapor entry (`shared/instance.vapor.ts`) so the default
 * VDOM build never references Vue 3.6-only exports.
 *
 * @internal
 */
export function setVaporInstanceResolver(resolver: (() => unknown) | undefined) {
  resolveVaporInstance = resolver
}

export function isVaporInstance(instance: unknown): instance is VaporInstanceLike {
  return !!instance && (instance as VaporInstanceLike).vapor === true
}

/**
 * `getCurrentInstance()` that also works inside Vapor components.
 *
 * The Vapor instance is checked first: while a Vapor component is set up from a
 * VDOM render (interop), `getCurrentInstance()` would otherwise return the
 * VDOM component that is rendering, not the component being set up.
 */
export function getInstance(): RekaInstance | null {
  if (resolveVaporInstance) {
    const vapor = resolveVaporInstance()
    if (isVaporInstance(vapor))
      return vapor
  }
  return getCurrentInstance()
}

/**
 * Raw props (props and attrs) the parent passed to the component, keyed as written.
 * VDOM: `vnode.props`. Vapor: static `rawProps` keys plus dynamic `v-bind` sources.
 */
export function getAssignedPropKeys(instance: RekaInstance | null): string[] {
  if (!instance)
    return []
  if (!isVaporInstance(instance))
    return Object.keys(instance.vnode.props ?? {})

  const raw = instance.rawProps
  if (!raw)
    return []
  const keys = new Set<string>()
  for (const key in raw) {
    if (key !== '$')
      keys.add(key)
  }
  for (const source of raw.$ ?? []) {
    const resolved = typeof source === 'function' ? source() : source
    for (const key in resolved)
      keys.add(key)
  }
  return [...keys]
}

/** Whether the parent passed `key` (e.g. `onFormSubmit`), in any casing. */
export function hasAssignedProp(instance: RekaInstance | null, key: string) {
  const target = camelize(key)
  return getAssignedPropKeys(instance).some(k => camelize(k) === target)
}

/** Component name as shown in warnings. */
export function getInstanceName(instance: { type?: { name?: string, __name?: string } } | null | undefined) {
  return instance?.type?.name ?? instance?.type?.__name
}

/**
 * First DOM element rendered by a Vapor block (element, fragment, component
 * instance or array of those). Fragments are duck-typed by `nodes`, Vapor
 * component instances by `vapor` + `block`.
 */
export function findBlockElement(block: unknown): HTMLElement | undefined {
  if (!block)
    return undefined
  if (typeof Element !== 'undefined' && block instanceof Element)
    return block as HTMLElement
  if (Array.isArray(block)) {
    for (const child of block) {
      const el = findBlockElement(child)
      if (el)
        return el
    }
    return undefined
  }
  if (typeof block === 'object') {
    if (isVaporInstance(block))
      return findBlockElement(block.block)
    if ('nodes' in block)
      return findBlockElement((block as { nodes: unknown }).nodes)
  }
  return undefined
}

const hookedFragments = new WeakMap<object, Set<() => void>>()

/**
 * Calls `callback` after any Vapor fragment on the path to `instance`'s first
 * element renders a different branch (a `v-if`/`v-for`/slot swap), including
 * fragments that render nothing yet. Call it again from `callback`: the path may
 * now run through new fragments. Each (fragment, callback) pair is hooked once.
 *
 * Uses the fragments' update hook list (`u`), which Vue's own Transition and
 * interop code use for the same purpose; it is not public API (OPEN_QUESTIONS QS4).
 *
 * @internal
 */
export function onRootFragmentUpdate(instance: RekaInstance | null, callback: () => void) {
  if (!isVaporInstance(instance))
    return
  const hook = (fragment: { u?: Array<() => void> }) => {
    let callbacks = hookedFragments.get(fragment)
    if (!callbacks)
      hookedFragments.set(fragment, callbacks = new Set())
    if (callbacks.has(callback))
      return
    callbacks.add(callback)
    ;(fragment.u ??= []).push(callback)
  }
  // Same walk as `findBlockElement`, hooking every fragment before the first element.
  const walk = (block: unknown): boolean => {
    if (!block)
      return false
    if (typeof Element !== 'undefined' && block instanceof Element)
      return true
    if (Array.isArray(block))
      return block.some(walk)
    if (typeof block === 'object') {
      if (isVaporInstance(block))
        return walk(block.block)
      if ('nodes' in block) {
        hook(block as { u?: Array<() => void> })
        return walk((block as { nodes: unknown }).nodes)
      }
    }
    return false
  }
  walk(instance.block)
}

/**
 * The node a component renders first: `vnode.el` for VDOM, the first element of
 * the block for Vapor (Vapor blocks have no single root node to point at).
 */
export function getInstanceRootNode(instance: RekaInstance | null): Node | null {
  if (!instance)
    return null
  if (isVaporInstance(instance))
    return findBlockElement(instance.block) ?? null
  return (instance.vnode.el as Node | null) ?? null
}

/**
 * Give the current Vapor component a `$el` on its template ref.
 *
 * A VDOM component ref always has `$el`; a Vapor component ref is a proxy over
 * `exposed` only, and reka-ui resolves elements through component refs in
 * many places. The Vapor build calls this at the end of every reka-ui SFC
 * setup. Components that already expose `$el` keep theirs. No-op in VDOM.
 *
 * @internal
 */
export function exposeRootElement() {
  const instance = getInstance()
  if (!isVaporInstance(instance))
    return
  const exposed = (instance.exposed ??= {})
  if (!Object.getOwnPropertyDescriptor(exposed, '$el')) {
    Object.defineProperty(exposed, '$el', {
      configurable: true,
      get: () => getInstanceRootNode(instance),
    })
  }
}
