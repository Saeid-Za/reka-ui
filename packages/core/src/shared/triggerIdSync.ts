import type { ComponentInternalInstance, Ref } from 'vue'
import type { RekaInstance } from './instance'

// Mode-specific halves of `useTriggerId` / `useContentMounted`. Swapped for
// `triggerIdSync.vapor.ts` in the Vapor build (packages/vapor/rekaVapor.ts).

export interface TriggerIdSync {
  attrs: Record<string, unknown>
  element: Readonly<Ref<HTMLElement | undefined>>
  syncConsumerId: () => void
  syncRendered: () => void
}

/**
 * Follows id changes that reach the element without an update of the caller.
 * VDOM: a fallthrough `id` change updates the caller, so the `onBeforeUpdate` /
 * `onUpdated` hooks in `useTriggerId` already cover it.
 */
export function followRenderedId(_sync: TriggerIdSync) {}

/** Renders the caller again, so a template ref to an `as-child` element resolves anew. */
export function forceRerender(instance: RekaInstance) {
  (instance as ComponentInternalInstance).proxy?.$forceUpdate()
}
