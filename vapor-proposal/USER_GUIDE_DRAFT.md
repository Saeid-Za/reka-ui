# reka-ui / Vapor — user guide draft

> **PR-ready state.** Final gate (2026-11-20, Asia/Tehran, archive `605cbfc59`, Vue 3.6.0-rc.16):
> pure-Vapor full suite **3559 passed / 1 expected fail / 35 skipped (3595)**, exit 0;
> `pnpm test:run` **3560 passed / 35 skipped (3595)**, exit 0. vue-tsc, build, eslint and the
> twin drift check pass. The one expected failure is QS7 (Tabs SSR, `it.fails` in Vapor only).
> PR branches: see `upstream/` and `/media/saeid/projects/Contribs/PR_READY.md`.
> User-facing text now lives in `docs/content/docs/guides/vapor.md` (PR 2).

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
| QS14 `unmountOnHide` | **Fixed** (`604dea598`): `ComboboxContentImpl` derives `display` from `present` in both modes. |
| QS17 Dialog warnings | **Flaky (H2):** missing title/description `console.warn` tests can pass isolated but red in full suite; not counted among the stable failures (2: QS7, QS9). |
| QS12 Transitions | Suite green via a test-bridge fix (`811de613e`); real compiled-template `<Transition mode="out-in">` around Reka parts is not covered by a dedicated Vapor test yet. |

## `__VUE_OPTIONS_API__: false`

`pnpm test:no-options-api` runs the **probe only** (1 test, QS19); it does not mirror `pnpm test:run`.

## Migration: `useForwardExpose` under Vapor

In Vapor mode, component refs do not expose a synthetic `$el` on the child instance. Components
that Reka forwards refs to must call `defineExpose({ $el })` on their root element when running
as Vapor components. See QS9 in `OPEN_QUESTIONS.md`.
