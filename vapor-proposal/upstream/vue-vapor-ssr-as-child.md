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

## Proposed Vue issue body (when posting)

**Title:** [Vapor] Pure-Vapor SSR omits as-child / Collection attrs on first paint (Tabs)

**Body sketch:**
- Minimal repro: Vapor Tabs (or Primitive as-child + Collection) `renderToString` vs client mount.
- Expected: server HTML includes `role="tablist"` attrs / collection item attrs matching client.
- Actual: server markup thinner; hydration patches attrs; first paint missing a11y/layout attrs.
- Not #16269: that was VDOM `cloneVNode` on vapor **slot** in interop; this is pure `createVaporSSRApp` / dual-compile SFCs with no VDOM Slot.
- Vue 3.6.0-rc.16 still reproduces.
