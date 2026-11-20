# Draft: Vue Vapor SSR — as-child / Collection attrs on first paint (QS7)

**Do not post until the owner confirms.** Pure-Vapor path; not the same as interop #16269.
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
