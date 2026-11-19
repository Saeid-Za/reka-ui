# reka-ui / Vapor — user guide draft

Draft for a future docs PR (not published with this branch).

## Using `reka-ui/vapor`

Import from the Vapor build entry (see `packages/core/src/vapor.ts` and `DECISIONS.md`). Compile
your app with Vue 3.6+ Vapor mode; use `@reka-ui/vapor-tests` patterns for parity testing.

## Known Vapor differences

| Topic | Notes |
|---|---|
| QS7 SSR first paint | As-child attrs may differ server vs client; some SSR tests stay red on purpose. |
| QS8 listener order | Consumer listeners vs component handlers — see OPEN_QUESTIONS QS8. |
| QS9 `$el` on forwarded refs | Children must `defineExpose({ $el })`; see migration below. |
| QS14 `unmountOnHide` | Combobox hidden-node tests may still fail; Dialog paths fixed via content twins (ADR-S49). |
| QS12 Transitions | Out-in + Suspense under the test bridge may differ from VDOM. |

## `__VUE_OPTIONS_API__: false`

`pnpm test:no-options-api` in `packages/core` matches `pnpm test:run` (3552 pass / 35 skip, 2026-11-19).

## Migration: `useForwardExpose` under Vapor

In Vapor mode, component refs do not expose a synthetic `$el` on the child instance. Components
that Reka forwards refs to must call `defineExpose({ $el })` on their root element when running
as Vapor components. See QS9 in `OPEN_QUESTIONS.md`.
