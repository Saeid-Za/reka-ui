**What problem does this feature solve?**

Headless libraries (Reka UI, Radix-Vue derivatives, Ark UI) implement `as-child`: a wrapper
component renders no element of its own and gives its attrs, classes, styles and listeners
to the single element its default slot renders. In VDOM this is
`cloneVNode(slots.default()[0], attrs)`, and it works the same on the server and the client.

Vapor has no vnodes, so a Vapor `as-child` component can only apply attrs to the rendered
element after mount. That works on the client, but `createVaporSSRApp` + `renderToString`
emits the slot content without them, so first paint lacks `tabindex`, `aria-*` and
`data-*` attributes until hydration patches them in.

Minimal shape (vue 3.6.0-rc.16):

```vue
<!-- AsChild.vue -->
<script setup vapor>
defineOptions({ inheritAttrs: false })
</script>

<template>
  <slot />
</template>
```

```vue
<!-- App.vue -->
<script setup vapor>
import AsChild from './AsChild.vue'
</script>

<template>
  <AsChild data-x="1" tabindex="-1">
    <button>hi</button>
  </AsChild>
</template>
```

Wanted on server and client: `<button data-x="1" tabindex="-1">hi</button>`. There is no
public Vapor API for `AsChild` to get there.

In Reka's pure-Vapor build the parent attrs do reach the compiled SSR slot call (as the
`slotAttrs` argument of `ssrRenderSlotInner`), but nested compiled slots receive `undefined`
for it, so the attrs never reach the element. A string-level merge on the server is not a fix:
it cannot see keys the child binds itself (including falsy ones) and causes hydration
mismatches.

**What does the proposed API look like?**

For example: honour `v-bind="$attrs"` (or a dedicated directive/option) on `<slot>` as
fallthrough onto the slot content's single root element, on the client, in SSR and during
hydration, with VDOM's precedence (`mergeProps(attrs, child.props)`: keys the child binds win,
even when `false`).

Related, but a different path: #16269 / #16340 fixed the interop case (VDOM `cloneVNode` on a
Vapor slot vnode). This request is about pure Vapor (`createVaporApp` / `createVaporSSRApp`).
