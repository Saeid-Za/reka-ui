# Vue issue: Vapor SSR — as-child / Collection attrs on first paint (QS7)

Status: background notes first, then a **ready-to-paste** feature request at the end. Not filed.
Verification level: the gap itself is shown by Reka's Tabs SSR test on rc.16 (re-run
2026-11-20, still an expected failure). The `AsChild`/`App` snippet below illustrates the
missing API; it was **not** run as a standalone `renderToString` repro, and the "nested
`_slotAttrs` is `undefined`" detail was observed inside Reka's build. Build a standalone
StackBlitz/SFC-playground repro before filing if Vue asks for one.
In Reka the affected test is marked `it.fails` in Vapor only (Tabs SSR).

 Pure-Vapor path; not the same as interop #16269.
Owner (2026-11-20): accept known first-paint gap **and** file a pure-Vapor repro upstream.

## Symptom

Red test: `Tabs/Tabs.test.ts` — `ssr hydration > keeps the default output when ids do not diverge`.

Under **pure Vapor SSR**, server markup for Tabs (as-child / Collection / RovingFocus) lacks
attrs that appear after client hydration (`data-orientation`, `dir`, `tabindex`,
`data-reka-collection-item`, etc.). Hydrated DOM matches; first paint does not.

## Related upstream (interop — fixed; different path)

| Issue / PR | Status | Relation |
|---|---|---|
| [vuejs/core#16269](https://github.com/vuejs/core/issues/16269) | Closed | Interop: VDOM `cloneVNode` extras on vapor **slot** content |
| [vuejs/core#16340](https://github.com/vuejs/core/pull/16340) | Merged; in **3.6.0-rc.16** | Fix for #16269 |
| [vuejs/core#15989](https://github.com/vuejs/core/pull/15989) | Merged (rc.15+) | Client interop fallthrough |

## Recheck on 3.6.0-rc.16

Tabs SSR still **FAIL** on the package pin. #16340 does **not** clear QS7.

## Root cause (2026-11-20 attempt)

Parent attrs are available: `asChildSsrAttrs()` / `ssrRenderSlotInner`’s 9th `slotAttrs`
argument return the expected maps (`tabindex`, `data-reka-collection-item`, roving attrs).
Compiled nested `_slotAttrs ? _mergeProps(...)` sites still receive **`undefined`
`_slotAttrs`** under string-buffer pure-Vapor SSR slots. Reka codegen patches
(Primitive as-child → `ssrRenderSlotInner`, nested `_ssrRenderSlot` forwarding) are
insufficient. Gap is Vue’s pure-Vapor SSR **slotAttrs → child** propagation, not
missing parent data. #16269/#16340 remain interop-only.

Reka-side workaround without Vue: SSR twins that avoid nested `as-child` (bind attrs on
non-as-child Primitive / flat Collection·RovingFocus for server only).

## Proposed Vue issue body (when posting)

**Title:** [Vapor] Pure-Vapor SSR drops slotAttrs on nested string-buffer slots (as-child)

**Body sketch:**
- Minimal repro: Vapor `Primitive as-child` (or Tabs Collection/RovingFocus chain)
  `renderToString` vs client mount; parent passes non-empty `slotAttrs` as 9th arg to
  `ssrRenderSlotInner`.
- Expected: nested `_slotAttrs` merges into child SSR markup (`tabindex`, collection attrs).
- Actual: `_slotAttrs` is `undefined` in compiled child paths; server HTML thinner;
  hydration patches attrs; first paint missing a11y/layout attrs.
- Not #16269: that was VDOM `cloneVNode` on vapor **slot** in interop; this is pure
  `createVaporSSRApp` / dual-compile SFCs with string-buffer slots.
- Vue 3.6.0-rc.16 still reproduces.

## Minimal pure-Vapor repro (no Reka)

```vue
<!-- AsChild.vue (Vapor) -->
<script setup vapor>
defineOptions({ inheritAttrs: false })
</script>

<template>
  <slot />
</template>
```

```vue
<!-- App.vue (Vapor) -->
<script setup vapor>
import AsChild from './AsChild.vue'
</script>

<template>
  <AsChild data-x="1" tabindex="-1">
    <button>hi</button>
  </AsChild>
</template>
```

- VDOM: a render-function `AsChild` does `cloneVNode(slot()[0], attrs)`; SSR and client both
  emit `<button data-x="1" tabindex="-1">`.
- Pure Vapor: there is no public way for `AsChild` to fall `$attrs` through to the element its
  slot renders. Libraries apply attrs to the DOM after mount (client only), so
  `createVaporSSRApp` + `renderToString` emits a bare `<button>hi</button>` and first paint
  lacks a11y/roving attrs.
- Ask: a supported "fallthrough attrs to slot root" for Vapor (e.g. honour `v-bind="$attrs"` on
  `<slot>` as fallthrough onto a single-root slot, client + SSR + hydration), with VDOM
  `mergeProps(attrs, child.props)` precedence (child-bound keys win, even when `false`).
- A server-side string merge was prototyped in Reka and is not viable: it cannot see
  child-bound falsy keys and produces hydration mismatches (Rating).


---

## Ready to paste (vuejs/core, Feature request)

**Title:** [Vapor] Fall through attrs to a slot's single root element, including SSR

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
