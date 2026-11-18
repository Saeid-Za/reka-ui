import { beforeAll, vi } from 'vitest'
import '@/vapor'

const hasDom = typeof window !== 'undefined'

beforeAll(() => {
  if (hasDom)
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

// `import '@/vapor'` above is what an app on Vue 3.6 does once in main.ts: `import 'reka-ui/vapor'`.
// Needed for reka-ui composables called from `<script setup vapor>` components.

// The packaging check runs in the node environment, without a DOM.
if (hasDom) {
  // jsdom has no ResizeObserver (core tests stub it per file as well).
  globalThis.ResizeObserver ??= class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver

  // jsdom lacks pointer capture (Select, Slider).
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  // jsdom lacks element scrolling (virtualizers).
  Element.prototype.scrollTo ??= (() => {}) as Element['scrollTo']
}
