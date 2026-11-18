# Decisions (ADR log)

Every decision taken in the local prototype (branch `feat/vapor-support`, base
`a9873a0`, Vue 3.6.0-rc.15), in ADR form. ADR-001 to ADR-011 were backfilled on
2026-11-18 from decisions made earlier in the work; the rest were recorded as they
were taken. Questions that belong to the Reka maintainers are in `OPEN_QUESTIONS.md`.
Where an ADR depends on one of them, it says so, and the default it uses is provisional.

Status values: **Accepted** (implemented and tested), **Provisional** (implemented
as a default, pending a maintainer decision), **Deferred** (deliberately not done in
this PR).

---

## ADR-001 Migration strategy: single source, dual compile, small swap layer

- **Status:** Accepted (backfilled)
- **Context:** Seven strategies were scored (see `CHANGES.md` §4) on five criteria:
  maintainer acceptability, backwards compatibility, maintenance cost, bundle/perf
  and DX. The audit found that only `Primitive.ts`, `Slot.ts`, `Presence.ts`,
  `Collection.ts` and the three virtualizers use vnode APIs.
- **Decision:** Strategy C. Reka's SFCs stay the only source. The default build is
  unchanged (VDOM). A second compile of the same source in Vapor mode produces the
  pure-Vapor build. Only vnode modules get a Vapor twin, swapped in at build time.
- **Consequences:**
  - The public API and the VDOM output are unchanged.
  - The Vapor twins (`*.vapor.vue`, `Collection.vapor.ts`) must be kept in sync with
    their VDOM counterparts. Tests in four modes guard this (ADR-012).
- **Alternatives:**
  - A, interop only (18/25): Vapor apps keep the VDOM runtime.
  - B, interop plus Vapor-safe composables (20/25): a subset of C, kept as C's first
    slice.
  - D, hand-written parallel components (15/25): about 245 duplicated components.
  - E, a Zag-style rewrite (12/25): breaking.
  - F, builders (15/25): breaking as a replacement. Kept as a possible additive
    escape hatch.
  - G, the vuetify0 instance shim (17/25): relies on an SSR-build global.

## ADR-002 The default `reka-ui` entry never touches Vue 3.6 internals; Vapor support is opt-in

- **Status:** Accepted (backfilled)
- **Context:** `currentInstance` is `@internal` in Vue 3.6 and absent in Vue 3.4/3.5,
  which Reka supports.
- **Decision:**
  - Only `shared/instance.vapor.ts` imports `currentInstance`.
  - It registers a resolver into `shared/instance.ts`.
  - The resolver is reached only through `reka-ui/vapor` or the Vapor twins.
- **Consequences:**
  - `build-only` shows that `dist/shared/instance.vapor.{js,cjs}` are the only output
    files that reference `currentInstance`.
  - VDOM composables read exactly what they read before.
  - Interop users must add one import.
- **Depends on:** OPEN_QUESTIONS Q4 (opt-in mechanism). The side-effect import is
  the provisional default.

## ADR-003 Instance access via the internal `currentInstance`, not `__VUE_INSTANCE_SETTERS__`

- **Status:** Provisional (backfilled)
- **Context:** `getCurrentInstance()` returns `null` inside Vapor components. Vuetify0
  finds the instance by subscribing to the `__VUE_INSTANCE_SETTERS__` global, which only
  exists in some Vue builds.
- **Decision:** Import `currentInstance` from `vue`. It is exported at runtime in every
  3.6 build, but it is untyped, so it is accessed through a small typed adapter
  (`getInstance`, `getAssignedPropKeys`, `hasAssignedProp`, `getInstanceRootNode`).
- **Consequences:** The prototype depends on one internal export until Vue offers a
  public accessor.
- **Depends on:** OPEN_QUESTIONS Q6.

## ADR-004 Pure Vapor (no interop plugin, no VDOM renderer) is a first-class target

- **Status:** Accepted
- **Context:** The user requirement is `createVaporApp` only, with no
  `vaporInteropPlugin` and no VDOM runtime.
- **Decision:** The `vapor-only` test mode compiles Reka's own source as Vapor
  (`@vitejs/plugin-vue` `features: { vapor: true }` + `rekaVaporSwap()`) and mounts
  with `createVaporApp`. Every component family runs there with the same checks as
  the VDOM baseline.
- **How it is consumed today:**
  - A Vite app on Vue ≥ 3.6.0-rc.15 adds `rekaVaporSwap()` before `vue({ features:
    { vapor: true } })`.
  - It imports Reka from source (`packages/vapor/bench/vite.config.ts` is the
    reference setup).
- **How it should ship:** a compiled `reka-ui/vapor` entry (OPEN_QUESTIONS Q1–Q3).
  Not built in this PR.
- **Consequences:**
  - Coverage is 47/48 families (the gap is ListboxVirtualizer, ADR-017).
  - All 414 exported components compile with `__vapor === true`.
  - The bundle has no VDOM renderer (ADR-013).

## ADR-005 Scope of the swap layer: Primitive, Slot, Presence, Collection

- **Status:** Accepted
- **Context:** These modules build vnodes with `h()`/`cloneVNode`, or inspect slot
  vnodes.
- **Decision:**
  - Swap them as follows:
    - `Primitive.ts` → `Primitive.vapor.vue`
    - `Slot.ts` → `Slot.vapor.vue`
    - `Presence.ts` → `Presence.vapor.vue`
    - `Collection.ts` → `Collection.vapor.ts`, which uses `CollectionSlot.vapor.vue`
      and `CollectionItem.vapor.vue`
  - Move the shared registry logic to `collectionCore.ts`, so both variants use the
    same code.
- **Consequences:** Four swap entries, and no change to the VDOM modules' behaviour.
  The virtualizers stay out of scope (ADR-017).

## ADR-006 Pure-Vapor `as-child` applies attrs to the rendered DOM element

- **Status:** Accepted (backfilled; amended by the coverage run)
- **Context:** Pure Vapor has no slot-root fallthrough and no vnode to clone.
- **Decision:** `asChildAttrs.ts` applies attrs to the element the slot rendered:
  - classes and styles are merged;
  - listeners are chained;
  - for other attributes the child's own value wins, like VDOM
    `mergeProps(attrs, child.props)`;
  - updates are diffed;
  - each layer gets its own applier state.

  Two amendments:
  - **override mode** for Presence, where the consumer wins, as in VDOM fallthrough;
    the element's own value is restored when the attr is removed;
  - **`resolveAsChildTarget()`**: attrs go to the element inside the
    `data-reka-popper-content-wrapper`, like `PopperContent`'s `inheritAttrs: false`
    in VDOM.
- **Consequences:**
  - Attributes are applied on mount, so they are not part of SSR output (Q9).
  - There is a per-instance cost, a likely contributor to the slower pure-Vapor mount
    (BENCHMARKS §6).
- **Alternative:** a Vue API for slot-root fallthrough in pure Vapor (asked upstream
  in `CHANGES.md` §6). It would remove this file.

## ADR-007 `$el` on Vapor component refs via a build-time `exposeRootElement()` injection

- **Status:** Provisional
- **Context:** A Vapor component ref is a proxy over `exposed` and has no `$el`. Reka
  reads `ref.$el` in `resolveElement`, `useForwardExpose` and several components.
  Combobox focus failed because of this.
- **Decision:** The swap plugin appends `exposeRootElement()` to every Reka SFC's
  `<script setup>`. On a Vapor instance it defines a non-enumerable `$el` getter on
  `exposed`. On VDOM it is a no-op.
- **Consequences:**
  - No source change is needed in about 245 SFCs.
  - It costs one getter per instance.
- **Alternative:** call it explicitly in each SFC, or inside `useForwardExpose`. That
  is more visible, but touches many files. See OPEN_QUESTIONS Q10.

## ADR-008 `forwardRef` is write-only on the Vapor path

- **Status:** Accepted
- **Context:** Vapor sets dynamic template refs inside a render effect. Reading
  `currentRef` there made the effect depend on its own writes, which gave "Maximum
  recursive updates" (Tooltip `<component :is>`).
- **Decision:** On the Vapor path, the ref callback only writes reactive state. The
  VDOM path is unchanged.
- **Consequences:** Fixes the Tooltip and Presence loops. There is no VDOM behaviour
  change.

## ADR-009 Async components: `defineVaporAsyncComponent` + Presence waits for content

- **Status:** Accepted
- **Context:** `defineAsyncComponent` returns a VDOM wrapper. Popover, Tooltip and
  HoverCard lazy-load their content this way.
- **Decision:**
  - The swap plugin rewrites the import to `defineVaporAsyncComponent`.
  - `Presence.vapor.vue` uses a `MutationObserver` on `document.body` while it should
    render but has no element yet. It disconnects once the element is found, and on
    unmount.
- **Consequences:**
  - Lazy content works in pure Vapor.
  - The observer is only active during the async gap.

## ADR-010 VueUse shim in the Vapor build

- **Status:** Provisional
- **Context:** VueUse 14/15 calls `getCurrentInstance()`. As a result, `useMounted`,
  `useSupported` and `tryOnMounted` never fire in Vapor components (for example, the
  Dialog portal never mounted).
- **Decision:** `@vueuse/*` modules get a virtual `vue` whose `getCurrentInstance()`
  also returns a Vapor instance. Only lifecycle registration and `emit` are used on
  it.
- **Consequences:** VueUse works unmodified. The shim is scoped to the Vapor build.
- **Depends on:** OPEN_QUESTIONS Q5 (an upstream VueUse fix, or dropping these helpers).

## ADR-011 `sideEffects` must list the resolver files in `dist/`

- **Status:** Accepted
- **Context:** `dist/vapor.js` only imports `dist/shared/instance.vapor.js` for its
  side effect. A consumer production build (Vite 8/rolldown) against `dist/` dropped
  the registration when only `dist/vapor.*` and `src/*` were listed.
- **Decision:** Add `./dist/shared/instance.vapor.{js,cjs}` to `sideEffects`.
- **Consequences:**
  - Regression test `test-vdom/package-side-effects.test.ts` builds a consumer against
    `dist/`. It fails without the fix and passes with it.
  - The test is skipped if `dist/` is missing.

## ADR-012 Test layout: private package, one fixture set, four modes, VDOM baseline

- **Status:** Accepted
- **Context:** The rest of the monorepo is on Vue 3.5. The Vapor tests need Vue 3.6
  and must not change the main CI.
- **Decision:**
  - A private `packages/vapor` (`@reka-ui/vapor-tests`) pins Vue 3.6.0-rc.15. It
    inlines `vue`, `@vue/*`, `@vueuse/*`, `@tanstack/vue-virtual` and `@floating-ui/vue`,
    so that a single Vue copy is used.
  - It holds 48 component families (`test/families.ts`). Each has an anatomy check
    and one interaction.
  - The families run in four modes:
    - `vdom` baseline (`stripVapor()`);
    - `vdom-app+interop`;
    - `vapor-app+interop`;
    - `vapor-only`.
  - Gaps are marked `it.fails` with a `[known gap]` title, so a fixed gap turns the
    run red.
  - `scripts/coverage.mjs` prints the per-component table.
- **Consequences:**
  - A failure in the baseline means the fixture is wrong.
  - A failure only in `vapor-only` is a real gap.

## ADR-013 Bundle verification by grepping VDOM renderer internals

- **Status:** Accepted
- **Decision:**
  - Build the benchmark app unminified in the three modes.
  - Count `baseCreateRenderer`, `renderComponentRoot`, `createBlock`, `openBlock`,
    `createRenderer` and `function h(`.
  - Add per-package rendered sizes from the build's module stats.
- **Result:** The pure Vapor build has 0 of each, apart from one code comment that
  mentions `baseCreateRenderer`. 39.0 KiB of `@vue/runtime-core` remains as shared
  API. Details are in `BENCHMARKS.md` §5.
- **Depends on:** OPEN_QUESTIONS Q12 (make it a CI check).

## ADR-014 Benchmark metric set and harness

- **Status:** Accepted
- **Context:**
  - krausest measures create/update/clear rows, startup, memory and byte weight.
  - Vue core's `packages-private/benchmark` uses 4x CPU, warmup and nextTick timing,
    and reports median/mean/std/min/max.
  - Zag measures mount and update of 10k instances.
  - nicodevs measures heap via CDP GC + `JSHeapUsedSize`.
- **Decision:**
  - Metrics:
    - mount N, update all (on/off), unmount N;
    - overlay open/close;
    - heap per instance after GC, and residual heap over 3 cycles;
    - bundle min/gzip/brotli;
    - startup and ready heap.
  - Two timers: `script` (to nextTick) and `frame` (rAF + timeout).
  - Harness: Playwright (`playwright-core`) driving system Chrome over CDP, 4x CPU,
    3 warmup + 10 runs, fresh page per scenario × mode, rotated mode order.
  - Reka-free `plain` controls, to separate Vue's cost from Reka's.
- **Consequences:** Real-browser numbers. No paint tracing, so `frame` is not
  krausest's duration.
- **Depends on:** OPEN_QUESTIONS Q11–Q14 (harness, CI, components, sample sizes).

## ADR-015 Interop memory leak: document, don't fix or report in this PR

- **Status:** Deferred
- **Context:** Under Vapor app + interop, residual heap grows linearly with each
  mount/unmount cycle (≈22 MiB per cycle for 1000 Checkboxes). Bisection reproduces
  it with the **unmodified upstream** `useForwardExpose` inside a VDOM component under
  a Vapor parent. Neither of its parts alone (`onUpdated`, a function ref) leaks.
- **Decision:** Record the finding and the probes in `BENCHMARKS.md` §7. Do not change
  `useForwardExpose` for it. Do not file anything upstream yet: the user asked for
  local work only, and the root cause is not identified.
- **Next step:** A minimal reproduction against plain Vue 3.6. See OPEN_QUESTIONS Q8.

## ADR-016 Accept the interop as-child precedence divergence

- **Status:** Accepted
- **Context:** Under interop, Vue applies `cloneVNode` extras on a `VaporSlot` as
  fallthrough, so the parent wins. Reka's VDOM `Slot` lets the child win.
- **Decision:** Keep it as a documented `it.fails` in both interop modes. The pure
  Vapor `Primitive` keeps Reka's semantics (child wins).
- **Depends on:** OPEN_QUESTIONS Q7.

## ADR-017 Virtualizers are a known pure-Vapor gap in this PR

- **Status:** Deferred
- **Context:** Listbox, Tree and ScrollArea virtualizers clone slot vnodes
  (`cloneVNode`).
- **Decision:** No Vapor twin yet. ListboxVirtualizer runs as an `it.fails` family,
  and `vapor-only.test.ts` keeps one `it.todo`.
- **Depends on:** OPEN_QUESTIONS Q9.

## ADR-018 Commits and deliverables

- **Status:** Accepted
- **Decision:**
  - Small conventional commits on `feat/vapor-support`. The hooks run `eslint --fix`
    and commitlint, so no hook is skipped.
  - Proposal documents live in the repo under `vapor-proposal/` and are copied to
    `/workspace/reka-vapor/`.
  - `git format-patch a9873a0..HEAD` goes to `/workspace/reka-vapor/patches/`.
  - Nothing is pushed or posted.

## ADR-019 Performance work is profile-first, one change at a time, logged in PERF_LOG.md

- **Status:** Accepted
- **Context:** Pure Vapor is faster than VDOM on updates but slower on mount and
  unmount. It also uses more memory and has a larger bundle (BENCHMARKS §6).
- **Decision:**
  - Profile first: a CPU profile and the per-module bundle composition.
  - Then change one thing at a time. Each change must pass the full test gate and be
    re-benchmarked.
  - Keep a change only if it beats the noise rule in `PERF_LOG.md` and regresses no
    other metric. Each kept change is its own commit.
  - Changes that alter the API or drop features go to `OPEN_QUESTIONS.md`.
  - Hypotheses are written into `PERF_LOG.md` before the code changes.
- **Consequences:**
  - The log records every attempt, including the reverted ones.
  - `BENCHMARKS.md` compares the final numbers against baseline B0.
