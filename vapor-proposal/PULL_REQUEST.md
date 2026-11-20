# feat: Vue Vapor support, step 1 (Vapor-safe composables, `reka-ui/vapor`, pure-Vapor build from the same source)

Closes #TBD (Vapor RFC issue).

## Summary

- **Vapor-safe composables.** Reka composables that read the component instance now work when
  they are called from `<script setup vapor>` components. This is opt-in:
  `import 'reka-ui/vapor'`.
- **Vapor twins for the vnode modules.** `Primitive` (including `as-child`), `Slot`, `Presence`
  and `Collection` get Vapor twins, plus a build-time swap plugin. With them, Reka's own SFCs
  compile to Vapor **from the same source** and run with `createVaporApp`. No interop plugin
  and no VDOM renderer are needed.
- **A private Vue 3.6 test workspace** (`packages/vapor`). It runs 48 component families in
  four modes:
  - VDOM baseline;
  - VDOM app + interop;
  - Vapor app + interop;
  - pure Vapor.

  The workspace also has a real-browser benchmark.
- **No public API change, and the VDOM code path is unchanged.**

## Motivation

- **Composables break silently.** `getCurrentInstance()` returns `null` in Vapor components.
  When a user's Vapor component wraps a Reka component:
  - `useForwardProps`, `useForwardPropsEmits` and `useEmitAsProps` silently forward nothing;
  - `useForwardExpose` throws.

  This also happens with `vaporInteropPlugin`.
- **Interop means two runtimes.** Vapor apps that use Reka today ship both runtimes. That costs
  +38.7 KiB gzip on the benchmark app, and it was the slowest mode for Checkbox and Collapsible.

## Changes

**`packages/core`**
- **Instance adapter and opt-in entry.**
  - `shared/instance.ts` provides `getInstance`, `getAssignedPropKeys`, `hasAssignedProp`,
    `getInstanceRootNode`, `findBlockElement` and `exposeRootElement`.
  - The opt-in `reka-ui/vapor` entry (`shared/instance.vapor.ts`) registers a resolver. It is
    the only code that uses Vue 3.6's internal `currentInstance`.
  - `package.json` gets an `./vapor` export. `sideEffects` lists the entry and
    `dist/shared/instance.vapor.*`. A consumer-build test showed the registration was dropped
    without this.
- **Composables moved to the adapter:**
  - `useForwardProps`, `useEmitAsProps`, `useForwardScopeId`, `resolveElement`;
  - `useTriggerId`/`useContentMounted`, `useForwardRef`;
  - `FormRoot`, `TagGroupRoot`, `AutocompleteRoot`, `ComboboxRoot`.
- **`useForwardExpose`:**
  - On the Vapor path it updates `exposed` in place and reads the Vapor child's proxy.
  - The ref callback is write-only. Vapor sets refs inside a render effect, so reading reactive
    state there caused recursive updates.
- **`Primitive.vapor.vue` and `Slot.vapor.vue`.** With `as-child`, attrs are applied to the
  slotted element through `asChildAttrs.ts`:
  - classes and styles merge;
  - listeners chain;
  - the child's own attributes win, as in the VDOM `Slot`;
  - each update is diffed.
- **`Presence.vapor.vue`:**
  - It applies attrs in override mode, so the consumer wins, as with VDOM fallthrough.
  - Attrs go to the element inside the popper wrapper.
  - It waits for content that mounts lazily.
- **Collection.** `collectionCore.ts` is shared by both builds. `Collection.vapor.ts` and the
  `CollectionSlot`/`CollectionItem` Vapor SFCs replace the `h()` parts in the Vapor build.
- The VDOM entry never imports `*.vapor.*` files.

**`packages/vapor`** (new, private, `vue@3.6.0-rc.15`)
- **`rekaVapor.ts`.** `rekaVaporSwap()` swaps in the four modules and also:
  - injects `exposeRootElement()`, because Vapor component refs have no `$el`;
  - rewrites `defineAsyncComponent` to `defineVaporAsyncComponent`;
  - gives VueUse a Vapor-aware `getCurrentInstance`.

  `stripVapor()` builds the VDOM baseline.
- **Test configs:** `vitest.vdom.config.ts`, `vitest.config.ts` (interop) and
  `vitest.native.config.ts` (pure Vapor).
- **Tests:**
  - `test/families.ts`: 48 families, each with an anatomy check and one interaction.
  - `test-native/compile-all.test.ts`: all 414 exports compile as Vapor.
  - `test-vdom/package-side-effects.test.ts`: the consumer-build check against `dist/`.
- **`scripts/coverage.mjs`** prints the per-component coverage table.
- **`bench/`:** Playwright + system Chrome harness, see `vapor-proposal/BENCHMARKS.md`.

**`vapor-proposal/`**: `CHANGES.md` (research, audit, strategy comparison), `DECISIONS.md` (ADR log),
`OPEN_QUESTIONS.md`, `BENCHMARKS.md`, `COVERAGE.table.md` and raw benchmark JSON.

## Testing

| Command | Result |
|---|---|
| `pnpm --filter reka-ui exec vitest run` | 130 files, **3548 passed**, 35 skipped. Before: 128 files, 3533 passed. |
| `pnpm --filter reka-ui type-check` | pass |
| `pnpm --filter reka-ui build-only` | pass. Only `dist/shared/instance.vapor.*` reference `currentInstance`. |
| `eslint` on changed files | clean |
| `pnpm test:vapor`, VDOM baseline | 51 passed |
| `pnpm test:vapor`, interop (both app modes) | 116 passed, 2 expected fail |
| `pnpm test:vapor`, pure Vapor (Options API compiled out) | 60 passed, 1 expected fail (known gap), 1 todo |
| `pnpm --filter ./packages/vapor test:full-suite` (pure Vapor, Reka's full suite) | **3541 passed, 11 failed, 35 skipped** (`--maxWorkers=4`). Branch packaging freeze after FIX_PLAN_7; failures bucketed in `vapor-proposal/triage.md`. |
| `pnpm test:run` (repo VDOM gate) | **3552 passed, 35 skipped** |

**Per-component pure-Vapor coverage: 47/48.** The full table is in `COVERAGE.table.md`. All
families pass in the VDOM baseline and in both interop modes.

**Full-suite status:** 11 known failures remain (owner decisions + a few harness/Vapor-only
fixes). Do not treat this PR text as “all green” until triage is empty; see `triage.md` and
`USER_GUIDE_DRAFT.md` known issues (e.g. QS14 Combobox visibility).

**ListboxVirtualizer** is the only known gap, recorded as `it.fails`. The virtualizers still
clone slot vnodes.

The **expected fail under interop** is the child-attribute precedence. Vue applies `cloneVNode`
extras on Vapor slot content as fallthrough attrs, so the parent wins. Pure Vapor keeps Reka's
semantics.

## Benchmark (Chrome 156, 4x CPU, median of 10 runs; full method and raw numbers in `BENCHMARKS.md`)

**`script` time, ms (VDOM / Vapor app + interop / pure Vapor):**

| Scenario | VDOM | Vapor app + interop | Pure Vapor |
|---|---|---|---|
| Checkbox ×1000, mount | 431.5 | 708.9 | 387.0 |
| Checkbox ×1000, update | 543.2 | 688.9 | 376.0 |
| Collapsible ×500, mount | 240.8 | 454.4 | 398.7 |
| Collapsible ×500, update | 179.5 | 263.6 | 135.3 |
| Tabs ×200, mount | 722.2 | 870.0 | 873.0 |
| Tabs ×200, update | 429.8 | 315.2 | 118.5 |
| Tabs ×200, unmount | 78.6 | 116.2 | 141.5 |

**Bundle, gzip:** VDOM 60.0 KiB, Vapor app + interop 98.7 KiB, pure Vapor 73.9 KiB. The VDOM
renderer is absent from the pure Vapor bundle.

**Heap per instance:** pure Vapor uses 1.38–1.45x the VDOM heap. Mount, unmount and memory in
pure Vapor are the next things to optimise; the Reka-free controls show this overhead is not
Vue's.

**Performance work:** the per-instance overhead was profiled, then reduced one change at a time,
with A/B measurement for each. All six attempts are logged in `PERF_LOG.md`, three of them
reverted. Three changes were kept:

- lazy props in `useForwardExpose`'s Vapor `exposed`;
- fast paths in the as-child applier;
- no redundant `$el` injection.

Pure-Vapor memory per instance went down by 4.4 % for Checkbox, 0.9 % for Collapsible and 2.3 %
for Tabs. Mount time relative to VDOM went from 0.90x to 0.77x for Checkbox and from 1.21x to
1.11x for Tabs. BENCHMARKS §10 has the caveats: the final run shared the machine with another
workload. The rest of the bundle gap comes from Vue's runtime-vapor, not from Reka.

**Round 2** (`PERF_LOG.md`, BENCHMARKS §11) kept three more changes:

- The Vapor half of `useForwardExpose` is registered by `reka-ui/vapor`, so the default
  build no longer carries it.
- `Presence.vapor.vue` uses one watcher instead of two.
- All Vapor `exposed` objects share one Proxy handler.

Pure-Vapor memory per instance is now 6.9% (Checkbox), 2.9% (Collapsible) and 3.8% (Tabs)
below B0, or 1.29–1.39x of VDOM. The default VDOM build is 98 B gzip smaller than before this
branch. Unmount, at 1.1–2.0x of VDOM, is still the largest gap.

## Not in this PR / follow-ups

- **Remaining work in Reka:**
  - Vapor twins for the virtualizers.
  - A published, compiled Vapor build (packaging is an open question for maintainers).
  - A CI job for `packages/vapor`.
  - Docs.
- **Pre-existing interop leak.** It comes from `useForwardExpose` under a Vapor parent (see
  `BENCHMARKS.md` §7). It needs a Vue-only reproduction before it is reported.
- **Untested:** Vapor SSR/hydration (attrs are applied on mount). Functional tests run in jsdom;
  the benchmark runs in real Chrome.
- **Upstream (Vue):**
  - a public generic-instance API;
  - `$el` on Vapor component refs, or slot-root fallthrough in pure Vapor;
  - vuejs/core#16269.
