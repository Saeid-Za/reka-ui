# Performance log: pure-Vapor build

This log is document-driven. For each attempt:

1. The hypothesis and the planned change are written here **before** any code
   changes.
2. The change is implemented, and the full test gate is run: core suite,
   type-check, build, lint, and all `packages/vapor` modes.
3. The benchmark is re-run and the before/after numbers are recorded.
4. The change is **kept** only if it improves the target and does not regress
   the tests or the other metrics beyond noise. Otherwise it is **reverted**,
   and the attempt still stays in this log.

Each kept change gets its own commit. Trade-offs that would change the API or
drop features go to `OPEN_QUESTIONS.md`; they are not decided here.

All numbers are from `packages/vapor/bench/run.mjs` on the same box: Chrome 156,
4x CPU, 3 warmup + 10 runs, medians in ms. "±" is the standard deviation.

**Noise rule.** A timing change counts as real only if it is larger than both
5 % and the larger of the two standard deviations.

## Baseline (B0)

Source: `raw/bench-final.json`, run finished 2026-11-18 13:58 (Asia/Tehran), at
commit `6b16742` (the benchmark commit).

**Pure Vapor `script` time (ms):**

| Scenario | mount | update:on | update:off | unmount |
|---|---|---|---|---|
| checkbox ×1000 | 387.0 (±62.07) | 376.0 (±37.92) | 271.3 (±25.52) | 91.2 (±28.39) |
| collapsible ×500 | 398.7 (±59.35) | 135.3 (±6.79) | 148.9 (±21.15) | 67.0 (±5.38) |
| tabs ×200 | 873.0 (±67.12) | 118.5 (±10.59) | 113.7 (±6.64) | 141.5 (±17.41) |

**Memory per instance (bytes):**

| Scenario | VDOM | Pure Vapor |
|---|---|---|
| checkbox | 21400 | 29533 |
| collapsible | 30392 | 42778 |
| tabs | 142707 | 206429 |

**Bundle (bytes):**

| Mode | min | gzip | brotli |
|---|---|---|---|
| VDOM | 182137 | 61411 | 54034 |
| Pure Vapor | 225347 | 75632 | 66278 |

## Targets, from BENCHMARKS.md §6

Pure Vapor vs VDOM:
- mount is 0.90–1.66x and unmount 1.35–1.80x;
- memory is 1.38–1.45x per instance;
- the bundle is +13.9 KiB gzip.

The Reka-free `plain` controls show no such overhead, so the candidates are in
Reka's Vapor path:

- `Primitive.vapor.vue`'s as-child applier and its watchers;
- `exposeRootElement()` on every instance;
- the `Collection.vapor.ts` registration;
- whether VDOM runtime code leaks into the pure-Vapor chunk.

## Attempts

### P1. CPU profile (2026-11-18 ~14:20, Asia/Tehran)

**Tool:** `bench/profile.mjs`. It runs the unminified build in Chrome at 1x CPU,
sampling every 50 µs, with 5 rounds of mount + unmount of Collapsible ×500 after
one warmup round.

**Totals:** pure Vapor 1029–1096 ms sampled. VDOM, same scenario: 698 ms.

The largest pure-Vapor items, inclusive time, from one profile:

| Function | ms | Where it comes from |
|---|---|---|
| `watch.immediate` in CollapsibleContent | 97.0 | the content's size-measuring watcher (`getBoundingClientRect`, 83.8 ms). It also runs in VDOM (57.9 ms self), so it is not Vapor-specific |
| `collectProps` (runtime-vapor) | 82.6 | resolving each child component's props and fallthrough attrs. 55.8 ms of it is at component creation (`initInputs`) |
| `resolveDynamicProps` (runtime-vapor) | 67.4 | `v-bind="attrs"` on `<component :is>` in `Primitive.vapor.vue` (`createPlainElement` → `setFn`) |
| `unmountComponent` | 73.3 | teardown |
| `useForwardExpose` | 39.0 | per-instance setup. In VDOM its self time is 18.0 ms. On the Vapor path, iterating `instance.props` runs the props proxy's `ownKeys` and resolves each key |
| `resolveFallthroughAttrs` | 27.4 | fallthrough from each Reka component into its root `Primitive` |
| `toRefs(props)` | 25.2 | Reka components that call `toRefs(props)` hit the Vapor props proxy. VDOM: 9.2 ms self |
| `exposeRootElement` | 2.6 | negligible |
| as-child applier (`applyAsChildAttrs`, `resolveAsChildTarget`) | < 1 | negligible in this scenario |

**Reading:** most of the gap is in Vue's runtime-vapor prop and attr machinery,
triggered by Reka's component nesting:
- root component → `Primitive` → `<component :is v-bind="attrs">`;
- `inheritAttrs: false` plus `v-bind="$attrs"`;
- `toRefs`.

The `as-child` applier and `exposeRootElement`, which we suspected, are **not** hot.

The Reka-side levers are:
- `useForwardExpose`: per-instance prop getters;
- `Primitive.vapor.vue`: a `v-if`/`v-else-if`/`v-else` chain of three branches,
  plus a dynamic `v-bind`.

### P2. Bundle composition (pure Vapor vs VDOM)

These are unminified per-module sizes (BENCHMARKS §5). Pure Vapor minus VDOM, in
KiB:

| Package | Difference (KiB) |
|---|---|
| `@vue/runtime-vapor` | +209.4 |
| `@vue/runtime-core` | −81.7 |
| `@vue/runtime-dom` | −8.3 |
| `@vue/reactivity` | −0.8 |
| `@vue/shared` | −1.3 |
| Reka source | +8.9 |

**Does the VDOM runtime leak into the pure-Vapor chunk?** No VDOM renderer code
leaks in: the counts of `createBlock`, `openBlock`, `renderComponentRoot` and
`createRenderer` are all 0.

There are 39.0 KiB of `runtime-core` left. They are shared APIs (scheduler, `watch`,
`inject`, prop normalisation, the app API) and a few VNode helpers (`cloneVNode`,
`isVNode`, `mergeProps`, `setTransitionHooks`, `invokeDirectiveHook`).
`@vue/runtime-vapor` references those helpers itself, behind **runtime** flags that
the bundler cannot remove: `isInteropEnabled`, `isHydrating`, `isKeepAliveEnabled`,
`isSuspenseEnabled` and `isTransitionEnabled` are `let` variables flipped by
`enable*()` calls. The Reka source does not import them in the pure-Vapor build:
the only `mergeProps` mention in Reka code is a comment.

**Conclusion:** the +13.9 KiB gzip is Vue's runtime-vapor 3.6.0-rc.15, mostly the
hydration, interop and keep-alive code paths that sit behind runtime flags. Reka
cannot remove it. It is an upstream ask (compile-time feature flags), recorded in
OPEN_QUESTIONS Q16. The Reka-side share is +8.9 KiB unminified of compiled
templates.

### E1. Lazy props in the Vapor `exposed` of `useForwardExpose`

- **Hypothesis:** On the Vapor path, `useForwardExpose` defines a getter for every
  prop. To do that it enumerates the props proxy (`ownKeys` + resolution) and
  allocates one closure per prop, for every instance. Replacing the per-prop getters
  with a single `Proxy` over `exposed`, which reads `instance.props[key]` on demand,
  should reduce mount time and memory per instance in every scenario. Tests should
  not change: template-ref reads, `in` checks and key enumeration still work through
  the proxy traps.
- **Change:**
  - `useForwardExpose.ts`, Vapor branch only. `exposed` becomes a Proxy with
    `get`/`has`/`ownKeys`/`getOwnPropertyDescriptor` traps that fall back to
    `instance.props`.
  - Forwarded-key filtering uses `key in instance.props` instead of a precomputed
    key set.
  - The VDOM path is untouched.
- **Measure:** vapor mode, 15 runs. Compare with B1, a vapor-only re-baseline taken
  with the same settings just before.

**Result: KEPT** (tests: gate passed — vapor 50 / 114+2xfail / 57+1xfail+1todo, core 3548 passed, type-check, build, lint ok).

First measurement, sequential (B1 run, then E1 run; `raw/perf/B1.json`, `raw/perf/E1.json`):
checkbox mount −18.6 %, tabs mount −15.9 %, collapsible mount −10.1 %, but the **unchanged `plain`
controls were also 5-20 % faster** in the second run, i.e. machine drift. Sequential runs are
therefore not trusted; from here on every attempt is measured **A/B in one session**
(`/workspace/reka-vapor/ab.sh`: baseline = committed HEAD built to `dist/vapor-base`, candidate =
working tree, both run interleaved per scenario, 15 runs, mode order rotated).

A/B (`raw/perf/E1ab.json`), pure Vapor, script median ms (± std):

| Op | HEAD | E1 | Δ | verdict |
|---|---|---|---|---|
| checkbox mount | 352.8 (±16.86) | 317.0 (±14.71) | −10.1 % | better |
| checkbox update:on | 349.3 (±38.19) | 342.8 (±43.36) | −1.9 % | noise |
| collapsible mount | 376.7 (±45.54) | 363.3 (±14.7) | −3.6 % | noise |
| collapsible unmount | 56.2 (±10.82) | 64.5 (±7.67) | +14.8 % | noise |
| tabs mount | 800.8 (±49.94) | 782.7 (±45.92) | −2.3 % | noise |
| plain mount (control, same code) | 12.2 (±1.49) | 14.2 (±1.9) | +16.4 % | flagged by the rule, but identical code: noise floor for ~10 ms ops |

All other ops: noise. Memory per instance (deterministic): checkbox 29533 → 28377 B (−3.9 %),
collapsible 42773 → 42538 (−0.5 %), tabs 206435 → 203625 (−1.4 %), plain unchanged.
Bundle: +106 B gzip (+447 B min), accepted as negligible against the memory win.

### P3. Heap snapshot per instance: Checkbox ×1000, VDOM vs pure Vapor (after E1)

**Tool:** `bench/heap.mjs`. It takes a heap snapshot with N instances mounted and
another with the scenario cleared, then reports the difference per constructor,
divided by N. These are self sizes from the unminified builds.

**Totals:** VDOM 23380 B per instance, pure Vapor 30616 B. Per Checkbox row:

| Kind | VDOM (B / objects) | Pure Vapor (B / objects) |
|---|---|---|
| closures | 1652 / 59 | 3220 / 115 |
| `(array)` backing stores | 3950 / 35 | 5542 / 57 |
| `Dep` | 448 / 14 | 1280 / 40 |
| `EffectScope` | 200 / 5 | 480 / 12 |
| `RenderEffect` | — | 720 / 12 |
| `DynamicFragment` | — | 312 / 6 |
| component instances | (`object:Object`, included above) | `VaporComponentInstance` 880 / 5 |

**Reading:**
- The extra memory is mostly reactive bookkeeping: more closures (Vapor's compiled
  prop getters), more `Dep`s and more effect scopes.
- 6 `DynamicFragment`s per row come from `v-if` chains. `Primitive.vapor.vue` alone
  creates two nested `createIf` per instance: `v-if="asChild"`, then
  `v-else-if` for self-closing tags, then `v-else`. Each one carries its own render
  effect, scope and anchor.

### E2. Flatten `Primitive.vapor.vue`'s branch chain

- **Hypothesis:** Selecting the self-closing case with a *dynamic slot* (`<template
  v-if="!isSelfClosing" #default>`) avoids the inner `createIf`. That removes one
  `DynamicFragment`, one render effect, one scope and one anchor per non-`as-child`
  `Primitive`. The result should be less memory per instance and a faster mount,
  most visibly in Checkbox and Tabs, where many `Primitive`s render elements.
  Hoisting `SELF_CLOSING_TAGS` out of `setup` also saves one array per instance.
- **Change:** `Primitive.vapor.vue` only. Vapor build only; VDOM is unaffected.
- **Measure:** A/B against HEAD (`ab.sh`).

**Result: REVERTED.** The gate passed, but the hypothesis was wrong. A Vapor dynamic slot
(`{ $: [() => cond ? slot : undefined] }`) allocates more per instance than the nested
`createIf` it replaced. A/B results (`raw/perf/E2ab.json`):

- Memory per instance got worse: checkbox 28377 → 29159 B (+2.8 %), collapsible 42541 → 44415 B
  (+4.4 %), tabs 203621 → 208293 B (+2.3 %).
- Timings were all within noise: checkbox mount 333.0 → 347.4 ms, tabs mount 851.0 → 870.5 ms.
- Bundle size was unchanged (−1 B gzip).
- A heap snapshot of the candidate showed 31398 B per checkbox, against 30616 B before.

### P4. CPU profile: Tabs ×200, unmount + mount ×5, pure Vapor (after E1)

Unlike Collapsible, the `as-child` path **is** hot in Tabs. `TabsTrigger` renders
`RovingFocusItem` with `as-child`, which renders `CollectionItem`, so several
`as-child` layers apply to each trigger. Self time, out of 1854.9 ms sampled:

| Function | Self time | Share |
|---|---|---|
| `applyAsChildAttrs` | 88.1 ms | 4.7 % (the top self-time function) |
| the `watchEffect` flush job inside `Primitive.vapor.vue` | 44.0 ms | 2.4 % |
| `findBlockElement` | 21.8 ms | 1.2 % |
| `exposeRootElement` | 13.4 ms | 0.7 % |

In `Primitive.vapor.vue`, every `as-child` instance calls `sync()` from `onMounted`
**and** from the first post-flush run of its `watchEffect`. That `watchEffect` runs
after mount, with `mounted` already true. So the attrs are applied twice on every
mount.

### E3. Apply `as-child` attrs once on mount

- **Hypothesis:** Dropping the `onMounted` sync, so that the post-flush
  `watchEffect` does the first application, halves the applier work on mount. Tabs
  mount should get faster. Checkbox and Collapsible should not change much, because
  they have fewer `as-child` layers. Memory should drop slightly: one hook closure
  fewer per `as-child` instance.
- **Change:**
  - In `Primitive.vapor.vue`, remove `onMounted` and the `mounted` flag. The
    `watchEffect` (`flush: 'post'`) syncs on its first run and on every attrs change.
  - `onUpdated` stays, for a slot element that gets replaced.
- **Risk:** The first post-flush run must see the rendered element. The gate tests
  cover as-child merge, listeners, reactivity, precedence and all 48 families.

**Result: REVERTED.** The gate passed, but the A/B run (`raw/perf/E3ab.json`) showed no timing
change outside noise:

| Scenario | Before (ms) | After (ms) | Change |
|---|---|---|---|
| Tabs mount | 889.1 | 882.0 | −0.8 % |
| Tabs unmount | 153.9 | 147.4 | −4.2 % (noise) |
| Checkbox mount | 355.5 | 355.7 | +0.1 % |

Memory per instance improved only for Tabs: 203447 → 201814 B (−0.8 %). Checkbox and Collapsible
did not change.

So the double application was not where the time goes. The first post-flush `watchEffect`
run most likely happens before `onMounted`, while `mounted` is still false, so the attrs
were applied only once. That was not verified separately. A 0.8 % memory gain is not worth
moving the initial apply to a different lifecycle point.

### E4. Fast paths and caches in `applyAsChildAttrs`

- **Hypothesis:** In Tabs, `applyAsChildAttrs` spends its self time (88 ms, P4) on
  work it repeats for every instance and every run:
  - `normalizeClass` / `normalizeStyle` plus `split` and a new `Set`, even when there
    is no `class` or `style`;
  - regex-based `hyphenate` and `parseEventName` for the same few keys;
  - `shouldSetAsProp`, which reads a DOM property (`typeof el[key]`) for every
    attribute.

  The planned fixes:
  - Skip the class and style passes when neither the attrs nor the previous state
    have any.
  - Memoise `hyphenate` and `parseEventName` per key.
  - Memoise the "boolean DOM property" check per tag name and key.

  Together these should cut the applier's self time and make Tabs mount faster, with
  no change in behaviour.
- **Change:** `asChildAttrs.ts` only. The existing `asChildAttrs.test.ts` covers class,
  style, listener, prop and override behaviour.
- **Measure:** A/B, plus the Tabs profile self time.

**Result: KEPT.**

**Gate:** passed. One caveat: in that gate run the consumer `sideEffects` check was *skipped*, because
`packages/core/dist` had been removed while the repo's `node_modules` were missing and got
reinstalled. The gate now builds `dist` first. The check passes again on the next gate (E5).

**Tabs profile:** `applyAsChildAttrs` self time went from 88.1 ms (4.7 %) to 78.1 ms (3.9 %). The
cached helpers (`hyphenate`, `parseEventName`) now take 0.2 ms each.

**A/B results** (`raw/perf/E4ab.json`). Another worker's test run shared the machine during this
run, so the noise was higher than before.

| Op (script ms) | HEAD | E4 | Δ | Verdict |
|---|---|---|---|---|
| tabs mount | 928.7 (±73.7) | 836.7 (±57.8) | −9.9 % | better |
| tabs update:on / off | 122.6 / 124.9 | 116.5 / 114.6 | −5 % / −8 % | noise |
| checkbox unmount | 106.2 (±13.46) | 69.2 (±22.36) | −34.8 % | flagged as better, but Checkbox has no `as-child` layer: treat as noise |
| collapsible mount | 406.9 | 388.8 | −4.4 % | noise |
| everything else | | | | noise |

**Memory per instance:** Tabs 203626 → 202874 B (−0.4 %). The others did not change.

**Bundle:** +107 B gzip, accepted for the Tabs mount gain.

### E5. Read the attrs proxy once per as-child sync

- **Hypothesis:** In P4, `watchEffect.flush` inside `Primitive.vapor.vue` spends 40.7 ms of self
  time. Its effect walks the Vapor `attrs` proxy (`for…in` plus a read of every key) only to
  track dependencies. `applyAsChildAttrs` then walks the same proxy again: `ownKeys` and the
  getters, which resolve the dynamic sources. If the effect copies the attrs into a plain
  object in that first walk and passes the copy to the applier, the proxy is enumerated and
  read only once per run. Tabs mount and update should get faster. Behaviour stays the same,
  because the copy is taken in the same tracked run.
- **Change:** In `Primitive.vapor.vue`, the `watchEffect` builds the copy and syncs with it.
  `onUpdated` keeps passing the live proxy.

**Result: REVERTED.** The gate passed, with all checks green, including the consumer
`sideEffects` check (50/50). The A/B run (`raw/perf/E5ab.json`) shows no gain on the Tabs
scenario it targeted:

| Op | Before (ms) | After (ms) | Change | Verdict |
|---|---|---|---|---|
| Tabs mount | 902.0 (±101) | 908.1 (±102) | +0.7 % | noise |
| Tabs update:on | 121.7 | 114.6 | −5.8 % | noise |
| Collapsible mount | 414.6 | 463.3 | +11.7 % | noise; the code is untouched for Collapsible |
| Checkbox unmount | 99.5 | 76.0 | −23.6 % | flagged by the rule, but that path is also unaffected |

Memory and bundle are unchanged.

During this run another worker was running Reka's full test suite on the same machine, and the
standard deviations roughly doubled. The A/B design keeps both builds under the same load, but
gains of 5 % or less cannot be resolved under these conditions.

### E6. Inject `exposeRootElement()` only where nothing else exposes `$el`

- **Hypothesis:** The swap plugin injects an `exposeRootElement()` import and call into every
  Reka SFC. That is a call per instance (13.4 ms self in the Tabs profile, P4) plus about 60 bytes
  of code per component in the bundle. Components that call `useForwardExpose()` already define
  `$el` on their Vapor `exposed`, and `Primitive.vapor.vue` defines it with `defineExpose`. Skipping
  the injection for those SFCs should give a slightly smaller bundle and slightly less mount work,
  without changing behaviour.
- **Change:** In `rekaVapor.ts`, skip the injection when the SFC source contains
  `useForwardExpose(` or is a `*.vapor.vue` twin.

**Result: KEPT.** The gate passed: all checks green, and the consumer `sideEffects` check
passed (50/50). Raw data for the A/B run is in `raw/perf/E6ab.json`.

The machine was heavily loaded during this run: startup median was 112.7 → 107.8 ms, against
about 50 ms when the machine was idle. All timing deltas were noise. Checkbox mount
439.4 → 376.1 ms (−14.4 %) is within its ±92 ms spread.

The deterministic metrics improved slightly, with no regression:

| Metric | Before | After | Change |
|---|---|---|---|
| Memory per instance, checkbox | 28377 B | 28238 B | −0.5 % |
| Memory per instance, collapsible | 42541 B | 42416 B | −0.3 % |
| Memory per instance, tabs | 202713 B | 201567 B | −0.6 % |
| Bundle, min | | | −294 B |
| Bundle, gzip | | | −43 B |
| Bundle, brotli | | | +30 B |

The change is build-time only. It drops the injected call in 247 of the SFCs, the ones that call
`useForwardExpose()`, plus the Vapor twins.

## Summary after E1–E6 (full three-mode run, `raw/bench-after-perf.json`, finished 2026-11-18 15:14 Asia/Tehran)

**Kept:**
- E1: lazy props in `useForwardExpose`'s Vapor `exposed`.
- E4: fast paths in the as-child applier.
- E6: no redundant `exposeRootElement` injection.

**Reverted:**
- E2: dynamic-slot branch flattening.
- E3: single mount sync.
- E5: attrs snapshot.

The final full run shared the machine with another worker's test suite. The load average was
3.3–4.3, and the VDOM column is 0–14 % slower than in B0 on the same code. So the absolute
milliseconds are not comparable with B0. Below, the **pure Vapor / VDOM ratio within each run** is
used for timing. Memory and bundle numbers are deterministic, so they are compared directly.

**Pure Vapor / VDOM `script` ratio:**

| Op | B0 (`bench-final.json`) | After (`bench-after-perf.json`) |
|---|---|---|
| checkbox mount | 0.90x | 0.77x |
| checkbox update:on / off | 0.69x / 0.50x | 0.65x / 0.53x |
| checkbox unmount | 1.35x | 1.34x |
| collapsible mount | 1.66x | 1.81x (see the note below) |
| collapsible update:on / off | 0.75x / 0.73x | 0.90x / 0.97x |
| collapsible unmount | 1.71x | 2.02x |
| tabs mount | 1.21x | 1.11x |
| tabs update:on / off | 0.28x / 0.26x | 0.26x / 0.26x |
| tabs unmount | 1.80x | 1.75x |

The Collapsible ratios got worse in this loaded run. However, none of the kept changes showed a
Collapsible regression in its own interleaved A/B runs:
- E1: mount −3.6 %;
- E4: mount −4.4 %;
- E6: mount −4.0 %.

All three were within noise. This needs a re-run on an idle machine before it can be
called either way.

**Pure Vapor memory per instance (deterministic):**

| Scenario | B0 | After | Change | VDOM |
|---|---|---|---|---|
| checkbox | 29533 B | 28238 B | −4.4 % | 21400 B |
| collapsible | 42778 B | 42413 B | −0.9 % | 30393 B |
| tabs | 206429 B | 201733 B | −2.3 % | 142701 B |

The pure-Vapor residual heap after unmounting 1000 Checkboxes also dropped, from
807/837/863 KiB (cycles 1/2/3) to 363/388/401 KiB.

**Bundle (bytes, gzip):**

| Build | B0 | After | Change |
|---|---|---|---|
| Pure Vapor | 75632 | 75802 | +170 |
| VDOM | 61411 | 61515 | +104 |

**A cost to note for VDOM users.** `useForwardExpose` ships its Vapor branch in the default
build, selected by a runtime check. E1 made that branch larger, which explains most of the VDOM
+104 B gzip. The per-attempt A/B runs only measured the Vapor bundle, so this was found
only in the final run.

A follow-up could move the Vapor branch of `useForwardExpose` into a module that the Vapor
build swaps in. That would return the VDOM bundle to B0 size. It is not done yet, and it is
listed under OPEN_QUESTIONS Q17.

**Bundle gap vs VDOM.** The difference is set by Vue's runtime-vapor (P2, OPEN_QUESTIONS Q16).
Reka-side changes can only move it by tens to hundreds of bytes.

---

# Round 2

The full-suite worker in `wt-suite` keeps the machine loaded, so every measurement in this
round is an interleaved A/B in a single browser session, with more runs (25 for targeted
scenarios). `ab.sh` now accepts `BASE=<ref>`, so the baseline can be any commit, and it still
builds that baseline without `git stash`.

The work goes in this order:

1. **R1:** confirm or refute the Collapsible regression.
2. **Memory and unmount:** heap retainers per instance and the cost of nested wrappers.
3. **Q17:** a Vapor-only `useForwardExpose` module, to bring the VDOM bundle back to its
   baseline size.
4. Any other levers that come up.

### R1. Is Collapsible slower after round 1?

- **Hypothesis:** The Collapsible ratio in the final round-1 run (mount 1.81x vs 1.66x) came
  from machine load, not from E1, E4 or E6. None of the three showed a Collapsible regression
  in its own A/B run.
- **Test:** an A/B of `6b16742`, the benchmark commit before any perf change, against HEAD.
  Collapsible only, 25 runs, both builds in one session.
- **Result** (`scratch/perf/R1.md`, 25 runs, interleaved, pure Vapor):

  | collapsible | 6b16742 | HEAD | delta | verdict |
  |---|---|---|---|---|
  | mount (script ms) | 471.3 ±78.1 | 451.1 ±57.9 | -4.3% | noise |
  | update:on | 171.5 ±20.2 | 140.9 ±9.3 | -17.8% | better |
  | update:off | 166.5 ±23.4 | 151.4 ±26.2 | -9.1% | noise |
  | unmount | 84.0 ±16.3 | 54.1 ±13.2 | -35.6% | better |
  | memory (B/instance) | 42777 | 42413 | -0.9% | same |

- **Verdict: refuted.** Collapsible on HEAD is not slower than before round 1. Update and
  unmount are faster. The worse ratio against VDOM came from machine load between runs.
  Absolute times in this session are about 2x those in BENCHMARKS.md because the full-suite
  worker was running.

### F1. Vue compile-time feature flags in the pure-Vapor build (user request)

- **Question:** Does setting `__VUE_OPTIONS_API__: false` (with `__VUE_PROD_DEVTOOLS__` and
  `__VUE_PROD_HYDRATION_MISMATCH_DETAILS__` both `false`) shrink the pure-Vapor build further,
  and is it safe for Reka?
- **Current state, checked before changing anything:** `bench/vite.config.ts` has defined all
  three flags as `false` in every mode since the benchmark commit (`6b16742`). Every number in
  BENCHMARKS.md, B0 included, was therefore measured with the Options API already off. This
  experiment measures what the flag is worth by turning it back on (the Vue default) in an
  A/B build, and checks that Reka still works with it off.
- **Hypothesis:** turning the Options API off shrinks the pure-Vapor bundle by only a few KiB.
  Most of the shared `runtime-core` code that `applyOptions` and the
  `PublicInstanceProxyHandlers` branches guard is only reached from VDOM components, and the
  pure-Vapor build tree-shakes much of it already. Timings and memory should not change: the
  checks are skipped once per component, at setup.
- **Safety check:** a grep of `packages/core/src` (tests and stories excluded) found no
  `data()`, `methods:`, `computed:`/`watch:` options, `mixins`, `beforeCreate`/`created`, or
  `this.$` anywhere. The only `defineComponent({...})` calls are the four VDOM render-function
  modules (`Primitive.ts`, `Slot.ts`, `Presence.ts`, `Collection.ts`). They use only `name`,
  `inheritAttrs`, `props` and `setup()`, which Vue supports with the Options API flag off, and
  the pure-Vapor build swaps all four out.
- **Other flags:** the esm-bundler build of `@vue/runtime-vapor` 3.6.0-rc.15 reads only
  `__VUE_PROD_DEVTOOLS__` (11 sites) and `__VUE_PROD_HYDRATION_MISMATCH_DETAILS__` (15).
  `runtime-core` adds `__VUE_OPTIONS_API__` (16). The other `__VUE_*__` names are runtime
  globals, not compile-time flags. Vue has no flag for hydration, interop, `KeepAlive`,
  `Teleport` or `Transition` in the Vapor runtime (see Q16), so no other flag is left to try.

### E7. Move the Vapor half of `useForwardExpose` out of the default build (Q17)

- **Hypothesis:** the Vapor branch that E1 added to `useForwardExpose` (about 100 B gzip,
  per the round-1 summary) is dead code in the default build. Without `reka-ui/vapor`,
  `getInstance()` never returns a Vapor instance. Moving that branch into
  `shared/useForwardExpose.vapor.ts`, registered from `shared/instance.vapor.ts` (the module
  behind `reka-ui/vapor` and imported by every `*.vapor.vue`), should bring the VDOM bundle
  back to B0 size or smaller. The pure-Vapor bundle should stay within a few bytes, and no
  timing or memory should change.
- **Why a registration hook and not a build swap:** `useForwardExpose` is public. An app
  that uses the default `reka-ui` build with `import 'reka-ui/vapor'` and calls it from its own
  `<script setup vapor>` components still needs the Vapor half. A swap in `rekaVaporSwap()`
  would only reach builds that compile Reka from source. Registering the Vapor half in the
  same module that turns on Vapor instance resolution reaches both kinds of build. No public
  export changes: `setVaporForwardExpose` is not re-exported from `shared/index.ts`, and the
  export-names snapshot test checks that.
- **Change:** `useForwardExpose.ts` keeps the shared prelude (`currentRef`, `currentElement`,
  `onUpdated`, the SSR early return) and the VDOM body. It returns early with
  `vaporForwardRef(instance, currentRef, localExpose)` when an implementation is registered
  and the instance is a Vapor one. `useForwardExpose.vapor.ts` holds the E1 Proxy `exposed`
  and the write-only `forwardRef` unchanged.
- **Bundle** (minified app bundles from `bench/vite.config.ts`, gzip level 9, brotli at the Node
  default; `BENCH_OPTIONS_API=true` restores Vue's default):

  | Build | Options API on: min / gzip / brotli | Off: min / gzip / brotli | Change, min / gzip |
  |---|---|---|---|
  | pure Vapor | 225,848 / 75,814 / 66,505 | 225,809 / 75,802 / 66,521 | **−39 B / −12 B** |
  | VDOM | 186,753 / 63,025 / 55,293 | 182,584 / 61,515 / 54,063 | −4,169 B / −1,510 B |
  | interop | 297,385 / 102,794 / 89,407 | 293,235 / 101,174 / 88,184 | −4,150 B / −1,620 B |

  The unminified pure-Vapor bundle contains no `applyOptions` or `resolveMergedOptions` with
  the flag on or off, and the set of named functions is the same in both builds. The pure-Vapor
  build never reaches the Options API code, so the flag has nothing left to remove there.
- **Timings and memory** (`scratch/perf/F1.md`: all scenarios, 10 runs; `F1b.md`: Checkbox
  and Collapsible, 20 runs; one session each). Memory per instance is the same to within
  0.01%. Timings vary in both directions between the two sessions: Checkbox unmount is
  −33% in F1b but +34% in F1, and Collapsible unmount is +33% in F1 and +36% in F1b. The two
  bundles differ by 39 B of minified code, so these swings are machine load. Part of the F1
  session also overlapped with my own type-check run.
- **Tests:** the pure-Vapor suite (`vitest.native.config.ts`) now compiles with
  `__VUE_OPTIONS_API__: false`, and `test-native/feature-flags.test.ts` asserts it. Result:
  **58 passed, 1 expected fail, 1 todo**. That is the same as before plus the new flag test.
  Reka needs nothing from the Options API in pure Vapor. The VDOM and interop suites keep the
  flag on, because `@vue/test-utils` and the interop host app are VDOM.
- **Verdict: kept** as configuration only. The benchmark already had all three flags off, so
  no numbers in BENCHMARKS.md change. The pure-Vapor test suite now also runs with the
  Options API off. The flag saves nothing in pure Vapor, about 1.5 KiB gzip in VDOM and about
  1.6 KiB gzip in interop. Whether Reka should document the flag is Q18 in OPEN_QUESTIONS.md.
- **E7a measured** (`scratch/perf/E7.md`, 15 runs, interleaved, pure Vapor; VDOM sizes from
  builds of HEAD and the working tree):

  | Metric | HEAD | E7a | Change |
  |---|---|---|---|
  | VDOM bundle, min / gzip / brotli | 182,584 / 61,515 / 54,063 | 181,812 / 61,321 / 53,757 | −772 / −194 / −306 B |
  | interop bundle, min / gzip / brotli | 293,235 / 101,174 / 88,184 | 292,463 / 101,003 / 87,869 | −772 / −171 / −315 B |
  | pure-Vapor bundle, min / gzip / brotli | 225,809 / 75,802 / 66,521 | 226,035 / 75,848 / 66,558 | +226 / +46 / +37 B |
  | Checkbox memory (B/instance) | 28,238 | 28,318 | +0.3% |
  | Collapsible / Tabs memory | 42,422 / 201,735 | 42,537 / 202,180 | +0.3% / +0.2% |
  | timings | | | all noise except Collapsible unmount (−18%, "better") |

  The VDOM bundle is now below B0 (182,137 / 61,411). The pure-Vapor build costs +80 B per
  Checkbox, a consistent +0.2–0.3% in every scenario: two closure scopes per call instead of
  one. The prelude (`currentRef`, `currentElement`, `onUpdated`) keeps its scope in
  `useForwardExpose.ts`, and the Vapor half gets a second scope for `ret`, `props` and
  `forwardedKeys`. `ret` is also allocated before the branch and then thrown away.
- **E7b hypothesis:** register the whole composable for Vapor (`useVaporForwardExpose`, with
  the prelude repeated) and return from it before any VDOM state is allocated. That gives one
  closure scope per instance again, so memory goes back to HEAD. The pure-Vapor bundle carries
  the prelude twice, about +100 B gzip, while the VDOM saving stays the same. The declared
  return type of `useForwardExpose` must not change; the VDOM-inferred type is the public one.
- **E7b measured** (`scratch/perf/E7b.md`, 15 runs; `E7b-2.md`, Checkbox and Collapsible, 25
  runs; both interleaved against HEAD):

  | Metric | HEAD | E7b | Change |
  |---|---|---|---|
  | VDOM bundle, min / gzip / brotli | 182,584 / 61,515 / 54,063 | 181,770 / 61,313 / 53,778 | **−814 / −202 / −285 B** (B0: 182,137 / 61,411 / 54,034) |
  | pure-Vapor bundle, min / gzip / brotli | 225,809 / 75,802 / 66,521 | 226,232 / 75,841 / 66,525 | +423 / +39 / +4 B |
  | memory (B/instance), Checkbox / Collapsible / Tabs | 28,238 / 42,413 / 201,735 | 28,199 / 42,355 / 201,517 | −0.1% each |
  | timings, E7b-2 (25 runs) | | | all noise (−7.4% to +3.9%) |

  The 15-run session flagged Checkbox and Collapsible unmount as "WORSE" (+34%, +42%). The
  25-run re-check measured the same ops at −0.4% and −7.4%, and E7a measured Collapsible
  unmount at −18%. Unmount on this loaded machine swings ±35% on its own; F1 showed that
  with identical code. Both builds run the same unmount code: the only change is where the
  closures are created.
- **Verdict: E7b kept** (E7a superseded). The VDOM build drops 202 B gzip and is now 98 B gzip
  below B0. The pure-Vapor bundle grows by +39 B gzip, and memory and timings are unchanged.
  The declared type of `useForwardExpose` is the same type, but the `.d.ts` now spells it
  `Ref<X>` and `ComputedRef<HTMLElement>` instead of `Ref<X, X>` and
  `vue0.ComputedRef<HTMLElement>`. New tests: a pure-Vapor family (Tooltip) fails when the
  registration is removed, so the registered path is covered. The app-level
  `useForwardExpose` scenario (`ForwardExposeDemo.vue`) runs in all three app modes. The
  consumer-build test now checks that `reka-ui/vapor` keeps the registration and that a
  default-only build contains no Vapor half (`new Proxy(ret`).

### P5. Heap closures by source location: Checkbox ×1000, VDOM vs pure Vapor (round 2)

**Tool:** `bench/heap.mjs --locations`. It groups closures by their line and column in the
unminified bundle. Totals are in `scratch/perf/heap-r2.txt` and the per-location list is in
`heap-r2-closures.txt`.

**Totals:**

| Scenario | VDOM (B/instance) | Pure Vapor (B/instance) |
|---|---|---|
| Checkbox | 23,384 | 30,477 |
| Collapsible | 34,498 | 47,566 |

**Checkbox, by kind:**

| Kind | VDOM | Pure Vapor |
|---|---|---|
| closures | 59 | 115 |
| `Dep` | 14 | 40 |
| `RenderEffect` | — | 12 |
| `RenderWatcherEffect` | 4 | 6 |
| `EffectScope` | 5 | 12 |
| `DynamicFragment` | — | 6 |

**Where the closures come from:**

- **Watchers, 6 per row.** Each pays `job`, `boundCleanup`, `baseWatchOptions.call` and a
  getter, about 4 closures plus a `RenderWatcherEffect`. VDOM rows have 4 watchers. The two
  extra are both in `Presence.vapor.vue`: `watch(shouldRender)` and
  `watch(() => ({ ...attrs }))`. The second also allocates a copy of the attrs on every run.
- **Compiler-generated per-prop getters** for `CheckboxRoot` → `Primitive` (`id`, `as-child`,
  `as`, `type`, `aria-*`, `data-*`: 13 closures). These are inherent to Vapor props and the
  same in any Vapor component library.
- **`createIf` and `renderEffect` closures** from the `Primitive` branch chain. E2 showed the
  alternatives cost more.
- **`useForwardExpose`:** the Proxy handler, 4 closures per call, 2 calls per row.
- **`Primitive.vapor.vue` setup:** `SELF_CLOSING_TAGS` is a fresh array per instance,
  because it is declared inside `<script setup>`.

### E8. One watcher in `Presence.vapor.vue` instead of two

- **Hypothesis:** merging `watch(shouldRender, syncNode)` and
  `watch(() => ({ ...attrs }), () => node.value && syncNode())` into one post-flush watcher
  that tracks both saves one watcher per `Presence`: about 4 closures, a
  `RenderWatcherEffect`, its `Dep` links and the attrs copy made on every run. Memory should
  drop by about 0.5–1% in Checkbox and Collapsible (one Presence per row) and in Tabs (one per
  tab), and unmount should get slightly cheaper. Behaviour must not change: a `shouldRender`
  change always syncs, and an attrs change syncs only while a node is rendered.
- **Change:** `Presence.vapor.vue` only (Vapor build). The watcher's getter reads
  `shouldRender` and every attr key and value, and returns `shouldRender`. Its callback runs
  `syncNode()` when `shouldRender` changed or a node exists. The getter returns a new array
  each run, so the callback also fires for attr-only changes.
- **Result** (`scratch/perf/E8.md`, 15 runs, interleaved against HEAD = E7b):

  | Metric | HEAD | E8 | Change |
  |---|---|---|---|
  | Checkbox memory (B/instance) | 28,198 | 27,820 | **−1.3%** |
  | Collapsible memory | 42,354 | 41,971 | **−0.9%** |
  | Tabs memory | 201,517 | 200,376 | **−0.6%** |
  | pure-Vapor bundle, min / gzip / brotli | 226,232 / 75,841 / 66,525 | 226,257 / 75,856 / 66,406 | +25 / +15 / −119 B |
  | timings | | | Checkbox unmount −28% ("better"); everything else noise, between +21% and −32% |

  A Checkbox row saves 378 B, which matches one watcher plus its closures and `Dep` links.
  The −28% Checkbox unmount is in the expected direction, but it is not claimed: unmount
  swings ±35% on this machine (F1, E7b).
- **Tests:** a new pure-Vapor test (`test-native/vapor-only.test.ts`, "re-applies changed
  attrs"). It changes an attr while the child is rendered, hides the child, changes the attr
  again while nothing is rendered, then shows the child. It passes on HEAD and on E8. It
  fails on a variant that only syncs on render changes, so it guards the merged condition.
  The same test against VDOM-compiled Reka under interop fails at the first assertion: a
  Vapor parent's attrs on the VDOM `Presence` never reach the child. That is not caused by
  this change (it does not touch the VDOM `Presence`), and it is recorded under Q7.
  The gate passed: build, 51/118/62 vapor tests (VDOM, interop, pure Vapor), 3548 core
  tests, type-check and lint.
- **Verdict: kept.**

### E9. Allocate `SELF_CLOSING_TAGS` once per module in `Primitive.vapor.vue`

- **Hypothesis:** `const SELF_CLOSING_TAGS = ['area', 'img', 'input']` sits inside `<script
  setup>`, so every `Primitive` allocates a new array, about 40 B with its backing store.
  Moving it to a plain `<script>` block allocates it once per module. That should save
  roughly 40–80 B per Checkbox row (0.1–0.3%) and more in Tabs, which has many `Primitive`s.
  Nothing else should change. The VDOM `Primitive.ts` already declares it at module scope.
- **Change:** `Primitive.vapor.vue` only.
- **Result** (`scratch/perf/E9.md`, 15 runs, interleaved): memory per instance was
  27,820 → 27,801 B for Checkbox (−0.1%), 41,955 → 41,921 B for Collapsible (−0.1%) and
  200,337 → 199,896 B for Tabs (−0.2%). Every timing was noise. The bundle grew by
  +5 B min, +21 B gzip and +98 B brotli, because of the second `<script>` block and its
  module wiring.
- **Verdict: REVERTED.** The memory gain is smaller than estimated: Checkbox saves 18 B, so
  V8 shares most of what a small literal array costs. The gain also comes with a bundle
  regression, and round-2 rules keep only changes that regress no metric.

### E10. Share one Proxy handler across all Vapor `useForwardExpose` calls

- **Hypothesis:** every Vapor `useForwardExpose` call builds a Proxy handler object with
  four closures (`get`, `has`, `ownKeys`, `getOwnPropertyDescriptor`) plus an `isProp`
  closure, which P5 shows as 2 of each per Checkbox row. A module-level handler that finds
  the instance's props through a `WeakMap` keyed by the Proxy target replaces about 5 closures
  and a handler object with one `WeakMap` entry. That should save about 150 B per call: about
  300 B per Checkbox row (~1%), proportionally more in Tabs, and the same in Collapsible,
  which has 3 calls per row. Property reads through the exposed proxy get one `WeakMap` lookup,
  which only template-ref reads use, not render paths. Timings should not change.
- **Change:** `useForwardExpose.vapor.ts` only. `exposeHandler` and a
  `WeakMap<object, props>` at module scope; `forwardRef` uses the module-level `isProp(props,
  key)`.
- **First cut (E10a, `scratch/perf/E10.md`):** memory −1.1% (Checkbox), −1.1% (Collapsible)
  and −0.9% (Tabs); bundle +163 B min / +65 B gzip / +163 B brotli. The handler was written
  out longhand, so it was rewritten more compactly around one `propKey()` helper and measured
  again.
- **E10b** (`scratch/perf/E10b.md`, 15 runs, interleaved against HEAD = E8):

  | Metric | HEAD | E10b | Change |
  |---|---|---|---|
  | Checkbox memory (B/instance) | 27,819 | 27,510 | **−1.1%** (−309 B) |
  | Collapsible memory | 41,971 | 41,519 | **−1.1%** (−453 B) |
  | Tabs memory | 200,375 | 198,613 | **−0.9%** (−1,762 B) |
  | pure-Vapor bundle, min / gzip / brotli | 226,257 / 75,856 / 66,406 | 226,390 / 75,914 / 66,572 | +133 / +58 / +166 B |
  | timings | | | all noise (−12% to +15%; Tabs mount ±284 ms) |

  The gate passed: build, 51/118/62 vapor tests, 3548 core tests, type-check and lint.
- **Verdict: kept, with a stated trade-off.** Memory per instance is a round-2 priority. This
  is the second-largest memory win in the round, and it saves as much as E8 does. It costs
  58 B gzip, which is 0.08% of the pure-Vapor bundle. E9 was reverted under the same rule
  because its gain was a tenth as large (−18 B per Checkbox row) for a third of the cost.
  If maintainers weigh bytes over memory, reverting this one commit restores the E8 numbers.


## Summary of round 2 (full run `raw/bench-round2.json`, BENCHMARKS §11)

| # | What | Verdict | Main effect, measured A/B |
|---|---|---|---|
| R1 | Re-check of Collapsible against `6b16742` | regression refuted | update −18%, unmount −36%, mount within noise |
| F1 | `__VUE_OPTIONS_API__: false` (already set in the bench) | kept as test configuration | pure Vapor ±0 B (−12 B gzip); VDOM −1.5 KiB gzip; Q18 |
| E7a | Vapor `forwardRef` registered separately | superseded by E7b | memory +0.3% |
| E7b | Whole Vapor `useForwardExpose` registered by `reka-ui/vapor` | **kept** | VDOM −202 B gzip (below B0), pure Vapor +39 B gzip, memory −0.1% |
| E8 | One watcher in `Presence.vapor.vue` | **kept** | memory −1.3% / −0.9% / −0.6% |
| E9 | Hoist `SELF_CLOSING_TAGS` | reverted | memory −0.1%, bundle +21 B gzip |
| E10b | Shared Proxy handler in the Vapor `exposed` | **kept** (trade-off) | memory −1.1% / −1.1% / −0.9%, bundle +58 B gzip |

Memory per instance is now 1.29x (Checkbox), 1.37x (Collapsible) and 1.39x (Tabs) of VDOM.
At the end of round 1 it was 1.32x, 1.40x and 1.41x.

What remains, from P5, is mostly Vapor-runtime bookkeeping:

- compiler-generated prop getters;
- one `RenderEffect` per binding;
- `createIf` fragments.

Reka can only remove these with the behaviour-changing levers in Q17. No A/B run in this round
moved unmount outside noise.

## Full Suite Sprint: Virtualizer Unification (ADR-S21)

Measured bundle size after unifying virtualizers via `<Primitive as-child v-for>` in original SFCs
(dropping separate `.vapor.vue` virtualizer twins):

| Mode | min (bytes) | gzip (bytes) | brotli (bytes) |
|---|---|---|---|
| VDOM | 182,456 | 61,524 | 53,895 |
| Interop | 293,109 | 101,202 | 87,998 |
| Pure Vapor | 228,700 | 76,530 | 66,984 |

By avoiding duplicate virtualizer twins, the pure Vapor bundle only incurs +898 B gzip over baseline B0 (75,632 B) despite adding full `@tanstack/vue-virtual` compatibility.

## Step 25 / FIX_PLAN_4–5 (A3): 10k Listbox VDOM A/B (`step25-listbox-vapor-a3`)

2026-11-19, `BASE=0b2c515e~1` (36c0f04a) vs HEAD, `BENCH_MODE=vdom`, worktree baseline +
bench sync (`ab.sh`). Scroll: 12 steps × 8k px, wait until `[data-index]` changes each step.
Memory: forced GC + `JSHeapUsedSize` around single 10k mount/unmount (3 samples).

| Scenario/op (script median ms) | baseline | HEAD | Δ | verdict |
|---|---|---|---|---|
| listbox-virtual mount | 13.1 (±0.54) | 14.3 (±1.33) | +9.2% | noise |
| listbox-virtual scroll | 6200.1 (±11.63) | 6242.7 (±15.11) | +0.7% | noise |
| listbox-virtual unmount | 1.3 (±0.38) | 1.5 (±0.45) | +15.4% | noise |

| Memory | baseline | HEAD | Δ |
|---|---|---|---|
| mount heap (1×10k listbox) | 1,940,904 B | 2,013,764 B | +3.8% |

Bundle (unified `<Primitive as-child v-for>` in Listbox/ScrollArea/Tree virtualizer SFCs;
`git diff --stat 0b2c515e~1..HEAD` those three files only): min +1,404 B, **gzip +158 B**
(70,415 → 70,573), brotli +196 B. No VDOM timing metric >5% worse outside noise.
Raw: `packages/vapor/scratch/perf/step25-listbox-vapor-a3.json`.

### superseded: scroll metric timed out every step

The pre-G3 waiter used the **first** `[data-index]` in document order, which did not move when
the virtualizer scrolled. Each of 12 steps burned 30 `settle()` waits (~517 ms/step → ~6200 ms
total, ±11 ms jitter only).

## G3 (FIX_PLAN_6): scroll bench measures virtualizer progress

Diagnosis (`ListboxVirtualRow.vue` + `scrollListboxDiagnose`, VDOM bench, 2026-11-19 H4):

| Field | Value |
|---|---|
| `clientHeight` | **200** px (`ListboxContent` inline style) |
| `scrollHeight` | **280 000** px |
| `overflowY` | `auto` |
| `scrollTop` before one `+= 8000` step | **0** |
| `scrollTop` after | **8000** |
| `max data-index` before step | **19** |
| `max data-index` after | **304** |
| `first data-index` (before step) | **0** |
| `timeouts` in 15 scroll samples (`step25-listbox-g3.json`) | **0** |

Fix (`bench/src/state.ts`): progress = **max** `data-index` among rendered rows; step throws on
timeout (`timeouts` must be 0). Heap for listbox-virtual: **n = 5** with median ± σ.

A/B (`BASE=0b2c515e`, `BENCH_MODE=vdom`, `step25-listbox-g3.json`, 15 timing samples):

| Scenario/op (script median ms) | baseline | HEAD | Δ | verdict |
|---|---|---|---|---|
| listbox-virtual mount | 11.3 (±1.05) | 11.6 (±1.04) | +2.7% | noise |
| listbox-virtual scroll | 216.6 (±32.78) | 229.3 (±20.14) | +5.9% | noise |
| listbox-virtual unmount | 0.8 (±0.32) | 0.9 (±0.3) | +12.5% | noise |

| Memory (mount heap, 1×10k) | baseline | HEAD | Δ |
|---|---|---|---|
| median ± σ (n=5) | 2,012,208 (±1,693) B | 2,010,596 (±1,950) B | −0.1% |

12 scroll steps complete in ~230 ms total (well below `12 × 31 × frame` sanity bound).

## F0 baseline (Phase F start, post G1–D)

Gate @ `feat/vapor-full-suite` (2026-11-19): **3541 / 11 / 35** Vapor full suite;
**3552 / 35 skip** `pnpm test:run`. Listbox A/B after G3 scroll fix: see table above
(`step25-listbox-g3.json`). Hill-climb: no experiments run in this pass (STOP: remaining
C7/E work items completed as documentation only).

## H7 Phase F (FIX_PLAN_7)

### F0 fresh baseline (`scratch/perf/h7-f0.json`, 2026-11-19T19:16Z)

Gate before F0: **3541 / 11 / 35** Vapor; **3552 / 35** `test:run`.

| Bundle (gzip B) | vdom | interop | vapor |
|---|---|---|---|
| bench app | 70 850 | 110 359 | 85 684 |

| Scenario / op (pure Vapor script median ms, ±σ) | mount | scroll (listbox only) |
|---|---|---|
| `plain` ×1000 | 10.3 (±1.38) | — |
| `checkbox` ×1000 | 292.8 (±17.98) | — |
| `listbox-virtual` | 19.1 (±1.27) | 333.4 (±57.96) |
| `tabs` ×200 | 640.8 (±104.49) | — |

| Memory (pure Vapor) | metric | median |
|---|---|---|
| checkbox ×1000 | bytes/instance | 31 209 (±1.19), n=3 |
| checkbox ×1000 | residual after unmount | 471 404 B |
| listbox-virtual ×1 | mount heap | 2 423 040 B (±1 148), n=5 |

### H7-E1 Lazy `createAsChildApplier` in `Primitive.vapor` (P1)

**Hypothesis:** non-`as-child` primitives should not allocate the as-child applier closure;
P1 marked the applier negligible, but eliding it may still save mount heap on hot paths.

**Change:** defer `createAsChildApplier()` until the first `sync()` when `renderAsChild`.

**A/B:** `node bench/run.mjs --skip-build --runs 10 --modes vapor --only checkbox,collapsible` before/after.

**H7-E1 result (reverted):** checkbox mount +14.8 %, collapsible +21.9 % (script median; noise
and session drift). Heap bytes/instance −165 B / −491 B (below noise). Vapor gzip +4 B. **REVERTED.**

### H7 summary (hill-climb)

| Exp | Metric | Δ | Verdict |
|---|---|---|---|
| H7-E1 | checkbox vapor mount script | +14.8 % | reverted |
| H7-E1 | collapsible vapor mount script | +21.9 % | reverted |
| H7-E1 | bytes/instance (checkbox / collapsible) | −0.5 % / −1.0 % | noise |

**END H7 pass:** **1** experiment, **0** kept, **1** reverted (H7-E1). Hill-climb did not hit
5 consecutive misses or 20 total; gate held at **3541 / 11 / 35**.


## Local A/B after the cleanup round (2026-11-20, owner's machine, quiet)

Full method and tables: `PERF_RESULTS_LOCAL.md` (primary). before = `a1e9d43d2` (rc.15), rc.16 only =
`6e02e7b96`, now = `c56d53a84`; 2 passes, reversed order; raw JSON in `Contribs/local-run/logs/bench/`.

| Metric (script ms / bytes) | before | rc.16 only | now | now vs before | now vs rc.16 only |
|---|---|---|---|---|---|
| checkbox mount (vapor) | 287.5 | 241.6 | 244.4 | −15.0 % improvement | +1.2 % noise |
| collapsible mount (vapor) | 324.7 | 226.3 | 235.2 | −27.6 % improvement | +3.9 % noise |
| tabs mount (vapor) | 636.9 | 531.3 | 569.7 | −10.6 % improvement | +7.2 % (spread 5.8 %) |
| listbox-virtual mount (vapor) | 16.6 | 14.6 | 15.3 | −7.6 % improvement | +4.8 % noise |
| checkbox update (vapor) | 325.2 | 248.7 | 252.8 | −22.3 % improvement | +1.6 % noise |
| checkbox residual after unmount (vapor) | 471,128 B | 327,608 B | 341,146 B | −27.6 % improvement | +4.1 % |
| plain mount (vapor) | 9.8 | 10.2 | 11.3 | +14.8 % (1.5 ms; noise vs F0) | +10.3 % noise |
| VDOM timings (all scenarios) | | | | noise; plain mount −7.2 % | noise |
| bundle gzip vdom / interop / vapor | 70,850 / 110,359 / 85,684 | 71,011 / 113,534 / 87,769 | 70,989 / 113,463 / 87,897 | +0.2 / +2.8 / +2.6 % | −0.0 / −0.1 / +0.1 % |

**Conclusion:** the Vapor gains and the bundle growth come from Vue 3.6.0-rc.16; the cleanup round is
performance-neutral on top of it, with small costs on tabs mount and residual heap. No VDOM regression.
The box run's "our code alone −13.6 % / −11.1 % on checkbox mount / update" did not reproduce (+1.2 % /
+1.6 %, noise); the box was loaded (2–3.6) and that column was noise.
