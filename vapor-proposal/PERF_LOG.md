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
