> Stacked on PR 2. Until PRs 1 and 2 are merged this PR shows their commits too; review the
> last 3.

### 🔗 Linked issue

RFC: #RFC (answers #2721). Stacked on PR 2. Expected failure tracked in VUE_SSR_URL.

### ❓ Type of change

- [ ] 📖 Documentation (updates to the documentation, readme or JSdoc annotations)
- [ ] 🐞 Bug fix (a non-breaking change that fixes an issue)
- [ ] 👌 Enhancement (improving an existing functionality like performance)
- [ ] ✨ New feature (a non-breaking change that adds functionality)
- [x] 🧹 Chore (updates to the build process or auxiliary tools and libraries)
- [ ] ⚠️ Breaking change (fix or feature that would cause existing functionality to change)

### 📚 Description

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
  SSR cannot fall attrs through to a slot's root yet (VUE_SSR_URL).
- Interop: the as-child attr precedence divergence under `vaporInteropPlugin` (Vue applies
  Reka's attrs as fallthrough, so the parent wins over the child's own attrs).

## Performance

Chrome 155, 4× CPU throttle, 10 runs + 3 warm-up per scenario, 2 passes in reversed order on a quiet
i7-12700H (`packages/vapor/bench/run.mjs`). *before* = this work before its final cleanup round, on Vue 3.6.0-rc.15; *now* = this stack, on
rc.16; script-time medians. Both columns are this branch's code, so the VDOM column shows the cleanup
round did not regress VDOM; it is not a comparison with upstream `v2` (the bench lives in PR 3's package). Full table and method: `vapor-proposal/PERF_RESULTS_LOCAL.md` on the
author's archive branch (available on request).

| Scenario | VDOM before → now | Vapor before → now |
|---|---|---|
| checkbox ×1000 mount | 389 → 383 ms (noise) | 288 → 244 ms (−15 %) |
| collapsible mount | 156 → 151 ms (noise) | 325 → 235 ms (−28 %) |
| tabs mount | 470 → 471 ms (noise) | 637 → 570 ms (−11 %) |
| checkbox ×1000 update | 329 → 316 ms (noise) | 325 → 253 ms (−22 %) |
| listbox (virtual) scroll | 257 → 248 ms (noise) | 264 → 250 ms (noise) |
| residual heap after unmounting 1000 checkboxes | 554 → 555 KB (noise) | 471 → 341 KB (−28 %) |
| bundle, gzip | 70.85 → 70.99 KB (+0.2 %) | 85.68 → 87.90 KB (+2.6 %) |

- **No VDOM regression across this round.** Every VDOM timing is within noise (or faster); the VDOM bundle grows by 139 B gzip.
- The Vapor gains and the Vapor/interop bundle growth come from the Vue rc.15 → rc.16 bump; measured
  against an rc.16-only build, this stack's own code is neutral (within noise) except tabs mount (+7 %) and
  a small residual-heap increase (+4 %).

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

### 📝 Checklist

- [x] I have linked an issue or discussion.
- [ ] I have updated the documentation accordingly. (No user-facing change in this PR.)
