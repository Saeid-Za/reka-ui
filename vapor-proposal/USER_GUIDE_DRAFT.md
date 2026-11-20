# reka-ui / Vapor — user guide draft

Draft for a future docs PR (not published with this branch).

## Using `reka-ui/vapor`

Import from the Vapor build entry (see `packages/core/src/vapor.ts` and `DECISIONS.md`). Compile
your app with Vue 3.6+ Vapor mode; use `@reka-ui/vapor-tests` patterns for parity testing.

## Known Vapor differences

| Topic | Notes |
|---|---|
| QS7 SSR first paint | Pure-Vapor as-child/Collection attrs may differ server vs client; Tabs SSR stays red on purpose. Interop cloneVNode SSR was [vuejs/core#16269](https://github.com/vuejs/core/issues/16269) (**fixed** in rc.16 / #16340) — different path; QS7 still fails on rc.16. |
| QS8 listener order | Consumer listeners vs component handlers — see OPEN_QUESTIONS QS8. |
| QS9 `$el` on forwarded refs | **Runtime:** Vapor refs are expose-only (no automatic `$el`). Wrappers must `defineExpose({ $el })`; see migration below. One suite test stays red on purpose. |
| QS14 `unmountOnHide` | **Known issue:** closed persistent Combobox content stays `display: flex` in Vapor (`ComboboxContentImpl` inline style wins over twin). U5 post-flush hide reverted. Dialog paths fixed. |
| QS17 Dialog warnings | **Flaky (H2):** missing title/description `console.warn` tests can pass isolated but red in full suite; not counted among the 11 stable failures. |
| QS12 Transitions | Out-in + Suspense under the test bridge may differ from VDOM. |

## `__VUE_OPTIONS_API__: false`

`pnpm test:no-options-api` runs the **probe only** (1 test, QS19); it does not mirror `pnpm test:run`.

## Migration: `useForwardExpose` under Vapor

In Vapor mode, component refs do not expose a synthetic `$el` on the child instance. Components
that Reka forwards refs to must call `defineExpose({ $el })` on their root element when running
as Vapor components. See QS9 in `OPEN_QUESTIONS.md`.
