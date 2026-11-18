# Reka's full test suite under pure Vapor

Status: **plan written first (this section), results appended below as they come in.**
Branch: `feat/vapor-full-suite` (worktree `wt-suite`), based on `feat/vapor-support`.
Decisions taken while doing this are `ADR-S*` entries in `DECISIONS.md`; questions for
the maintainers are `QS*` entries in `OPEN_QUESTIONS.md`.

## Goal

Run the existing `packages/core/src/**/*.test.ts` files (the ~3,544-test jsdom suite,
not the `*.browser.test.ts` files) in **pure Vapor**: every SFC (Reka's components *and*
the tests' `story/*.vue` fixtures) compiled with the Vapor compiler, mounted with
`createVaporApp`, no `vaporInteropPlugin`, no VDOM render path. Then fix what fails in
Reka source, without touching the VDOM suite's results.

The test files themselves are **not edited**. Everything mode-specific lives in the
harness, so the same files keep running unchanged in VDOM mode.

## Hypothesis: how the suite can run unchanged

The suite talks to Vue through four surfaces. Each gets a Vapor-mode substitute:

| Surface used by tests | Files | Vapor substitute |
|---|---|---|
| SFCs (`story/_X.vue`, Reka components) | all | `@vitejs/plugin-vue` with `features.vapor: true` plus the existing `rekaVaporSwap()` (Primitive/Slot/Presence/Collection twins, `$el` injection, VueUse shim) |
| `@vue/test-utils` `mount()` and wrappers | 122 | `suite/test-utils.ts`: same API, built on `createVaporApp` + `createComponent`. DOM methods (`find`, `trigger`, `setValue`, `attributes`, `html`, ...) are VTU's own `BaseWrapper`/`DOMWrapper`, which only touch the DOM. Component methods (`props`, `setProps`, `emitted`, `vm`, `findComponent`, `unmount`) are reimplemented on Vapor instances and blocks. |
| `@testing-library/vue` `render()` / `fireEvent` | 45 | `suite/testing-library.ts`: the same 60 lines as the real package, on top of the shim `mount()`; queries come from `@testing-library/dom` unchanged |
| Inline components: `defineComponent({ template: '...' })` | 42 | `suite/inlineTemplates.ts`: a Vite transform that compiles literal `template:` strings in test files with the **Vapor** template compiler at build time and attaches the result as `render` (Vapor components accept `setup()` + `render(ctx)`) |
| Inline components: render functions with `h()` | ~54 | **No substitute.** `h()` creates VNodes; there is no VNode renderer in pure Vapor. These are classified, not faked (see below) |

Hypotheses to verify with the baseline:

1. Most failures will come from the harness (missing wrapper features) rather than
   Reka. Harness gaps are fixed in the harness; only real component misbehaviour is
   fixed in Reka source.
2. Tests that mount story SFCs are the meaningful signal and should pass at a high rate,
   given the 47/48 family scenarios already pass.
3. Render-function tests, VNode-introspection tests (`findComponent` by VNode tree,
   `stubs`, snapshotting VDOM comment anchors) and SSR tests (`renderToString`) are
   structurally VDOM-bound.

## Classification of tests that cannot run meaningfully

Every non-passing test ends up in exactly one bucket, listed per file in the table:

| Bucket | Meaning | Action |
|---|---|---|
| `pass` | Passes under pure Vapor | none |
| `fail:reka` | A Reka behaviour difference in Vapor | fix in Reka source |
| `fail:harness` | The shim does not emulate something yet | fix in the harness |
| `vdom-api` | The test builds VNodes (`h()`, render functions, `cloneVNode`), uses VTU `stubs`/`shallow`, or inspects VNode internals | listed with the reason; port to SFC fixtures is an open question (QS2) |
| `ssr` | Uses `renderToString`/hydration | out of scope: Vapor SSR is a separate target (Q11) |
| `env` | Depends on the test environment rather than the render mode (type-check/build tests) | listed; run in VDOM only |

A test is only put in a non-`pass` bucket after its failure was read; the bucket and
reason come from the actual error, not from grepping the file.

## How to run

```sh
cd packages/vapor
pnpm test:full-suite             # vitest -c vitest.suite.config.ts
node suite/report.mjs            # per-file table from the JSON report
```

---
## What the harness ended up being

The plan held, with two additions found while getting the first file to run:

- **`@iconify/vue`** (used by 93 story fixtures for decoration) is an Options-API VDOM
  component. It is aliased to `suite/IconStub.vue`, a Vapor SFC rendering the same empty
  placeholder `<svg>` Iconify renders in jsdom (no icon data offline). ADR-S03.
- **Render-function bridge** (`suite/vaporH.ts`). The first baseline showed 754 tests
  (41 files) blocked only because their *scaffolding* is an `h()` render function. Test
  files now import a `vue` (`suite/vue-test.ts`) whose `h()` returns plain descriptors
  and whose `defineComponent()` turns render-function components into Vapor components.
  Descriptors are mounted with Vapor's public runtime (`createComponent`, `insert`,
  `remove`, `setDynamicProps`) and diffed by position/`key` on re-render, so Reka
  components keep their state. Reka's components below the scaffolding are untouched
  Vapor components. ADR-S04, and QS1 asks whether this is acceptable long term.
- Dynamic `template:` strings (built at runtime) are compiled at mount time with the
  Vapor template compiler (`suite/runtimeTemplate.ts`), the Vapor equivalent of VTU's
  runtime compile. Literal ones are compiled at build time (`suite/inlineTemplates.ts`).
- `emitted()` records through Vue's devtools hook, exactly like VTU, which Vapor's
  `emit` also reports to.
- `@vue/server-renderer` is aliased to a stub that throws, so SSR tests are classified
  `ssr` instead of failing with Vapor-vs-SSR-renderer noise.

Files: `packages/vapor/vitest.suite.config.ts`, `packages/vapor/suite/*`.

## Baseline (2026-11-18, before any Reka fix)

Same 130 files and 3,583 tests as the VDOM run of the same commit
(`packages/core`, `vitest run`: 3,548 passed, 35 skipped, 0 failed). The 35 skipped
are `it.skip` in the source in both modes.

| Run | Pass | Fail | Skip (source `it.skip`) |
|---|---:|---:|---:|
| VDOM (reference) | 3,548 | 0 | 35 |
| Pure Vapor, first harness (VTU shim only, no bridge) | 2,422 | 1,110 (+1 file failed to load) | 35 |
| Pure Vapor, harness with render-function bridge | 2,938 | 610 | 35 |

