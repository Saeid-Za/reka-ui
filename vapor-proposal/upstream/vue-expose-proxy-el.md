# Vue issue: `$el` on a ref to a Vapor component that exposes nothing

Status: ready to paste. Reproduced on vue 3.6.0-rc.16 (2026-11-20), and again on a second machine the same day (Vapor: keys `[]`, `$el` `null`; VDOM: keys `[]`, `$el` `SPAN`). Not filed.
Repo: https://github.com/vuejs/core/issues/new/choose (Bug report). Search first for
"vapor template ref $el"; on 2026-11-20 the closest were #14242 (interop template ref
undefined, closed) and #16305 (getCurrentInstance in Vapor, open feature request).

Note: Reka's own test suite no longer depends on this (the earlier failure was in our test
bridge). It is still a migration difference users will hit, so it is worth a question to Vue.

---

**Title:** [Vapor] template ref to a Vapor component has no `$el`

**Vue version:** 3.6.0-rc.16

**Steps to reproduce**

```vue
<!-- Child.vue -->
<script setup vapor>
</script>

<template>
  <span class="child">child</span>
</template>
```

```vue
<!-- Parent.vue -->
<script setup vapor>
import { onMounted, ref } from 'vue'
import Child from './Child.vue'

const child = ref()
onMounted(() => {
  console.log(child.value, Object.keys(child.value), child.value.$el)
})
</script>

<template>
  <Child ref="child" />
</template>
```

Mount `Parent` with `createVaporApp(Parent).mount('#app')`.

**What is expected?**

The same as VDOM (the same two SFCs without `vapor`, mounted with `createApp`):
`child.value.$el` is the `<span>`.

**What is actually happening?**

`child.value` is an empty object (no own keys) and `child.value.$el` is `undefined`.

Results from running both builds of the same SFCs in jsdom:

| Build | `!!child.value` | keys | `$el` |
|---|---|---|---|
| VDOM (`createApp`) | true | `[]` | `SPAN` |
| Vapor (`createVaporApp`) | true | `[]` | `null` / `undefined` |

**Any additional comments?**

If this is by design (Vapor refs only expose what `defineExpose()` returns), could the docs
say so in the Vapor migration notes? Libraries that forward refs (Reka UI's
`useForwardExpose`, and similar helpers in other headless libraries) read `$el` from child
component refs, and the workaround is for every wrapper to `defineExpose({ $el })`. A public
way to get a Vapor component's root element from its ref would also work.
