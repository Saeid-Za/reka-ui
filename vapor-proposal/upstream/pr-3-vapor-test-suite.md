# PR 3 of 3 — branch `vapor-pr/3-vapor-test-suite` → `unovue/reka-ui:v2` (stacked on PR 2)

**Title:** test: isolated Vue 3.6 Vapor test package and a pure-Vapor run of the full suite

> Stacked on PR 2. Until PRs 1 and 2 are merged this PR shows their commits too; review the
> last 3.

## Summary

- **`packages/vapor`** (private `@reka-ui/vapor-tests`, never published). It pins
  `vue@3.6.0-rc.16` **for itself only** (needed for `createVaporApp`, Vapor SSR and the rc.16
  interop fixes); `packages/core` keeps its Vue range. It contains:
  - 48 fixture families run in VDOM, `vdom-app + interop`, `vapor-app + interop` and pure Vapor;
  - **`test:full-suite`**: Reka's own `packages/core/src/**/*.test.ts`, unchanged in intent,
    compiled as pure Vapor (`createVaporApp`, no interop) through a Vite plugin that swaps in
    the `*.vapor.*` twins, with VTU / Testing Library adapters and a render-function bridge for
    tests written with `h()`;
  - a benchmark harness (`bench/run.mjs`, real Chrome via playwright-core).
- Existing tests become mode-aware only where VDOM and Vapor legitimately differ (comment
  anchors in markup, SSR module resets, the Vue SSR gap). VDOM assertions are unchanged.
- `test:no-options-api` probe; root `pnpm test:vapor`.

3 commits, 167 files, +7168 / −183 (+6955 / −50 without the lockfile).

## Test evidence (local, 2026-11-20)

| Check | Result |
|---|---|
| `pnpm --filter reka-ui build`, `check:vapor-twins`, `eslint .` | pass |
| `vitest run` (jsdom, VDOM) | **3560 passed, 35 skipped** (base 3533) |
| Pure-Vapor full suite (`test:full-suite`) | **3559 passed, 1 expected fail, 35 skipped** (3595) |
| `test:vdom` (fixtures, VDOM baseline) | 56 passed |
| `test:interop` (both interop modes) | 116 passed, 2 expected fail |
| `test:vapor-only` (fixtures, pure Vapor) | 70 passed, 1 todo |
| `test:no-options-api` | 1 passed |

Expected failures, each with the reason in the test:
- Vapor full suite: Tabs SSR "keeps the default output when ids do not diverge" — pure-Vapor
  SSR cannot fall attrs through to a slot's root yet (Vue feature request prepared).
- Interop: the as-child attr precedence divergence under `vaporInteropPlugin` (Vue applies
  Reka's attrs as fallthrough, so the parent wins over the child's own attrs).

PERF_SECTION

## Known issues

- Lockfile: pnpm resolves the peer `@vue/compiler-dom` of root-level tooling
  (`@vue/test-utils`, `@testing-library/vue`, `@antfu/eslint-config`) to the rc.16 copy
  brought in by `packages/vapor`. A clean `pnpm install --lockfile-only` from `v2` produces the
  same entries; core's `vue` stays 3.5.44 and the VDOM suite is unchanged. If maintainers
  prefer, the package can move out of the workspace or use `dedupe-peer-dependents=false`.
- Not wired into CI yet (it needs a Vue prerelease); run with `pnpm test:vapor` /
  `pnpm --filter @reka-ui/vapor-tests test:full-suite`.

## Breaking changes

None (test-only package and test changes).
