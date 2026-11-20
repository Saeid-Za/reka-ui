# Pure-Vapor full-suite triage (Vue rc.16)

> **PR-ready state.** Final gate (2026-11-20, Asia/Tehran, archive `605cbfc59`, Vue 3.6.0-rc.16):
> pure-Vapor full suite **3559 passed / 1 expected fail / 35 skipped (3595)**, exit 0;
> `pnpm test:run` **3560 passed / 35 skipped (3595)**, exit 0. vue-tsc, build, eslint and the
> twin drift check pass. The one expected failure is QS7 (Tabs SSR, `it.fails` in Vapor only).
> PR branches: see `upstream/` and `/media/saeid/projects/Contribs/PR_READY.md`.

Gate (2026-11-20, Asia/Tehran, post-audit): **3550 pass / 2 fail / 35 skip**
(`pnpm exec vitest run -c vitest.suite.config.ts --maxWorkers=4` in `packages/vapor`).
`pnpm test:run`: **3552 pass / 35 skip**. Vue **3.6.0-rc.16**.

## Flaky when green (QS17)

| File | Notes |
|---|---|
| `Dialog/Dialog.test.ts` — missing title/description `console.warn` ×2 | **flaky (QS17)** — green in all 4 full runs today; order-dependent at G1. |

## Fixed (FIX_PLAN_8 + audit)

| Item | Commit |
|---|---|
| Checkbox story (rc.16 false defaults) | `374fa886a` |
| TagGroup empty tabindex | `ee148a24c` (see MAINTAINABILITY_AUDIT §1: move to applier) |
| QS14 Combobox persistent hide | `604dea598`; redundant twin dropped `b879aea7a` |
| QS15 FocusScope Combobox-in-Dialog | `129abab66` |
| QS16 Combobox searchTerm on close | `456194c50` |
| 9.2 AlertDialog cancel registration | harness `95ac01a00`/`f0ddd2351` vaporH match; product change reverted `e6f798f89` |
| 9.4 Popover SSR hydrate | `c83598fc2` |
| Listbox reactive fallthrough | `0ed4724d2` + `95ac01a00`; getter regression fixed `ae9c10ec1` |
| QS12 Slider out-in ×2 | `811de613e` (harness bridge only) |

Note: before `ae9c10ec1` the full suite showed **3547 / 5**, with ColorSwatchPicker ×1 and
Combobox highlight scrolling ×2 red. They were not order-dependent: the ListboxItem twin
applied Vapor rawProps getters (`() => _ctx.value`) as attribute values.

## Remaining failures (2)

| File | Bucket | Reason | Stance |
|---|---|---|---|
| `Tabs/Tabs.test.ts` — SSR hydration default output | **QS7** | Vapor `Primitive` as-child applies attrs to the slot's element only on the client (DOM applier); pure-Vapor SSR has no API to fall attrs through to a slot root, so server markup lacks RovingFocus/Collection attrs. Path B attempted and reverted (OPEN_QUESTIONS QS7). | Accept + upstream (`upstream/vue-vapor-ssr-as-child.md`) |
| `shared/useForwardExpose.test.ts` — release forwarded child | **QS9** | Vapor component refs are the expose proxy; a child exposing nothing has no `$el`. | A+C: manual `defineExpose({ $el })`; leave red |
