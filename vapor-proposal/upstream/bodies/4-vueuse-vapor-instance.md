**Describe the bug**

In Vue 3.6 Vapor components (`<script setup vapor>`), `getCurrentInstance()` returns `null`
by design. Several VueUse helpers use it to decide whether they run inside a component:

- `useMounted()` registers `onMounted` only when `getCurrentInstance()` is truthy, so in a
  Vapor component it never becomes `true`. `useSupported()` builds on it, so its computed is
  never re-evaluated after mount.
- `tryOnMounted(fn)` (via `getLifeCycleTarget`) sees no instance and calls `fn()` right
  away during setup, before anything is mounted. `useParentElement()` relies on it and reads
  the parent before the element is in the DOM.
- `useCurrentElement()` reads `getCurrentInstance().proxy.$el`; in a Vapor component the
  instance is `null`, so evaluating it throws.

`onMounted`, `onUpdated` and friends do work in Vapor components; only the
`getCurrentInstance()` check fails.

**Reproduction**

```vue
<script setup vapor>
import { useMounted } from '@vueuse/core'
import { onMounted } from 'vue'

const mounted = useMounted()
onMounted(() => setTimeout(() => console.log('useMounted:', mounted.value)))
</script>

<template>
  <span>hi</span>
</template>
```

Mount with `createVaporApp(App).mount('#app')`: it logs `false`. Without `vapor` (and
`createApp`) it logs `true`. The other two follow from the same check in the source
(`packages/shared/tryOnMounted`, `packages/core/useCurrentElement`).

**System info**

vue 3.6.0-rc.16, @vueuse/core 14.1.0 (same code in 15.0.0).

**Additional context**

Vue exposes the current Vapor instance internally (`currentInstance`), but not through
`getCurrentInstance()`; see vuejs/core#16305. Until there is a public API, one option is to
treat "inside setup" as "can register lifecycle hooks": e.g. register `onMounted` without the
instance check and catch the dev warning, or accept an explicit target. Reka UI currently
works around this by giving VueUse a `getCurrentInstance` that also returns the Vapor instance
in its Vapor test build.
