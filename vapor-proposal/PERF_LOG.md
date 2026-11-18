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
