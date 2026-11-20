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
