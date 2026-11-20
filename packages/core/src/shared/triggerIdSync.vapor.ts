import type { TriggerIdSync } from './triggerIdSync'
import { nextTick, watch } from 'vue'

// Vapor half of `triggerIdSync.ts`.

/**
 * A Vapor component has no update of its own when only a fallthrough attribute changes:
 * the attribute is patched onto the element by the child that renders it, so
 * `onBeforeUpdate`/`onUpdated` never run for it. Vapor attrs are reactive, so watch them.
 */
export function followRenderedId({ attrs, element, syncConsumerId, syncRendered }: TriggerIdSync) {
  // The new consumer id reaches the element only when the component re-renders for
  // the context change, so the rendered id is read after that render.
  watch(() => attrs.id, () => {
    syncConsumerId()
    nextTick(syncRendered)
  }, { flush: 'post' })
  // An ancestor that applies attrs to the element by hand (the Vapor Presence and
  // as-child Primitive, which cannot fall attrs through a slot) writes the consumer
  // id straight onto the element, after this component mounted and without an
  // update here. Follow the element's `id` attribute itself.
  if (typeof MutationObserver !== 'undefined') {
    watch(element, (el, _, onCleanup) => {
      if (!el)
        return
      const observer = new MutationObserver(syncRendered)
      observer.observe(el, { attributes: true, attributeFilter: ['id'] })
      onCleanup(() => observer.disconnect())
    }, { immediate: true, flush: 'post' })
  }
}

/**
 * Vapor has no re-render to force: an `as-child` Primitive updates its `$el` itself
 * when the slot swaps the element, which updates the caller's element ref.
 */
export function forceRerender(_instance: unknown) {}
