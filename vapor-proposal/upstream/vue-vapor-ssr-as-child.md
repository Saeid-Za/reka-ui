# Draft: Vue Vapor SSR — as-child attrs on first paint (QS7)

**Do not post until the owner confirms.** Pure-Vapor path; not the same as interop #16269.

## Symptom

Red test: `Tabs/Tabs.test.ts` — `ssr hydration > keeps the default output when ids do not diverge`.
Native/fixture notes: `vapor-proposal/FULL_SUITE.md` S3.

Under **pure Vapor SSR**, server markup for Tabs (as-child / Collection / RovingFocus chain)
lacks attrs that appear after client hydration (`data-orientation`, `dir`, `tabindex`,
`data-reka-collection-item`, etc.). Hydrated DOM matches; first paint does not.

## Related upstream (interop — fixed)

| Issue / PR | Status | Relation |
|---|---|---|
| [vuejs/core#16269](https://github.com/vuejs/core/issues/16269) | Closed | Interop: VDOM `cloneVNode` extras on vapor **slot** content missing in SSR |
| [vuejs/core#16340](https://github.com/vuejs/core/pull/16340) | Merged; in **3.6.0-rc.16** | Fix for #16269 |
| [vuejs/core#15989](https://github.com/vuejs/core/pull/15989) | Merged (rc.15+) | Client interop fallthrough |

## Recheck on 3.6.0-rc.16 (2026-11-20)

Re-ran Tabs SSR on **rc.16** (now the package pin). **Still red** with the same
class of missing server attrs. So #16340 does **not** clear QS7. Early raw suite on
rc.16 was **3538 / 14 / 35** until Checkbox U1; current gate **3542 / 10 / 35**.

File a Vue issue only with a **minimal pure-Vapor** repro (no Reka `Slot` / VDOM
`cloneVNode`), or keep documenting as a known pure-Vapor SSR difference until Collection /
as-child SSR is understood on the Reka side.
