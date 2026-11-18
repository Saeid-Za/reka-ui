# Benchmarks: Reka UI in VDOM, Vapor + interop, and pure Vapor

All numbers below come from one run of `packages/vapor/bench/run.mjs` on the box,
finished 2026-11-18 13:58 (Asia/Tehran). The raw output is `raw/bench-final.json`.
Nothing here is estimated or copied from elsewhere. Treat these as single-machine
numbers from a shared Linux VM: compare the modes with each other, not with
absolute figures from other machines.

## 1. What is compared

The benchmark app (`packages/vapor/bench`) is built three times from the same source:

| Mode | App | Benchmark components | Reka UI |
|---|---|---|---|
| **VDOM** | `createApp` | VDOM (the `vapor` attribute is stripped) | VDOM, as published today |
| **Vapor app + interop** | `createVaporApp` + `vaporInteropPlugin` | Vapor | VDOM, through interop: what a Vapor app gets today without this branch |
| **Pure Vapor** | `createVaporApp`, no interop plugin | Vapor | compiled as Vapor with the swap layer (this branch) |

Each scenario renders N rows inside one Vapor/VDOM root, through `v-for`:

| Scenario | N | One row |
|---|---|---|
| `plain` | 1000 | a plain `<button>` SFC with **no Reka code**: the Vue-only control |
| `plain-slot` | 1000 | the same, with a default slot: control |
| `checkbox` | 1000 | `CheckboxRoot` + `CheckboxIndicator` |
| `collapsible` | 500 | `CollapsibleRoot` + `CollapsibleTrigger` + `CollapsibleContent` |
| `tabs` | 200 | `TabsRoot` + `TabsList` + 3 `TabsTrigger` + 3 `TabsContent` (600 triggers rendered) |
| `dialog` | 1 | `DialogRoot` + Trigger + Portal + Overlay + Content, open/close |
| `popover` | 1 | `PopoverRoot` + Trigger + Portal + Content (Floating UI positioning), open/close |

In the pure Vapor mode the `plain` controls are compiled as Vapor too (every SFC is),
so they show Vue's own VDOM→Vapor difference with Reka out of the picture.

## 2. Method

See `DECISIONS.md` D8 for why these metrics.

- **Browser**: system Google Chrome 156.0.8078.47, headless, driven through
  `playwright-core` 1.63 (CDP), flag `--js-flags=--expose-gc`. Production builds
  (`NODE_ENV=production`, minified), served by a local Node HTTP server.
- **CPU throttling**: 4x through CDP `Emulation.setCPUThrottlingRate`, like Vue core's
  `packages-private/benchmark`.
- **Runs**: each scenario × mode gets a fresh page; on it, 3 warmup + 10 measured
  rounds of all ops in order. The order of the modes is rotated per scenario to
  spread machine drift across them. The tables
  show the **median** with the standard deviation in brackets. `raw/bench-final.json`
  also has mean, min, max and all samples.
- **Ops**: `mount` (render N), `update:on` / `update:off` (flip one reactive boolean
  that every row reads: `checked`, `open`, active tab, or overlay open), `unmount`.
- **Timers** (in the page, `performance.now()`):
  - `script`: from the state change until `await nextTick()`. This is what Vue core's
    harness measures.
  - `frame`: until a `requestAnimationFrame` callback plus a following `setTimeout`.
    This includes style/layout and the work Reka defers to rAF. Paint is **not**
    traced, so this is not the same as krausest's paint-based duration. A 1-row
    overlay op therefore shows about one frame (about 17 ms).
- **Memory**: no throttling. The scenario is first mounted with 10 rows and cleared,
  so that lazily compiled code is not counted, and that heap is the baseline. Every
  heap reading is 2× `HeapProfiler.collectGarbage`, then `Performance.getMetrics` →
  `JSHeapUsedSize`. Bytes per instance is `(heap(N mounted) − baseline) / N`, median
  of 3 fresh pages. **Residual**: heap
  after unmount minus the baseline, after each of 3 mount/unmount cycles. The
  table shows the first page.
- **Startup**: 10 fresh pages per mode at 4x CPU, from navigation start to
  `performance.mark('app-mounted')`. This is the time to an empty app shell, not to a
  rendered scenario. It shows the runtime's parse/eval cost. Ready heap is measured
  after GC.
- **Bundle**: the whole benchmark app as one JS chunk (`codeSplitting: false`):
  minified, gzip level 9 and brotli quality 11 (Node `zlib`).
- **Sanity**: each mode's mount is checked by counting the rendered elements, and the
  open state is checked by finding the opened content. See the last table.

Reproduce from `packages/vapor`:

```sh
node bench/run.mjs                    # build all 3 modes + run everything (~5 min)
node bench/report.mjs <result.json>   # markdown tables
node bench/run.mjs --only plain-expose,probe:checkbox-root --skip-timing   # leak probes
```

## 3. Environment

| | |
|---|---|
| Machine | shared Linux VM, Intel(R) Xeon(R) Processor, 8 cores, 16 GB |
| OS | Linux 6.12.113+ |
| Node | v24.22.1 |
| Chrome | 156.0.8078.47 (headless, system install) |
| Vue | 3.6.0-rc.15 (`vue`, `@vue/runtime-vapor`) |
| Build | Vite 8 (rolldown), `@vitejs/plugin-vue` 6.0.11 |
| Reka UI | 2.11.0 source at `a9873a0` + this branch |
| Throttling / runs | 4x CPU, 3 warmup + 10 runs |

## 4. Results

### Bundle (whole benchmark app, one JS chunk, production build)

| Mode | min (KiB) | gzip -9 (KiB) | brotli q11 (KiB) |
|---|---|---|---|
| VDOM | 177.9 | 60.0 | 52.8 |
| Vapor app + interop | 285.9 | 98.7 | 86.0 |
| Pure Vapor | 220.1 | 73.9 | 64.7 |

### Timings, `script` (ms, median of 10 runs after 3 warmup, 4x CPU throttling)

| Scenario | Op | VDOM | Vapor app + interop | Pure Vapor | Pure Vapor vs VDOM |
|---|---|---|---|---|---|
| plain | mount | 15.9 (±3.33) | 50 (±8.05) | 15.2 (±2.02) | 0.96x |
| plain | update:on | 7.9 (±1.19) | 31.1 (±4.11) | 4.1 (±0.93) | 0.52x |
| plain | update:off | 7.9 (±1.07) | 26.6 (±4.54) | 3.5 (±0.65) | 0.44x |
| plain | unmount | 4.9 (±0.79) | 9.9 (±2.24) | 4.6 (±0.81) | 0.94x |
| plain-slot | mount | 23.1 (±5.15) | 57.5 (±7.31) | 21.4 (±3.4) | 0.93x |
| plain-slot | update:on | 11.6 (±6.82) | 36.3 (±2.68) | 5.4 (±1.61) | 0.47x |
| plain-slot | update:off | 12.3 (±2.5) | 31.4 (±3.16) | 3.9 (±0.32) | 0.32x |
| plain-slot | unmount | 5.8 (±1.15) | 14.7 (±2.02) | 5 (±1.16) | 0.86x |
| checkbox | mount | 431.5 (±28.7) | 708.9 (±42.7) | 387 (±62.07) | 0.90x |
| checkbox | update:on | 543.2 (±47.35) | 688.9 (±49.88) | 376 (±37.92) | 0.69x |
| checkbox | update:off | 540.2 (±24.16) | 758 (±82.55) | 271.3 (±25.52) | 0.50x |
| checkbox | unmount | 67.5 (±19.74) | 87 (±21.29) | 91.2 (±28.39) | 1.35x |
| collapsible | mount | 240.8 (±25.36) | 454.4 (±18.68) | 398.7 (±59.35) | 1.66x |
| collapsible | update:on | 179.5 (±14.35) | 263.6 (±34.83) | 135.3 (±6.79) | 0.75x |
| collapsible | update:off | 205.3 (±13.45) | 288.8 (±38.4) | 148.9 (±21.15) | 0.73x |
| collapsible | unmount | 39.2 (±5.83) | 68.4 (±11.37) | 67 (±5.38) | 1.71x |
| tabs | mount | 722.2 (±40.17) | 870 (±52.18) | 873 (±67.12) | 1.21x |
| tabs | update:on | 429.8 (±47.37) | 315.2 (±26.67) | 118.5 (±10.59) | 0.28x |
| tabs | update:off | 434.8 (±38.47) | 310.4 (±19.17) | 113.7 (±6.64) | 0.26x |
| tabs | unmount | 78.6 (±5.46) | 116.2 (±10.01) | 141.5 (±17.41) | 1.80x |
| dialog | mount | 1.9 (±0.56) | 3.3 (±0.73) | 2.7 (±0.41) | 1.42x |
| dialog | update:on | 5.8 (±0.87) | 6.8 (±0.93) | 7.7 (±0.99) | 1.33x |
| dialog | update:off | 2.1 (±0.44) | 2.2 (±0.56) | 1.7 (±0.22) | 0.81x |
| dialog | unmount | 0.9 (±0.32) | 0.9 (±0.24) | 0.8 (±0.32) | 0.89x |
| popover | mount | 2.4 (±0.89) | 4.1 (±0.73) | 3.2 (±0.56) | 1.33x |
| popover | update:on | 8.6 (±0.72) | 9 (±1.2) | 8 (±0.53) | 0.93x |
| popover | update:off | 2 (±0.3) | 2.2 (±0.61) | 0.9 (±0.17) | 0.45x |
| popover | unmount | 0.9 (±0.43) | 1.2 (±0.39) | 0.7 (±0.27) | 0.78x |

### Timings, `frame` (ms, median of 10 runs after 3 warmup, 4x CPU throttling)

| Scenario | Op | VDOM | Vapor app + interop | Pure Vapor | Pure Vapor vs VDOM |
|---|---|---|---|---|---|
| plain | mount | 54.9 (±6.51) | 87.5 (±11.1) | 54.9 (±4.1) | 1.00x |
| plain | update:on | 16.4 (±3.89) | 31.9 (±9.69) | 16.2 (±1.78) | 0.99x |
| plain | update:off | 17.1 (±0.85) | 27.6 (±4.39) | 16.8 (±0.18) | 0.98x |
| plain | unmount | 17.5 (±1.47) | 17.3 (±1.37) | 17.4 (±0.35) | 0.99x |
| plain-slot | mount | 60.8 (±13.7) | 93.8 (±9.72) | 56.1 (±4.1) | 0.92x |
| plain-slot | update:on | 16.5 (±6.32) | 42 (±6.34) | 11 (±5.22) | 0.67x |
| plain-slot | update:off | 16.7 (±7.78) | 43.7 (±9.56) | 16.5 (±1.77) | 0.99x |
| plain-slot | unmount | 17.9 (±0.78) | 17.9 (±3.04) | 17.7 (±0.91) | 0.99x |
| checkbox | mount | 458.8 (±29.73) | 739 (±43.56) | 411.8 (±64.95) | 0.90x |
| checkbox | update:on | 722 (±53.34) | 925.7 (±60.54) | 446.1 (±42.11) | 0.62x |
| checkbox | update:off | 642.1 (±25.73) | 864.5 (±89.46) | 377.4 (±28.53) | 0.59x |
| checkbox | unmount | 69.6 (±20.08) | 88.5 (±21.52) | 93.6 (±28.87) | 1.34x |
| collapsible | mount | 318.1 (±26.24) | 538.6 (±23.17) | 490.3 (±64.07) | 1.54x |
| collapsible | update:on | 434 (±32.83) | 572.5 (±61.63) | 419.8 (±14.18) | 0.97x |
| collapsible | update:off | 423.6 (±29.46) | 570.9 (±48.14) | 374.1 (±25.33) | 0.88x |
| collapsible | unmount | 50.5 (±6.44) | 70.4 (±11.57) | 68.6 (±5.4) | 1.36x |
| tabs | mount | 799.9 (±40.62) | 938.9 (±55.46) | 966.6 (±68.8) | 1.21x |
| tabs | update:on | 512.2 (±48.5) | 414 (±28.88) | 203.3 (±15.73) | 0.40x |
| tabs | update:off | 506 (±38.75) | 395.1 (±24.59) | 181.3 (±11.08) | 0.36x |
| tabs | unmount | 80.3 (±5.65) | 118.5 (±9.99) | 143.5 (±17.73) | 1.79x |
| dialog | mount | 17.4 (±0.32) | 17.5 (±0.4) | 17.4 (±0.46) | 1.00x |
| dialog | update:on | 17.7 (±0.52) | 17.5 (±0.42) | 17.3 (±0.42) | 0.98x |
| dialog | update:off | 17.7 (±0.37) | 17.2 (±0.37) | 17.2 (±0.33) | 0.97x |
| dialog | unmount | 17 (±0.43) | 17.5 (±0.64) | 16.9 (±0.3) | 0.99x |
| popover | mount | 17.7 (±0.48) | 17.6 (±1.07) | 17.5 (±0.46) | 0.99x |
| popover | update:on | 19.4 (±0.37) | 19.3 (±0.67) | 18.5 (±0.46) | 0.95x |
| popover | update:off | 16 (±0.83) | 16.1 (±0.65) | 16.2 (±0.53) | 1.01x |
| popover | unmount | 17.4 (±0.29) | 17.4 (±0.47) | 17.2 (±0.71) | 0.99x |

### Memory (JS heap after 2 forced GCs, median of 3 fresh pages, no throttling)

| Scenario (N) | VDOM bytes/instance | Vapor app + interop bytes/instance | Pure Vapor bytes/instance | VDOM residual after unmount, cycles 1/2/3 (KiB, first page) | Vapor app + interop residual after unmount, cycles 1/2/3 (KiB, first page) | Pure Vapor residual after unmount, cycles 1/2/3 (KiB, first page) |
|---|---|---|---|---|---|---|
| plain (1000) | 1671 | 4405 | 1690 | 221.3 / 242.2 / 264.9 | 230.2 / 259.4 / 275.3 | 165.5 / 192.6 / 212.4 |
| plain-slot (1000) | 2369 | 7175 | 2131 | 267.9 / 294.0 / 309.1 | 339.4 / 371.7 / 389.0 | 220.9 / 250.7 / 256.8 |
| checkbox (1000) | 21400 | 29703 | 29533 | 547.4 / 546.3 / 576.3 | 23046.9 / 45131.0 / 67215.1 | 806.7 / 836.5 / 862.8 |
| collapsible (500) | 30392 | 42101 | 42778 | 582.2 / 615.8 / 637.0 | 15814.8 / 30917.8 / 45704.9 | 807.4 / 983.6 / 1045.3 |
| tabs (200) | 142707 | 173464 | 206429 | 705.5 / 729.4 / 751.5 | 26495.7 / 52106.1 / 77970.2 | 1063.9 / 1161.7 / 1275.5 |

### Startup (4x CPU, 10 fresh pages each)

| Mode | navigation start → app mounted, median ms (min-max) | ready JS heap (KiB) |
|---|---|---|
| VDOM | 47.9 (42.7-55.7) | 1585.3 |
| Vapor app + interop | 50.1 (46.6-54.2) | 1681.1 |
| Pure Vapor | 47.1 (41.5-54.1) | 1614.0 |

### Sanity checks (elements rendered on first mount / content present after open)

| Scenario/mode | rendered | opened |
|---|---|---|
| plain/vdom | 1000 | - |
| plain/interop | 1000 | - |
| plain/vapor | 1000 | - |
| plain-slot/interop | 1000 | - |
| plain-slot/vapor | 1000 | - |
| plain-slot/vdom | 1000 | - |
| checkbox/vapor | 1000 | - |
| checkbox/vdom | 1000 | - |
| checkbox/interop | 1000 | - |
| collapsible/vdom | 500 | - |
| collapsible/interop | 500 | - |
| collapsible/vapor | 500 | - |
| tabs/interop | 600 | - |
| tabs/vapor | 600 | - |
| tabs/vdom | 600 | - |
| dialog/vapor | 1 | 1 |
| dialog/vdom | 1 | 1 |
| dialog/interop | 1 | 1 |
| popover/vdom | 1 | 1 |
| popover/interop | 1 | 1 |
| popover/vapor | 1 | 1 |

## 5. Is the VDOM runtime gone from the pure Vapor bundle?

The same three builds were rebuilt **unminified** (`BENCH_MINIFY=false`) and the output
searched for VDOM renderer internals. Counts are occurrences in the single output chunk:

| Identifier | VDOM | Vapor app + interop | Pure Vapor |
|---|---|---|---|
| `baseCreateRenderer` | 3 | 4 | 1 (a code comment in `@vue/runtime-core`, not code) |
| `renderComponentRoot` | 4 | 4 | **0** |
| `createBlock` | 76 | 53 | **0** |
| `openBlock` | 99 | 62 | **0** |
| `createRenderer` | 4 | 4 | **0** |
| `function h(` | 1 | 1 | **0** |
| `cloneVNode` | 8 | 14 | 5 |
| `createAppAPI` | 2 | 3 | 2 |
| `createVaporApp` | 0 | 3 | 3 |
| `vaporInteropPlugin` | 0 | 3 | 0 |

The VDOM renderer (patch/diff, block tree, `h`) is not in the pure Vapor build.
39.0 KiB of `@vue/runtime-core` remains. That package also holds APIs both renderers
share, such as `watch`, lifecycle hooks and the app API. For example, `createAppAPI`
and `cloneVNode` are still present. We did not break this part down further.

Rendered size per package (KiB, unminified, from the build's per-module stats):

| Package | VDOM | Vapor app + interop | Pure Vapor |
|---|---|---|---|
| `@vue/runtime-vapor` | 0.3 | 282.3 | 209.7 |
| `@vue/runtime-core` | 120.7 | 146.7 | 39.0 |
| `@vue/runtime-dom` | 15.1 | 14.8 | 6.8 |
| `@vue/reactivity` | 52.7 | 53.9 | 51.9 |
| `@vue/shared` | 10.7 | 12.3 | 9.4 |
| Reka UI source | 170.5 | 170.5 | 179.4 |
| bench app | 26.7 | 25.0 | 25.0 |
| Floating UI (core/dom/utils/vue) | 52.4 | 52.4 | 52.4 |
| VueUse (core/shared) | 13.1 | 13.1 | 13.1 |
| aria-hidden, ohash, vue | 7.8 | 7.8 | 7.9 |

The pure Vapor build is larger than the VDOM build (+13.9 KiB gzip for this app)
because `@vue/runtime-vapor` 3.6.0-rc.15 alone (209.7 KiB unminified) is bigger than
the VDOM build's `runtime-core` + `runtime-dom` combined (135.8 KiB). Compiled Vapor Reka components are also slightly bigger:
+8.9 KiB unminified, including the swap modules. The interop build is the largest,
+38.7 KiB gzip over VDOM, because it ships both runtimes.

## 6. Reading the results

- **Updates are where pure Vapor wins**, by 0.26x to 0.75x of VDOM `script` time on
  every list scenario (Tabs ≈ 3.7x faster, Checkbox 1.5-2x, Collapsible ≈ 1.35x). The
  Vue-only `plain`/`plain-slot` controls show the same direction (0.32-0.52x), so this is Vue
  Vapor's gain carried through Reka.
- **Mount and unmount are mixed or slower.** Checkbox mount is about the same as VDOM
  (0.90x). Collapsible mount is 1.66x and Tabs mount 1.21x, and unmount is 1.35-1.80x.
  The `plain` controls mount at VDOM speed in Vapor (0.96x), so the extra cost is in
  Reka's Vapor path, not in Vue. Likely contributors, **not profiled yet**:
  - the per-instance `as-child` applier and its watchers in `Primitive.vapor.vue`;
  - `exposeRootElement()` on every component;
  - the Collection registration in `Collection.vapor.ts`.

  These are the first optimisation targets.
- **Vapor app + interop (today's path for Vapor users) is the slowest mode** for
  Checkbox and Collapsible mount (Tabs mount: tied with pure Vapor, 870 vs 873 ms), and
  for updates in Checkbox and Collapsible. Even the
  Reka-free `plain` control is 2-4x slower there, because every VDOM component costs
  an interop crossing.
- **Overlays (1 instance)** are within a few ms in every mode. On `frame` they all
  land within one frame (≈17 ms), so there is no user-visible difference.
- **Memory per instance**: pure Vapor uses about 0.9-1.0x of VDOM on the Reka-free
  controls, but 1.38x (Checkbox), 1.41x (Collapsible) and 1.45x (Tabs) with Reka.
  This is the same signal as mount: Reka's Vapor path holds more per instance than
  Vue's Vapor runtime needs.
- **Startup**: the medians are within 3 ms of each other (47.1-50.1 ms); the ranges
  overlap. Ready heap: VDOM 1585 KiB, pure Vapor 1614 KiB, interop 1681 KiB.

## 7. Interop memory leak (found by the benchmark, pre-existing)

In the **Vapor app + interop** mode, residual heap after unmount grows linearly with
every mount/unmount cycle. In the latest run that is about 22 MiB per cycle for 1000
Checkboxes, 15 MiB for 500 Collapsibles and 25 MiB for 200 Tabs. VDOM and pure Vapor
stay at or below 1.3 MiB, with only small growth between cycles.

Bisection with probe components, all mounted 1000× from a Vapor parent in the
interop build (`raw/bench-leak-probes.json`, `raw/probe-*.json`). Residual is in KiB
after cycles 1/2/3:

| Probe (VDOM component inside a Vapor app) | Residual KiB 1 / 2 / 3 | Leaks? |
|---|---|---|
| `plain` (button, no Reka) | 230 / 259 / 275 | no |
| `plain-slot` | 353 / 377 / 382 | no |
| `plain-fragment` | 246 / 269 / 275 | no |
| `plain-vmodel` (`useVModel`) | 225 / 246 / 249 | no |
| `plain-onupdated` (`onUpdated` hook) | 236 / 266 / 281 | no |
| `plain-fnref` (function ref + replaced `instance.exposed`) | 236 / 267 / 282 | no |
| Reka `Primitive` | 397 / 443 / 447 | no |
| Reka `Primitive as-child` | 422 / 464 / 472 | no |
| Reka `VisuallyHidden` | 493 / 544 / 548 | no |
| Reka `CheckboxRoot` | 13755 / 26708 / 39738 | **yes**, ≈13 KiB per instance per cycle |
| `plain-expose` (Reka `useForwardExpose`, this branch) | 4479 / 8589 / 12719 | **yes**, ≈4 KiB per instance per cycle |
| `plain-expose-original` (verbatim `useForwardExpose` from `a9873a0`) | 4483 / 8602 / 12742 | **yes**, same as above |

The same probes in the VDOM build do not grow: CheckboxRoot gives 477 / 471 / 491
KiB, and `plain-expose` 256 / 272 / 292.

Conclusion:
- The leak reproduces with the **unmodified upstream** `useForwardExpose`, so this
  branch did not cause it.
- It needs the combination useForwardExpose does: a `computed` over the forwarded ref,
  plus `onUpdated`, plus a function ref, inside a VDOM component under a Vapor parent.
  Each of those parts alone (the `plain-onupdated` and `plain-fnref` probes) does not
  leak.
- The root cause was **not identified**. It could be in Vue's interop teardown
  (vuejs/core) rather than in Reka. A minimal reproduction against plain Vue 3.6 is the
  next step before reporting it anywhere.
- Pure Vapor Reka (this branch) does not leak.

## 8. Caveats

- One machine, a shared VM, one full run (plus an earlier full run on slightly older
  branch code, `raw/bench-full.json`, which gives the same picture within noise).
- No paint tracing; `frame` is rAF + timeout, not krausest's paint duration.
- jsdom is not used for any number here.
- 4x throttling raises absolute times; ratios are the useful part.
- The Checkbox pure-Vapor mount had a high spread in the earlier run (±161 ms). In
  this run it was ±62 ms.
- The dialog/popover `update` ops include Floating UI and focus work, which is
  mode-independent.
- Vue 3.6 is a release candidate; runtime-vapor size and speed may still change.

## 9. How others benchmark (research behind the metric choice)

- **js-framework-benchmark (krausest)**: create/replace/partial update/select/swap/
  remove/clear rows, startup, ready/run memory, byte weight; Chrome trace to paint;
  CPU throttling for some ops. https://github.com/krausest/js-framework-benchmark
- **Vue core** (`packages-private/benchmark` at `v3.6.0-rc.15`, read in `refs/vue-core`):
  puppeteer + Chrome, 4x CPU throttling, warmup 5, count 30, times each op to
  `nextTick`, and reports min/max/mean/std/median. Our `script` timer and statistics
  follow it.
- **Zag.js** v1 migration guide: mount and update phases measured on 10k instances.
- **nicodevs/demo-vue-memory-usage**: CDP forced GC + `JSHeapUsedSize`, the same
  memory method used here.
- **vuetify0**: `vitest bench` for composables, plus a happy-dom interop-overhead test
  in `tests/vapor` ("trust the ratios, not the absolute numbers").
- **Base UI** (PR mui/base-ui#3342): shared in-browser harness with
  MutationObserver-based timing; maintainers prefer not to gate CI on perf numbers.
- **icy.dev, "The Vapor tax"** (Vue 3.6 rc.5): about 20% faster updates and
  bundle-size observations, which match the direction found here.
- No benchmark directory was found in the cloned Bits UI, Melt UI, Kobalte, Ark UI,
  Zag or vael-ui repositories (`refs/`), and web searches found no benchmark suites
  for Radix, Naive UI or PrimeVue.
