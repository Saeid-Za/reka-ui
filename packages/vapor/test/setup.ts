import { beforeAll, vi } from 'vitest'
import '@/vapor'

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

// `import '@/vapor'` above is what an app on Vue 3.6 does once in main.ts: `import 'reka-ui/vapor'`.
// Needed for reka-ui composables called from `<script setup vapor>` components.
