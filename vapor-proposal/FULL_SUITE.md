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
| `vdom-api` | The test builds VNodes (`h()`, render functions, `cloneVNode`), uses VTU `stubs`/`shallow`, or inspects VNode internals | **superseded (r5):** each such test now has a Vapor variant in the test file (`isVapor`, QS6) or harness support; none are left |
| `ssr` | Uses `renderToString`/hydration | **superseded (r5):** run through Vapor SSR + Vapor hydration (see "Vapor SSR"); none are cannot-run |
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

## Current status (runs r5/r6, 2026-11-18, Asia/Tehran)

**r6: 3316 pass / 232 fail / 35 skip** (3583 tests, 130 files), up from 2938 / 610 at
the baseline (r1), 3105 / 443 at the triage (r2), 3230 / 318 after Vapor SSR (r3/r4),
and 3304 / 244 after the harness and test variants (r5). r4 → r5 fixed 72 tests and r5 → r6
(`useFormControl`, ADR-S15) fixed 12; neither broke any (`diff.mjs`). VDOM suite unchanged: 3548 pass /
35 skip. **Nothing is in `cannot-run` any more**: the 170 tests that were there are
now run in Vapor, either through harness support or through a Vapor variant in the
test file (`isVapor`, QS6). No test uses `skipIf(isVapor)` yet: every inherently
different test so far had a Vapor equivalent.

| Former cannot-run group | Tests | How it runs in Vapor now | r5 |
|---|---|---|---|
| C1 SSR `renderToString` + hydration | 127 | Vapor SSR: server-compiled Reka + `createVaporSSRApp` hydration (below); Vapor template fixtures where the VDOM test used `h()` | 124 pass, 3 fail (S1–S3) |
| C2 Options-API `render()` with `this` (Toast) | 20 | harness: `this` is a stand-in for the public instance (ADR-S11) | 19 pass, 1 fail (U9, real) |
| C3 `global.stubs` (Combobox, RovingFocus, Tooltip) | 18 | harness: compiled `createComponent*` calls resolve stubs per app (ADR-S12) | stubs work; remaining fails are R1/U9 |
| C4 `wrapper.setData` (Form) | 1 | harness: `data()`/`methods` folded into setup state, `setData` merges (ADR-S11) | pass (Form 141/141) |
| C5 `vm.$.subTree.el` (Toast) | 2 | test variant: the Vapor instance's root block must be that one element | pass |
| C6 VDOM-instance helper tests (instance.test) | 2 | test variants: `isVaporInstance(seen) === isVapor`; the test also restores the resolver it replaces | pass |
| M1 markup-only | 19 | test variants: `expectMarkupSnapshot` / `modeMarkup` compare modulo anchors (ADR-S13) | 18 pass, 1 is really Presence U9 |

### Vapor SSR: what upstream supports (verified in refs/vue-core = 3.6.0-rc.15)

- Server: the *same* SFC compiled with `compileScript(…, { vapor: true, inlineTemplate: true,
  templateOptions: { ssr: true } })` emits `defineComponent({ __vapor: true, … })` with an
  `ssrRender`; it is rendered by the normal `@vue/server-renderer` `renderToString` in a
  `createSSRApp` (runtime-core instances). Evidence: `compiler-sfc/src/compileScript.ts`
  L1195 ("in SSR, always use defineComponent, so __vapor flag is required"),
  `compileTemplate.ts` L244 (`vapor: ssr && vapor`), `server-renderer/src/render.ts`
  L150–230 (Vapor slot outlets on the server).
- Client: `createVaporSSRApp(comp).mount(container)` hydrates
  (`runtime-vapor/src/apiCreateApp.ts` L151). Vue's own tests do exactly this pair:
  `runtime-vapor/__tests__/hydration/_helpers.ts` (`testHydration`, L116–170).
- Async components: `defineAsyncComponent` on the server, `defineVaporAsyncComponent`
  on the client (`hydration/asyncComponent.spec.ts` L45, "use defineAsyncComponent in SSR").

### How the harness does it (`packages/vapor/suite/ssr.ts`, `ssrTwins.ts`)

- `renderToString(app)` renders a **server twin** of the test's component: a `vssr:`
  module graph in which every Reka `.vue` (and every `.ts` that reaches one) is
  compiled for the server as above. Plain composables are shared with the client
  graph, like in Reka's VDOM SSR tests. Literal `template:` fixtures in test files
  get an `__ssrRender` at build time; runtime strings are compiled on demand.
- `createSSRApp(comp).mount(el)` is `createVaporSSRApp` on the client component.
- An `h()` component cannot be server-rendered or hydrated by Vapor (there is no
  VNode format for either), so such SSR fixtures got Vapor template variants in the
  test files (useRenderedContentId, useContentId, useTriggerId, Tabs, Accordion,
  Rating, Dialog.ssr, DismissableLayer.ssr, useForwardExpose.ssr, Popover.ssr).
- A setup hook preloads the server graph for files that call `renderToString`
  (compiling it took longer than the 5 s test timeout on first use).

### The 3 SSR failures left

- **S1 Dialog.ssr** (harness): the test's `vi.mock('@/shared/useBodyScrollLock')`
  applies by resolved id, and the server twin of that module (it imports
  ConfigProvider.vue) has another id. The mock factory runs, but only the client uses it.
- **S2 Popover.ssr** (harness, suspected): "Maximum call stack size exceeded" after
  `vi.resetModules()`, which re-evaluates the inlined `vue` and gives two Vue copies. Not
  yet confirmed.
- **S3 Tabs "keeps the default output"** (Reka): the hydrated markup matches, but the
  *server* markup lacks the attrs an as-child Primitive puts on its slotted element
  (`tabindex`, `style`, `data-orientation`, `dir` on the tablist;
  `data-reka-collection-item`, `tabindex`, `data-active` on the buttons). The Vapor
  Primitive applies them to DOM nodes, which only exist on the client. Tried: keeping
  the VDOM `Primitive.ts`/`Slot.ts` on the server (Vapor SSR slots do carry a VNode
  fallback branch, so `cloneVNode` could work), but the markup was unchanged, so the
  attrs are also lost before Primitive. Not solved; see QS7.

### Triage of the 232 (r6)

| File | fail:reka | fail:harness | markup-only | cannot-run | undiagnosed | total |
|---|---|---|---|---|---|---|
| AlertDialog/AlertDialog.test.ts |  |  |  |  | 1 | 1 |
| Checkbox/Checkbox.test.ts | 1 |  |  |  |  | 1 |
| Combobox/Combobox.test.ts | 13 |  |  |  | 10 | 23 |
| DateField/DateField.test.ts |  |  |  |  | 1 | 1 |
| Dialog/Dialog.ssr.test.ts |  | 1 |  |  |  | 1 |
| Dialog/Dialog.test.ts | 3 |  |  |  | 2 | 5 |
| DismissableLayer/DismissableLayer.test.ts |  | 3 |  |  |  | 3 |
| DropdownMenu/DropdownMenu.test.ts | 4 |  |  |  | 1 | 5 |
| FocusScope/FocusScope.test.ts |  |  |  |  | 1 | 1 |
| Listbox/Listbox.test.ts | 8 |  |  |  |  | 8 |
| Menubar/Menubar.test.ts | 4 |  |  |  | 1 | 5 |
| NavigationMenu/NavigationMenu.test.ts |  | 5 |  |  |  | 5 |
| Popover/Popover.ssr.test.ts |  | 1 |  |  |  | 1 |
| Popover/Popover.test.ts |  |  |  |  | 3 | 3 |
| Popper/PopperRootContext.test.ts |  | 1 |  |  |  | 1 |
| Presence/Presence.test.ts |  |  | 1 |  | 3 | 4 |
| Primitive/Primitive.test.ts | 4 |  |  |  |  | 4 |
| Primitive/usePrimitiveElement.test.ts | 3 |  |  |  |  | 3 |
| RadioGroup/RadioGroup.test.ts |  | 1 |  |  |  | 1 |
| RovingFocus/RovingFocus.test.ts |  |  |  |  | 1 | 1 |
| ScrollArea/ScrollArea.test.ts | 8 | 3 |  |  |  | 11 |
| Select/Select.test.ts | 7 |  |  |  |  | 7 |
| Slider/Slider.test.ts |  | 6 |  |  | 2 | 8 |
| Stepper/StepperAnnouncement.test.ts |  |  |  |  | 4 | 4 |
| Tabs/Tabs.test.ts | 5 |  |  |  |  | 5 |
| TagGroup/TagGroup.test.ts |  |  |  |  | 1 | 1 |
| Toast/Toast.test.ts |  |  |  |  | 1 | 1 |
| Toggle/Toggle.test.ts | 1 |  |  |  |  | 1 |
| Tooltip/Tooltip.test.ts |  |  |  |  | 3 | 3 |
| Tree/Tree.test.ts | 6 |  |  |  |  | 6 |
| VisuallyHidden/HiddenNativeLabels.test.ts |  | 1 |  |  |  | 1 |
| shared/useContentId.test.ts | 4 |  |  |  |  | 4 |
| shared/useForwardExpose.test.ts | 9 |  |  |  |  | 9 |
| shared/useForwardScopeId.test.ts | 3 |  |  |  |  | 3 |
| shared/useRenderedContentId.test.ts | 0 |  |  |  | 0 | 0 |
| shared/useTriggerId.test.ts | 6 |  |  |  |  | 6 |
| **total** | 89 | 22 | 1 | 0 | 35 | 147 |

| Root cause | Bucket | Tests | Files |
|---|---|---|---|
| H1 findComponent(css selector) not implemented | fail:harness | 0 | Fixed (ADR-S21) |
| H2 findComponent(Component) finds nothing (empty VueWrapper) | fail:harness | 0 | Fixed (ADR-S21) |
| H3 vm / exposed access through the shim (`vm.field`, `vm.form`, refs, proxy set) | fail:harness | 1 | RadioGroup 1 |
| H4 real VNode reached the render-function bridge | fail:harness | 1 | HiddenNativeLabels 1 |
| M1 html()/snapshot differs only by Vapor anchor comments (<!--slot-->, <!--if-->, <!--dynamic-component-->) and attribute order | markup-only | 1 | Presence 1 |
| R1 virtualizer item refs ($el of undefined) — known gap ADR-017 | fail:reka | 0 | Fixed (ADR-S21) |
| R2 consumer listeners run after the component's own handlers (preventDefault opt-out ignored) | fail:reka | 18 | Select 7, DropdownMenu 4, Menubar 4, Tabs 3 |
| R3 form-control detection: closest('form') read before the element is inserted into <form> | fail:reka | 2 | Checkbox 1, Toggle 1 |
| R4 consumer id / trigger id change not propagated (remaining after fix #1) | fail:reka | 11 | useTriggerId 6, useContentId 4, Tabs 1 |
| R5 as-child / element resolution (Primitive, usePrimitiveElement, useForwardExpose) | fail:reka | 16 | useForwardExpose 9, Primitive 4, usePrimitiveElement 3 |
| R6 scope-id forwarding (useForwardScopeId) | fail:reka | 3 | useForwardScopeId 3 |
| R7 unmountOnHide=false content not hidden (v-show/display on persistent content) | fail:reka | 5 | Dialog 3, Combobox 2 |
| S1 Vapor SSR: vi.mock() does not reach the server-compiled copy of a module (Dialog.ssr, useBodyScrollLock) | fail:harness | 1 | Dialog.ssr 1 |
| S2 Vapor SSR: vi.resetModules() reloads the inlined vue, stack overflow (Popover.ssr, suspected) | fail:harness | 1 | Popover.ssr 1 |
| S3 Vapor SSR: as-child attrs are applied on the client only, missing from server markup (QS7) | fail:reka | 1 | Tabs 1 |
| U1 useRenderedContentId: KeepAlive deactivation (bridge KeepAlive vs Reka onDeactivated) | undiagnosed | 0 | Fixed (ADR-S20) |
| U2 useRenderedContentId: as-child content with no element | undiagnosed | 0 | Fixed (ADR-S20) |
| U9 other (to investigate one by one) | undiagnosed | 35 | Combobox 10, StepperAnnouncement 4, Popover 3, Presence 3, Tooltip 3, Dialog 2, Slider 2, AlertDialog 1, DateField 1, DropdownMenu 1, FocusScope 1, Menubar 1, RovingFocus 1, TagGroup 1, Toast 1 |

## Triage of the 610 failures (run r1 → r2, 2026-11-18)

Requested before fixing further: every r1 failure sorted into **fail:reka**,
**fail:harness** or **cannot-run-in-vapor**, by root cause and by component.
The rules are in `packages/vapor/suite/triage.mjs` (`node suite/triage.mjs <vitest-json> <out.json>`), and each one was set
by reading the error and the test, not by grepping file names. Where a cause is not yet
proven, it is marked `undiagnosed` rather than guessed.

Mapping to the buckets above: `cannot-run` = `ssr` (C1) + `vdom-api` (C2–C6).
`markup-only` is new. It means the DOM is right and the serialised HTML differs only
by Vapor's anchor comments and attribute order. Whether the harness should normalise
those is an open question (QS5), so these tests are not yet counted as either pass or fail.

### Where the 610 went

r1 reported 610 failures, which is 603 unique test names: 7 `it.each` names repeat.
Without changing any test, harness fixes and Reka fixes were then attributed separately.
To do that, the suite was re-run with the harness fixes only (r2h: 3,080 pass / 468 fail),
then with the Reka fixes as well (r2: **3,105 pass / 443 fail / 35 skip**). No test
went from pass to fail in either step.

| Fixed between r1 and r2 | Bucket | Tests | Files |
|---|---|---:|---|
| `emitted()` empty: runtime-core re-reads `__VUE_DEVTOOLS_GLOBAL_HOOK__` on app creation and dropped the shim's hook | fail:harness | 65 | ComboboxClearValue 14, Listbox 7, useForwardProps 7, Accordion 6, PinInput 6, Autocomplete 5, DismissableLayer 5, NumberField 3, TagsInput 3, Combobox 2, Drawer 2, Collapsible 1, Menu 1, Rating 1, Select 1, Splitter 1 |
| Second `unmount()` threw (`reading 'suspense'`). VTU only warns, so the shim's unmount is now idempotent | fail:harness | 54 | NumberField 46, Drawer 4, Popover 2, Combobox 1, ScrollAreaThumb 1 |
| Functional components: closure reassignment in the shim (`component is not a function`) | fail:harness | 16 | HiddenNativeLabels 12, HoverCard 2, Tooltip 2 |
| Reka: trigger never saw a consumer `id` change on content, because Vapor does not re-run a component when only a fallthrough attr changes (useTriggerId) | fail:reka | 25 (combined) | useRenderedContentId 10, usePrimitiveElement 6, useForwardExpose 6, useTriggerId 2, useContentId 1 |
| Reka: as-child Primitive did not follow a slot swapping its element (ref and attrs went stale) | fail:reka | (in the 25) | |
| Reka: `resolveElement` returned a non-Node for a Vapor ref with no `$el` (FocusScope crash) | fail:reka | (in the 25) | |
| **Total fixed** | | **160** (135 harness, 25 Reka) | |

### The 443 still failing (r2), by root cause

| Bucket | Tests |
|---|---:|
| cannot-run (SSR 127, VDOM-only API 43) | 170 |
| fail:reka | 116 |
| undiagnosed | 106 |
| fail:harness | 32 |
| markup-only (QS5) | 19 |

| Root cause | Bucket | Tests | Files |
|---|---|---|---|
| C1 SSR renderToString (Vapor SSR out of scope, Q11) | cannot-run | 127 | useRenderedContentId 102, useContentId 11, DismissableLayer.ssr 3, Tabs 3, useForwardExpose.ssr 2, useTriggerId 2, Accordion 1, Dialog.ssr 1, Popover.ssr 1, Rating.ssr 1 |
| C2 Options-API render() using `this` (VDOM-only API) | cannot-run | 20 | Toast 20 |
| C3 VTU global.stubs (Vapor resolves imported components at compile time) | cannot-run | 18 | Combobox 10, RovingFocus 4, Tooltip 4 |
| C4 VTU Options-API wrapper.setData | cannot-run | 1 | Form 1 |
| C5 VNode introspection (vm.$.subTree.el) | cannot-run | 2 | Toast 2 |
| C6 test asserts VDOM-instance behaviour of a helper | cannot-run | 2 | instance 2 |
| H1 findComponent(css selector) not implemented | fail:harness | 9 | Slider 6, DismissableLayer 3 |
| H2 findComponent(Component) finds nothing (empty VueWrapper) | fail:harness | 9 | NavigationMenu 5, ScrollArea 3, PopperRootContext 1 |
| H3 vm / exposed access through the shim (`vm.field`, `vm.form`, refs, proxy set) | fail:harness | 13 | Field 9, Form 1, RadioGroup 1, Splitter 1, instance 1 |
| H4 real VNode reached the render-function bridge | fail:harness | 1 | HiddenNativeLabels 1 |
| M1 html()/snapshot differs only by Vapor anchor comments (<!--slot-->, <!--if-->, <!--dynamic-component-->) and attribute order | markup-only | 19 | ScrollArea 5, Collapsible 4, Label 4, Avatar 2, AspectRatio 1, Popper 1, Presence 1, Tree 1 |
| R1 virtualizer item refs ($el of undefined) — known gap ADR-017 | fail:reka | 31 | Combobox 9, Listbox 8, ScrollArea 8, Tree 6 |
| R2 consumer listeners run after the component's own handlers (preventDefault opt-out ignored) | fail:reka | 18 | Select 7, DropdownMenu 4, Menubar 4, Tabs 3 |
| R3 form-control detection: closest('form') read before the element is inserted into <form> | fail:reka | 20 | Form 7, Toggle 4, Checkbox 3, RadioGroup 3, Switch 2, HiddenNativeLabels 1 |
| R4 consumer id / trigger id change not propagated (remaining after fix #1) | fail:reka | 20 | useRenderedContentId 9, useTriggerId 6, useContentId 4, Tabs 1 |
| R5 as-child / element resolution (Primitive, usePrimitiveElement, useForwardExpose) | fail:reka | 19 | useForwardExpose 9, Primitive 7, usePrimitiveElement 3 |
| R6 scope-id forwarding (useForwardScopeId) | fail:reka | 3 | useForwardScopeId 3 |
| R7 unmountOnHide=false content not hidden (v-show/display on persistent content) | fail:reka | 5 | Dialog 3, Combobox 2 |
| U1 useRenderedContentId: KeepAlive deactivation (bridge KeepAlive vs Reka onDeactivated) | undiagnosed | 51 | useRenderedContentId 51 |
| U2 useRenderedContentId: as-child content with no element | undiagnosed | 25 | useRenderedContentId 25 |
| U9 other (to investigate one by one) | undiagnosed | 30 | StepperAnnouncement 4, Popover 3, Presence 3, Combobox 2, Dialog 2, Field 2, PopperRootContext 2, Slider 2, useSize 2, AlertDialog 1, Checkbox 1, DateField 1, DropdownMenu 1, FocusScope 1, Menubar 1, RovingFocus 1, TagGroup 1 |


What the causes are, and why each is in its bucket:

- **C1 SSR**: `renderToString` and hydration. **Superseded:** Vapor has SSR and hydration,
  and these tests now run through it (see "Current status (run r5)").
- **C2 Options-API `render()` using `this`**: Toast fixtures. Vapor has no component proxy
  for `this` in `render`, so the test itself would have to change (QS2).
- **C3 `global.stubs`**: Vapor templates import components at compile time. There is no
  runtime component resolution to stub.
- **C4 `wrapper.setData`**, **C5 `vm.$.subTree.el`**, **C6 asserting VDOM
  `getCurrentInstance`/vnode-props behaviour**: VDOM-only APIs, so these are VDOM-only by
  definition.
- **M1 markup-only**: for example, AspectRatio's snapshot has the same elements and
  attributes plus `<!--slot-->`, `<!--if-->` and `<!--dynamic-component-->`, with `style`
  and `data-*` in a different order. This was checked for AspectRatio, Label and
  Collapsible; the other snapshots in M1 have the same shape. See QS5.
- **H1–H4 harness gaps**:
  - `findComponent('css')` is not implemented.
  - `findComponent(Comp)` misses some components (NavigationMenu, the ScrollArea
    virtualizer, PopperRootContext).
  - `vm`/exposed access through the shim (`vm.field`, `vm.form`, `exposed`, proxy `set`).
  - One test passes a real VNode into the bridge.
- **R1 virtualizers** (known, ADR-017): item component refs are read through `$el` on a
  VNode ref that Vapor does not provide.
- **R2 listener order**: consumer listeners (`onKeydown`, `onPointerdown`, …) reach the
  element *after* the component's own `@keydown`. The component's handler therefore runs
  first, and a consumer `preventDefault()` cannot opt out. VDOM merges attrs first.
  Select, DropdownMenu, Menubar and Tabs depend on that order.
- **R3 form detection**: `useFormControl` computes `el.closest('form')` from the element
  ref. In Vapor the ref is set before the component's nodes are inserted under the
  `<form>`, the computed caches `false`, and the hidden native input never renders.
- **R4**: consumer/trigger id changes still not propagated for some families
  (Popover/Menu/Menubar/Tabs trigger-id, and content-id for Collapsible/Accordion/Tabs).
  Fix #1 covered only part of this.
- **R5**: remaining as-child/element-resolution differences:
  - class merge order is `child parent` instead of `parent child`;
  - a comment/text-first fragment does not resolve to its first element;
  - forwarded refs on components without a single element root.
- **R6**: the scope id is not forwarded to multi-root components or through the
  RadioGroup and ToggleGroup items.
- **R7**: `unmountOnHide=false` content is not given `display: none` when it closes.
- **U1/U2** (useRenderedContentId, 76): KeepAlive deactivation, and as-child content
  rendering no element. Both fixtures go through the bridge
  (`h(KeepAlive, …)`, `h(content.type, {...content.props})`). Until a Vapor SFC repro
  shows whether the bridge or Reka is at fault, they are not counted as Reka failures.
- **U9** (30): single cases, printed by test name by `suite/triage.mjs`, to be
  read one by one.

### By component (r2)

| File | fail:reka | fail:harness | markup-only | cannot-run | undiagnosed | total |
|---|---|---|---|---|---|---|
| Accordion/Accordion.test.ts |  |  |  | 1 |  | 1 |
| AlertDialog/AlertDialog.test.ts |  |  |  |  | 1 | 1 |
| AspectRatio/AspectRatio.test.ts |  |  | 1 |  |  | 1 |
| Avatar/Avatar.test.ts |  |  | 2 |  |  | 2 |
| Checkbox/Checkbox.test.ts | 3 |  |  |  | 1 | 4 |
| Collapsible/Collapsible.test.ts |  |  | 4 |  |  | 4 |
| Combobox/Combobox.test.ts | 11 |  |  | 10 | 2 | 23 |
| DateField/DateField.test.ts |  |  |  |  | 1 | 1 |
| Dialog/Dialog.ssr.test.ts |  |  |  | 1 |  | 1 |
| Dialog/Dialog.test.ts | 3 |  |  |  | 2 | 5 |
| DismissableLayer/DismissableLayer.ssr.test.ts |  |  |  | 3 |  | 3 |
| DismissableLayer/DismissableLayer.test.ts |  | 3 |  |  |  | 3 |
| DropdownMenu/DropdownMenu.test.ts | 4 |  |  |  | 1 | 5 |
| Field/Field.test.ts |  | 9 |  |  | 2 | 11 |
| FocusScope/FocusScope.test.ts |  |  |  |  | 1 | 1 |
| Form/Form.test.ts | 7 | 1 |  | 1 |  | 9 |
| Label/Label.test.ts |  |  | 4 |  |  | 4 |
| Listbox/Listbox.test.ts | 8 |  |  |  |  | 8 |
| Menubar/Menubar.test.ts | 4 |  |  |  | 1 | 5 |
| NavigationMenu/NavigationMenu.test.ts |  | 5 |  |  |  | 5 |
| Popover/Popover.ssr.test.ts |  |  |  | 1 |  | 1 |
| Popover/Popover.test.ts |  |  |  |  | 3 | 3 |
| Popper/Popper.test.ts |  |  | 1 |  |  | 1 |
| Popper/PopperRootContext.test.ts |  | 1 |  |  | 2 | 3 |
| Presence/Presence.test.ts |  |  | 1 |  | 3 | 4 |
| Primitive/Primitive.test.ts | 7 |  |  |  |  | 7 |
| Primitive/usePrimitiveElement.test.ts | 3 |  |  |  |  | 3 |
| RadioGroup/RadioGroup.test.ts | 3 | 1 |  |  |  | 4 |
| Rating/Rating.ssr.test.ts |  |  |  | 1 |  | 1 |
| RovingFocus/RovingFocus.test.ts |  |  |  | 4 | 1 | 5 |
| ScrollArea/ScrollArea.test.ts | 8 | 3 | 5 |  |  | 16 |
| Select/Select.test.ts | 7 |  |  |  |  | 7 |
| Slider/Slider.test.ts |  | 6 |  |  | 2 | 8 |
| Splitter/Splitter.test.ts |  | 1 |  |  |  | 1 |
| Stepper/StepperAnnouncement.test.ts |  |  |  |  | 4 | 4 |
| Switch/Switch.test.ts | 2 |  |  |  |  | 2 |
| Tabs/Tabs.test.ts | 4 |  |  | 3 |  | 7 |
| TagGroup/TagGroup.test.ts |  |  |  |  | 1 | 1 |
| Toast/Toast.test.ts |  |  |  | 22 |  | 22 |
| Toggle/Toggle.test.ts | 4 |  |  |  |  | 4 |
| Tooltip/Tooltip.test.ts |  |  |  | 4 |  | 4 |
| Tree/Tree.test.ts | 6 |  | 1 |  |  | 7 |
| VisuallyHidden/HiddenNativeLabels.test.ts | 1 | 1 |  |  |  | 2 |
| shared/instance.test.ts |  | 1 |  | 2 |  | 3 |
| shared/useContentId.test.ts | 4 |  |  | 11 |  | 15 |
| shared/useForwardExpose.ssr.test.ts |  |  |  | 2 |  | 2 |
| shared/useForwardExpose.test.ts | 9 |  |  |  |  | 9 |
| shared/useForwardScopeId.test.ts | 3 |  |  |  |  | 3 |
| shared/useRenderedContentId.test.ts | 9 |  |  | 102 | 76 | 187 |
| shared/useSize.test.ts |  |  |  |  | 2 | 2 |
| shared/useTriggerId.test.ts | 6 |  |  | 2 |  | 8 |
| **total** | 116 | 32 | 19 | 170 | 106 | 443 |

Components that are not listed have no failing tests.

## Baseline after 0b2c515e (r9)

Recorded 2026-11-19 on clean `0b2c515e` (unified virtualizers via Primitive as-child v-for; commit body was empty — numbers live here).

| Run | Pass | Fail | Skip |
|---|---:|---:|---:|
| `pnpm test:run` (VDOM) | 3549 | 0 | 35 |
| Pure Vapor `test:full-suite` | 3504 | 45 | 35 |

Vapor package modes: `test:vdom` 51 pass; `test:interop` 116 pass + 2 expected fail; `test:vapor-only` 61 pass + 1 todo.

`shared/useRenderedContentId.test.ts`: **287 pass / 0 fail / 35 skip** (ADR-S20 still good).

The report at `36c0f04a` listed **3619** as “3483 + 101 + 35”; Vitest’s `numTotalTests` is **3584** (same as the VDOM suite). No test files changed between `36c0f04a` and `0b2c515e` (`git diff --stat` only touches virtualizer SFCs, twins, harness docs). The 35-gap is adding `skip` on top of pass+fail: 3483+101 already equals 3584.

`useRenderedContentId` triage at r9 (from `suite/out/report.json`): down from 76 undiagnosed at handoff r8 to 0 failures here; remaining reds are elsewhere (45 total fails — see `node suite/report.mjs suite/out/report.json`).
