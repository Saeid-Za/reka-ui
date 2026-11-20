---
title: Vue Vapor mode
description: Use Reka UI in applications that use Vue 3.6 Vapor mode.
---

# Vue Vapor mode

<Description>
Use Reka UI in applications that use Vue 3.6 Vapor mode.
</Description>

::: warning Experimental
Vapor mode is new in Vue 3.6. This support is experimental and may change in a minor release.
:::

## Setup

Reka UI ships compiled VDOM components. A Vapor application renders them through Vue's
interop plugin, and the `reka-ui/vapor` entry lets Reka's composables work inside your own
Vapor components.

```ts
// main.ts
import { createVaporApp, vaporInteropPlugin } from 'vue'
import App from './App.vue'
import 'reka-ui/vapor'

createVaporApp(App).use(vaporInteropPlugin).mount('#app')
```

Import `reka-ui/vapor` once, before your components run. Without it, composables that read the
current component instance (`useForwardProps`, `useEmitAsProps`, `useForwardPropsEmits`,
`useForwardExpose`) return nothing when they are called from a `<script setup vapor>`
component, because `getCurrentInstance()` is `null` there.

The default `reka-ui` entry does not change: it does not import any Vue 3.6 API and still
supports Vue 3.4 and 3.5.

## Template refs and `$el`

A ref to a Vapor component only exposes what that component passes to `defineExpose()`. Vue
does not add `$el` for you. If you wrap a Reka part in a Vapor component and need its element
from the outside, either call `useForwardExpose()` in the wrapper (with `reka-ui/vapor`
imported) or expose it yourself:

```vue
<script setup vapor lang="ts">
import { ref } from 'vue'

const root = ref<HTMLElement>()
defineExpose({ $el: root })
</script>

<template>
  <div ref="root">
    <slot />
  </div>
</template>
```

## Known differences

- With `as-child`, when a Vapor component passes the same attribute as the Reka part, the
  interop layer applies them in a different order than VDOM does. Prefer setting an attribute
  in one place.
- Server rendering of Reka parts inside Vapor components follows Vue's interop SSR support.
