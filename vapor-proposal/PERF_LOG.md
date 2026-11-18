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
