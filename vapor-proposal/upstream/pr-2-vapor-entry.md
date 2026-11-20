# PR 2 of 3 — branch `vapor-pr/2-vapor-entry` → `unovue/reka-ui:v2` (stacked on PR 1)

**Title:** feat: opt-in `reka-ui/vapor` entry and Vapor twins for the vnode-based parts

> Stacked on PR 1. Until PR 1 is merged this PR also shows its 6 commits; review the last 8.

## Summary

- **`import 'reka-ui/vapor'`** (new package export, Vue >= 3.6): registers a resolver for
  Vapor component instances and the Vapor half of `useForwardExpose`. With it,
  `useForwardProps`, `useEmitAsProps`, `useForwardPropsEmits` and `useForwardExpose` work when
  called from `<script setup vapor>` components (today they silently forward nothing, because
  `getCurrentInstance()` is `null` in Vapor by design). Works with `vaporInteropPlugin` and the
  published VDOM build. The default `reka-ui` entry never imports Vue 3.6-only APIs; Vue 3.4 /
  3.5 and tree-shaking are unaffected. `sideEffects` lists the entry and resolver files so
  bundlers keep the registration.
- **Vapor twins** for the only modules that need vnodes: `Primitive`, `Slot`, `Presence`,
  `Collection` (`*.vapor.vue` / `*.vapor.ts`), plus `DialogContent` (`v-show` on a
  component). The as-child DOM applier (`Primitive/asChildAttrs.ts`) applies attrs, classes,
  styles and listeners to the rendered element, letting attrs the child binds itself win (VDOM
  `mergeProps` precedence). Nothing in the VDOM build imports them; they are used when Reka's
  source is compiled as Vapor (PR 3's test package does this).
- **No `isVapor` branches in shared sources.** Where timing differs, the difference is a tiny
  swapped module: `FocusScope/stackTiming(.vapor).ts` (when a scope joins the focus stack) and
  `shared/triggerIdSync(.vapor).ts` (following a re-rendered trigger id).
- **Twin drift check:** each twin carries `// @vapor-twin-of <original> <sha12>`;
  `pnpm --filter reka-ui check:vapor-twins` runs in the build workflow and fails when an
  original changes until the twin is reviewed (`--update`). Rule documented in CONTRIBUTING.
- **Docs:** new guide `docs/content/docs/guides/vapor.md` (setup, `$el` migration note for
  template refs, known differences).

8 commits, 29 files, +1393 / −65.

## Test evidence (local, 2026-11-20)

| Check | Result |
|---|---|
| `pnpm --filter reka-ui build` (vue-tsc + tsdown + postbuild) | pass; `dist/vapor.js` 211 B, `dist/shared/instance.vapor.js` 420 B |
| `pnpm --filter reka-ui check:vapor-twins` | pass (11 twins) |
| `eslint .` | pass |
| `vitest run` (jsdom, VDOM) | **3558 passed, 35 skipped** (base 3533) |

The Vapor side of these files is exercised by PR 3 (pure-Vapor run of the whole suite).

PERF_SECTION

## Known issues

- Pure-Vapor SSR: as-child attrs reach the element on the client only, so the first paint of
  server-rendered markup lacks them until hydration (Tabs SSR test is an expected failure in
  the Vapor run). Needs a Vue API; issue text prepared.
- Refs to Vapor components expose only what `defineExpose()` returns (no `$el`). Documented
  in the guide.
- Relies on Vue's internal `currentInstance` export (Vue >= 3.6) inside the opt-in entry only,
  until Vue offers a public API (vuejs/core#16305).

## Breaking changes

None. New export `reka-ui/vapor`; `sideEffects` changes from `false` to a list of the Vapor
entry/resolver files.
