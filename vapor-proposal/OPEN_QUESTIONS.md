# Open questions for the Reka maintainers

These are the decisions this proposal leaves to the Reka maintainers, or to Vue.
Each one lists the options, their trade-offs and our recommendation. Where the
prototype needed an answer to keep going, it uses a default marked
**⚑ Provisional default**, which is easy to change. Settled choices are in
`DECISIONS.md`.

## Packaging and naming of the pure-Vapor build

### Q1. Where do the Vapor-compiled components live?

| Option | Trade-offs |
|---|---|
| (a) `reka-ui/vapor` subpath in the same package | One version and one changelog. The bare `import 'reka-ui/vapor'` stays the interop opt-in. The package's `vue` range has to accommodate 3.6 (Q2). vael-ui does it this way (`vael-ui/vapor`). |
| (b) Separate package, e.g. `@reka-ui/vapor` | Its own release cadence while Vue 3.6 is prerelease, and its own `vue@^3.6` peer range. A second package to publish, and versions can drift. |
| (c) No compiled build: publish the swap plugin (e.g. `reka-ui/vite`) and compile from source | Least to maintain. Every app pays the compile cost, the package must ship `src`, and apps that do not use Vite need another plugin. |

**Recommendation:** (a) once Vue 3.6 is stable. Until then, (c) as an experimental
export, because it needs no extra build output.
**⚑ Provisional default:** (a), with the bare-import semantics (ADR-002/004). Only the
interop resolver entry is built today.

### Q2. The `vue` peer range

Reka supports Vue 3.4+. The Vapor entry needs `>=3.6.0-rc.15`: `currentInstance`, and
the interop fallthrough fix vuejs/core#15989.

- Keep one range, plus a runtime check in `instance.vapor.ts` that warns on older Vue.
  This is cheap, but users only find out at runtime.
- A separate package with its own range (Q1b). This is precise, but means another
  package.

**Recommendation:** one range plus the runtime warning, if Q1 is (a).
**⚑ Provisional default:** no check yet.

### Q3. One `reka-ui/vapor` entry, or per-component entries (`reka-ui/vapor/dialog`)?

Reka's ESM output already tree-shakes per component. Per-component entries make the
exports map larger and gain little. **Recommendation / ⚑ Provisional default:** one entry.

### Q4. Opt-in mechanism for interop users

| Option | Trade-offs |
|---|---|
| Side-effect import `import 'reka-ui/vapor'` | Explicit and tree-shakable. One line in `main.ts`. Depends on `sideEffects` being right (ADR-011). |
| Plugin `app.use(RekaVapor)` | Familiar. Needs the app instance, and it is still a separate import. |
| Auto-detect `createVaporApp` at runtime | Nothing for users to do. Every VDOM user would ship the internal import, and tree-shaking is lost. |

**Recommendation / ⚑ Provisional default:** the side-effect import.

### Q5. VueUse in Vapor components

VueUse 14/15 uses `getCurrentInstance()`, which is null in Vapor. The prototype
redirects VueUse's `vue` import to a shim (ADR-010).

- Keep the shim. It is build-time only, but it is magic.
- Ask VueUse to become Vapor-aware, so the shim goes away. This depends on Vue
  exposing a public accessor (Q6). No issue has been filed.
- Stop using VueUse's lifecycle helpers (`useMounted`, `tryOnMounted`,
  `useSupported`) inside Reka components. This changes many files.

**Recommendation:** keep the shim short-term, and raise the issue with VueUse.
**⚑ Provisional default:** the shim.

### Q6. Relying on the `@internal` `currentInstance`

- Accept it, guarded by the version range. It works today, but could break in a minor
  release.
- Ask Vue for a public, typed accessor for the current generic instance. This is the
  right fix, but the timeline is unknown.
- Use vuetify0's `__VUE_INSTANCE_SETTERS__` subscription. It only exists in some
  builds.

**Recommendation:** accept it now, and request a public API upstream.
**⚑ Provisional default:** the internal import (ADR-003).

### Q7. as-child precedence under interop

With `vaporInteropPlugin`, attrs passed through a VDOM Reka `Slot` onto Vapor slot
content follow fallthrough rules: the parent wins. Reka's rule is that the child
wins (ADR-016). Options:

- document the difference;
- ask Vue for "low-priority" `cloneVNode` extras on `VaporSlot` vnodes;
- point Vapor apps at the pure-Vapor build.

**Recommendation:** document it and recommend pure Vapor.
**⚑ Provisional default:** documented as `it.fails`.

**Related observation (round 2, PERF_LOG E8):** under interop, attrs that a Vapor parent puts
on Reka's VDOM `Presence` (`<Presence :present :data-tone="...">`) do not appear on the child
`Presence` renders. The pure-Vapor `Presence.vapor.vue` applies them. The root cause was not
investigated. It is probably the same interop fallthrough path as the precedence case above,
so it belongs in the same upstream report.

### Q8. Interop memory leak (pre-existing, `useForwardExpose` under a Vapor parent)

Found by the benchmark (`BENCHMARKS.md` §7). It reproduces with the unmodified
upstream composable. Options:

- build a minimal reproduction with plain Vue 3.6 and, if it reproduces, report it to
  vuejs/core;
- work around it in Reka, for example by restructuring the `computed` + `onUpdated`
  pair, before the root cause is known;
- only document it.

**Recommendation:** the reproduction first. Nothing has been posted (local-only work).
**⚑ Provisional default:** documented only.

### Q9. Virtualizers (Listbox, Tree, ScrollArea, Combobox)

- (a) A single-source rewrite on `<Slot v-for>`. This changes VDOM `ref` handling
  slightly.
- (b) A composable plus two thin templates (VDOM `cloneVNode`, Vapor `Slot` loop). VDOM
  output stays byte-identical, and there is one more swap entry each.

**Recommendation:** (b). **Status:** not done. The pure-Vapor gap is ListboxVirtualizer.

### Q10. Explicit `exposeRootElement()` vs build-time injection

The swap plugin injects the call into every SFC (ADR-007).

- Keep the injection: zero source churn, but invisible.
- Call it from `useForwardExpose` (used in 247 files) and explicitly in the components
  that don't use it: visible, but it touches source files.
- Ask Vue to expose `$el` on Vapor component refs.

**Recommendation:** move the call into `useForwardExpose`, and keep the injection only
for components that don't use it.
**⚑ Provisional default:** injection.

### Q11. Vapor SSR / hydration

Untested. Attrs applied on mount by `asChildAttrs.ts` are not in the server HTML. This
needs either a Vue API for pure-Vapor slot-root fallthrough, or the slot-props escape
hatch (strategy F). See also vuejs/core#16269.
**Recommendation:** declare Vapor SSR unsupported in the first release.

## Benchmark tooling and CI

### Q12. What runs in CI?

On shared runners, timings are noisy. Base UI's maintainers describe infra perf tests
as "good for monitoring long-term trends, but definitely not for determining perf
issues in a single PR".

**Recommendation:**
- CI: the four-mode family tests, the compile-all check, the consumer `sideEffects`
  check, and the deterministic bundle checks (size budget, and "no VDOM renderer in
  the pure Vapor bundle").
- Nightly or on demand: the timings, with results kept as artifacts.

**⚑ Provisional default:** nothing in CI. `packages/vapor` is not part of the default
test run.

### Q13. Harness choice

- (a) Playwright + Chrome on a built app. This is the prototype: real layout, CPU
  throttling, CDP heap.
- (b) `vitest bench` (tinybench) in jsdom or happy-dom. Fast, but no layout, and a
  different runtime. vuetify0 uses it for composables.
- (c) A krausest-style Chrome trace to paint. Most faithful, most work.

**Recommendation / ⚑ Provisional default:** (a). (c) could replace the in-page
timers later.

### Q14. Which components, how many instances, how many samples?

Today:
- Checkbox ×1000, Collapsible ×500, Tabs ×200;
- Dialog and Popover open/close;
- Reka-free `plain` controls;
- 4x CPU, 3 warmup + 10 runs. A full run takes about 5 minutes on the box.

Vue core uses 5 warmup + 30 runs. Menus, Select, Combobox and the virtualizers would
round out the components.

**Recommendation:** add Select and Combobox, and use 5 + 30 runs on a dedicated
machine. **⚑ Provisional default:** the current set.

### Q15. Pure-Vapor mount/unmount and memory are worse than VDOM. Ship anyway?

Pure Vapor updates are 0.26–0.75x of VDOM time. However:
- mount is up to 1.66x and unmount up to 1.80x of VDOM time;
- memory per instance is 1.38–1.45x.

The Reka-free controls show no such cost, so it is Reka's Vapor path (applier,
`exposeRootElement`, Collection). Options:

- ship as experimental now and optimise later;
- profile and optimise before shipping.

**Recommendation:** ship it as experimental, label the trade-off, and profile the
`as-child` applier first.

### Q16. Pure-Vapor bundle size is set by Vue, not by Reka (upstream ask)

PERF_LOG P2 found that no VDOM renderer leaks into the pure-Vapor bundle. The +13.9 KiB gzip over
VDOM comes from `@vue/runtime-vapor` 3.6.0-rc.15. It keeps its hydration, interop, KeepAlive,
Suspense and Transition paths behind **runtime** flags (`let isInteropEnabled`, …), and those
paths still reference `runtime-core` VNode helpers. The Reka side adds +8.9 KiB of compiled
templates, unminified.

Options:
- Ask Vue for compile-time feature flags, in the style of `__VUE_OPTIONS_API__`, so that apps
  without SSR or interop can drop that code. This is the biggest possible gain, but it is not in
  Reka's hands.
- Accept the size for now.

**Recommendation:** raise the flags with Vue (not filed; this work is local only), and accept
the size meanwhile.

### Q17. Bigger pure-Vapor perf levers that change behaviour (not decided here)

The profiles (PERF_LOG P1, P3, P4) point at costs that Reka could only remove by changing
behaviour or source used by both builds:

| Lever | Expected gain | Trade-off |
|---|---|---|
| Treat `as`/`asChild` as static in `Primitive.vapor.vue` (choose the branch once in setup) | one `createIf` + render effect less per `Primitive` (P3: 6 `DynamicFragment`s per Checkbox row) | toggling `as-child` or `as` at runtime would stop working in Vapor; VDOM supports it |
| Replace `toRefs(props)` in components with per-prop `computed`/getters | P1: `toRefs` costs 25 ms of self time in Vapor, against 9 ms in VDOM | touches many SFCs; this would be churn in the VDOM build too |
| Replace `inheritAttrs: false` + `v-bind="$attrs"` chains with direct fallthrough | fewer `collectProps`/`resolveDynamicProps` passes (P1: the largest Vue-internal cost) | changes attr precedence in some components; needs a per-component audit |
| ~~Move the Vapor branch of `useForwardExpose` into a Vapor-only module~~ **done in PERF_LOG E7b**: registered from `instance.vapor.ts` instead of swapped, so `reka-ui/vapor` consumers of the default dist get it too | VDOM −202 B gzip (98 B below B0); pure Vapor +39 B gzip | the shared prelude (`currentRef`/`currentElement`/`onUpdated`) now exists twice; keep `useForwardExpose.ts` and `useForwardExpose.vapor.ts` aligned |
| Drop the VueUse lifecycle helpers (`useMounted`, `tryOnMounted`) inside components | removes the shim (Q5), a little less work | source changes in both builds |

**Recommendation:** none of these for the first release. Revisit after Vue 3.6 is stable, using
the A/B harness (`PERF_LOG.md`).
**Decided (owner, 2026-11-19):** none for the first release — phase F is measure-only.

### Q18. Should Reka document `__VUE_OPTIONS_API__: false` for consumers? (PERF_LOG F1)

Reka does not use the Options API. No `data`/`methods`/`computed`/`watch` options, mixins,
`created` or `this.$` appear in `packages/core/src`; the four `defineComponent` render-function
modules use only `name`, `props`, `inheritAttrs` and `setup`. The pure-Vapor suite passes with
the flag off.

| Option | Effect | Trade-off |
|---|---|---|
| A. Say nothing | none | users who would like the ~1.5 KiB gzip VDOM/interop saving don't learn it is safe with Reka |
| B. Document "safe to disable" in the installation/Vapor guide (recommended) | VDOM −1.5 KiB gzip, interop −1.6 KiB gzip; pure Vapor ±0 (rc.15 never reaches the Options API code) | one docs paragraph; a regression test is needed so a future Options-API use in Reka is caught (the pure-Vapor suite now runs with the flag off; a VDOM run with the flag off would cover the default build too) |
| C. Require it | none beyond B | Reka cannot require it: the flag is app-wide, and apps may use the Options API in their own components |

**Recommendation:** B. Also run the VDOM suite once with the flag off in CI, so the
default build is covered as well.

No other Vue compile-time flag applies. `@vue/runtime-vapor` 3.6.0-rc.15 reads only
`__VUE_PROD_DEVTOOLS__` and `__VUE_PROD_HYDRATION_MISMATCH_DETAILS__`, which are already `false`
in production by default. The pure-Vapor size floor is the runtime code that no flag
guards: hydration, interop and the built-ins (Q16). Any flag for those would have to come from Vue.
**Decided (owner, 2026-11-19):** (B) — document safe to disable; verify with `test:no-options-api` (D1/D2).

## Process (FIX_PLAN_5)

**Decided (owner, 2026-11-19):** Do not change lint-staged hook config (would leak into upstream PR);
never use `--no-verify` unless a plan step allows. If the hook stash fails, STOP. Upstream issues/PRs:
draft files in `vapor-proposal/upstream/` only (phase E).

## Running Reka's full test suite under pure Vapor (`QS*`)

From the full-suite work (`FULL_SUITE.md`). Numbered `QS1`... to stay apart from
questions added by the parallel performance work.

### QS1. Is a test-only render-function bridge acceptable?

About a fifth of the suite (754 tests, 41 files) builds its scaffolding with `h()`.

| Option | Trade-offs |
|---|---|
| (a) Keep the bridge (`suite/vaporH.ts`) | No test-file changes; those tests run against pure-Vapor Reka today. ~500 lines of test infrastructure emulating a VDOM subset; it can hide or cause failures of its own. |
| (b) Port the scaffolding to SFC fixtures (QS2) | Mode-agnostic, no emulation. A large diff to the suite that the maintainers would have to review. |
| (c) Run those tests in VDOM only | Simple and honest; Vapor coverage of Toast, NumberField, the id composables etc. drops to the story-fixture tests. |

**Recommendation:** (a) while Vapor is experimental, moving to (b) file by file as
tests are touched anyway.
**⚑ Provisional default:** (a); bridged results are reported separately.
**Decided (owner, 2026-11-19):** (a) — keep the render-function bridge for the full-suite run.

### QS2. Should new tests be written mode-agnostic?

A small rule for contributors ("mount SFC fixtures, not `h()` trees; do not read
`vm.$`/`subTree`") would make every new test run in both modes without a bridge.
**Recommendation:** yes, in `CONTRIBUTING.md`, once Vapor support is accepted.
**⚑ Provisional default:** not done (it is the maintainers' contributor guide).
**Decided (owner, 2026-11-19):** provisional default — no new contributor rule in this branch yet.

### QS3. Should the full-suite Vapor run be in CI?

It takes about as long as the VDOM run. Options: (a) required, (b) non-blocking job
with the pass count tracked, (c) manual only.
**Recommendation:** (b) until the remaining failures are triaged, then (a).
**⚑ Provisional default:** manual (`pnpm --filter @reka-ui/vapor-tests test:full-suite`).
**Decided (owner, 2026-11-19):** (b) — manual / non-blocking until triage completes.

### QS4. Is it acceptable for as-child Primitive to hook Vapor fragment updates?

When an as-child Primitive's slot swaps its root element, nothing in the component re-runs
in Vapor. To re-apply attrs and update `$el`, `onRootFragmentUpdate()`
(`shared/instance.ts`) pushes a callback onto the `u` update-hook arrays of the
fragments on the path to the first element. Those arrays are internal to
`@vue/runtime-vapor` (ADR-S06).

| Option | Trade-offs |
|---|---|
| (a) Keep the internal hook, pinned to the tested Vue version | Exact and cheap: it runs only when a branch actually changes. It can break on any Vue minor version. |
| (b) MutationObserver on the parent | Public API, but asynchronous (one microtask late), costs per instance, and misses swaps that happen while detached |
| (c) Ask Vue for a public "block changed" hook | The right fix long term, but it depends on upstream |

**Recommendation:** (a) now, with a guard test, and file (c) upstream.
**⚑ Provisional default:** (a).
**Decided (owner, 2026-11-19):** (a) — keep `onRootFragmentUpdate` with a guard test; file upstream when ready.

### QS5. Should the full-suite harness normalise Vapor's anchor comments in `html()`?

19 tests (snapshots and `html()` equality) fail only because Vapor leaves `<!--slot-->`,
`<!--if-->` and `<!--dynamic-component-->` anchors, and because it orders attributes
differently. See FULL_SUITE.md, M1.

| Option | Trade-offs |
|---|---|
| (a) Normalise in the shim's `html()` (drop anchor comments, sort attributes) | The tests pass unchanged, but the shim then hides any real difference in comments or attribute order |
| (b) Store separate Vapor snapshots | Honest, but it doubles the snapshot files and still fails the inline `toBe('<label>…')` checks |
| (c) Keep them as known `markup-only` differences | No masking, but they stay red |

**Recommendation:** (a), limited to Vapor's own anchor comment names, with the raw HTML
still available.
**⚑ Provisional default:** (c), until this is decided.
**Update (r5):** superseded by option (d), per-test helpers (`expectMarkupSnapshot`,
`modeMarkup`) under the QS6 convention, ADR-S13. The 19 tests pass. Reopen this if a
reviewer prefers (a).
**Decided (owner, 2026-11-19):** (d) via ADR-S13 helpers — keep current convention.

### QS6. Convention for tests that differ between VDOM and Vapor (provisional)

The user asked for inherently different tests to be branched in the test files. The
convention in use:

- `isVapor` from `@/test` (set by the pure-Vapor suite's setup).
- Markup helpers that are a no-op under VDOM: `normalizeMarkup`, `modeMarkup`,
  `expectMarkupSnapshot`.
- The VDOM branch is kept byte-for-byte where possible.
- `it.skipIf(isVapor)` only with a comment giving the reason (unused so far).

| Option | Trade-offs |
|---|---|
| (a) `isVapor` branches inside existing tests (current) | Small diffs, one test name per behaviour. Branches can pile up in a test. |
| (b) Separate `*.vapor.test.ts` files | Clean files, but duplicated setup, and the two versions drift apart. |
| (c) Mode-agnostic fixtures only (SFC/templates everywhere) | No branching, but it rewrites many VDOM tests (QS2). |

**Recommendation:** (a) for assertions, (c) for new fixtures.
**⚑ Provisional default:** (a).
**Decided (owner, 2026-11-19):** (a) for assertion style; (c) for new fixtures.

### QS7. As-child attrs are missing from Vapor SSR markup

Under Vapor SSR, the server markup lacks the attrs that an as-child Primitive merges
into its slotted element. Hydration patches them in on the client, so the hydrated DOM
matches; only the first paint differs (Tabs "keeps the default output", S3 in
FULL_SUITE.md). The Vapor Primitive applies these attrs to DOM nodes, and there are no
DOM nodes on the server. Vapor SSR slots do carry a VNode fallback branch.

Keeping the VDOM `Primitive.ts`/`Slot.ts` for the server build alone did *not* fix the
markup, so the attrs are lost earlier too, most likely in the Vapor Collection swap and
the RovingFocus chain. This has not been confirmed.

| Option | Trade-offs |
|---|---|
| (a) A server-side as-child path (ship the VDOM Primitive/Slot for SSR, and fix the other places that drop attrs) | Correct first paint, but two Primitive code paths. |
| (b) Accept client-only as-child attrs in Vapor SSR | Simple, but there is a flash of unstyled or unfocusable markup, and a11y attrs are missing before hydration. |
| (c) Ask Vue for attr fallthrough into slot content in Vapor SSR | The right layer, but it depends on upstream. |

**Recommendation:** (a), after locating where the attrs are lost; file (c) upstream.
**⚑ Provisional default:** (b), documented as a known difference.

The pure-Vapor Tabs SSR test **"ssr hydration keeps the default output when ids do not diverge"**
stays red on purpose (R3 reverted): expected SSR markup was not rewritten to match the known
as-child server gap.
**Decided (owner, 2026-11-19):** (b) — known Vapor SSR first-paint difference; Tabs test stays red; draft Vue issue (phase E).

### QS8. Listener order for events bubbling from a descendant of an as-child element

Since ADR-S17, Vapor runs a consumer's as-child listener before the element's own for
events dispatched at the element. For events that bubble up from a descendant, the
element's own listener still runs first, which is the opposite of VDOM.

| Option | Trade-offs |
|---|---|
| (a) Accept the divergence (current) | Simple. Only matters when a consumer `preventDefault()`s an event that started in a descendant. |
| (b) Re-order through Vapor's internal `$vei` invokers (own/attrs layers) | Exact, but relies on internals. |
| (c) Ask Vue for a public way to prepend fallthrough handlers | Right long term. |

**Recommendation:** (a) now, and file (c).
**⚑ Provisional default:** (a).
**Decided (owner, 2026-11-19):** (a) — accept listener order divergence for now.

### QS9. Forwarding a ref to a Vapor component that exposes nothing

In Vapor, a template ref on a component is its expose proxy. When the component
`expose()`s nothing, the ref is an empty object, so `useForwardExpose` cannot provide
`$el` or the instance the way VDOM's public instance does. This is upstream's design:
`getExposed` in runtime-vapor.

| Option | Trade-offs |
|---|---|
| (a) Document it: user components that Reka forwards to must expose `$el` (Reka's own SFCs do) | No magic, but a migration note for users. |
| (b) Vapor test variants in useForwardExpose.test.ts where the child exposes its root | Tests pass, but they no longer test a non-exposing child. |
| (c) Ask Vue to put `$el` on the Vapor expose proxy | Closest to VDOM, but needs upstream. |

**Recommendation:** (a) together with (c). Use (b) only if the user wants those tests green.
**⚑ Provisional default:** (a). The 6 tests stay red.
**Decided (owner, 2026-11-19):** (a) and (c) — document migration + draft Vue issue; fix tests in C2 (`isVapor` expose `$el`).

### QS10. Virtualizer implementation: unified `<Primitive as-child v-for>` vs twin SFCs

In VDOM, `ListboxVirtualizer`, `ScrollAreaVirtualizer`, and `TreeVirtualizer` previously used `useSlots()` and `cloneVNode()` in computed properties to attach virtual positioning styles and attributes. Because Vapor has no VNodes, initial approaches considered `.vapor.vue` twins (~700 LOC duplicate code).
Instead, replacing `cloneVNode` with a direct template `<Primitive v-for="item in virtualizer.getVirtualItems()" :key="item.key" as-child :data-index="item.index" :style="{ ... }"><slot ... /></Primitive>` and `useParentElement(virtualizerEl)` works identically and cleanly in both VDOM and Vapor mode without any twin SFCs.

| Option | Trade-offs |
|---|---|
| (a) Unified `<Primitive as-child v-for>` in the existing SFCs (current) | Zero code duplication, identical behavior in VDOM and Vapor, 100% green tests in both modes. |
| (b) Dedicated `.vapor.vue` twins | Keeps VDOM `cloneVNode` unchanged, but doubles maintenance surface (~700 lines) and risks drift. |
| (c) Extract shared logic to composable and keep only templates twinned | Modest reduction in duplication, but still requires synchronizing two files per component. |

**Recommendation:** (a).
**⚑ Provisional default:** (a).
**Decided (owner, 2026-11-19):** (a) — unified Primitive v-for template (ADR-S40).

### QS11. Caching and scoping `proxy` on Vapor instances for VueUse helpers

`getCurrentInstance()` in Vue Vapor returns `null`. Certain VueUse utilities (such as `useParentElement()` when invoked without an element ref argument) access `getCurrentInstance().proxy.$el`. `packages/vapor/rekaVapor.ts` patches `getCurrentInstance` inside `@vueuse` imports to return a shim instance whose `.proxy.$el` traverses the Vapor block.

| Option | Trade-offs |
|---|---|
| (a) Cached WeakMap proxy on Vapor instance (current) | O(1) cached access without re-allocating a new proxy on every property access. Confined to `@vueuse` import resolution. |
| (b) Pass explicit element ref to `useParentElement(targetRef)` in Reka SFCs | Avoids instance access entirely in Reka components (as done in `ListboxVirtualizer` and `TreeVirtualizer`). Other external consumer code using VueUse may still need the shim. |
| (c) Upstream PR to VueUse to support Vapor native instance / block resolution | Cleanest long term, pending upstream VueUse release. |

**Recommendation:** Combine (a) and (b): use explicit element refs where possible in Reka source, and retain the WeakMap-cached shim in `rekaVapor.ts` for any remaining VueUse internals.
**⚑ Provisional default:** (a) with (b).
**Decided (owner, 2026-11-19):** (a) with (b) — keep VueUse shim and explicit refs where present.

### QS12. Full-suite harness and `VaporTransition` default slot `(H1c)`

Commit `19007363` tried to mount the `VaporTransition` default slot child once (no
`reactiveBlock`, unstable slot fn) so Transition/leave tests could resolve a DOM node
for enter/leave hooks. It turned **4** failures at `7ee09911` green (compare
`suite/out/report-k9.json` vs `report-h1c.json`):

- `Presence/Presence.test.ts` — "given a Presence with an async child" (enter and
  after-enter dispatch cases).
- `Slider/Slider.test.ts` — "given slider on a page that leaves through an out-in
  transition" (horizontal and vertical pointer cases).

The same hunk regressed **17** tests in `shared/useRenderedContentId.test.ts` (KeepAlive +
leave-transition scenarios ADR-S20 fixed) because the slot stopped updating when branch
content swapped during a leave transition. **Reverted** (ADR-S32). A correct fix must keep
the default slot reactive, use `stableSlotFns`, and still satisfy the four tests above
without breaking reactive KeepAlive/Transition composition.

| Option | Trade-offs |
|---|---|
| (a) Reactive slot + stable fn, reconcile with Vapor's Transition child lifecycle | Harness-only; needs design against Vue Vapor Transition internals. |
| (b) Test variants (`isVapor`) for the four Transition-heavy cases | Keeps harness simple; documents inherent timing/DOM differences. |
| (c) Leave red until upstream documents Transition + KeepAlive under the render bridge | No wrong harness semantics. |

**Recommendation:** (a) with a failing repro in `packages/vapor/test-native` before touching the bridge again.
**⚑ Provisional default:** (c) until (a) is designed.
**Decided (owner, 2026-11-19):** try (a) once in C3; if it fails, (c) — not (b).

### QS13. `createComponent` key getter from `propsRef` `(H1d)`

Commit `56042cd3` wired `rawProps.key` to `propsRef.value.key` instead of the static
descriptor key `c.key`. Bisect: at `801cb017` `useRenderedContentId` was **0** fail; with
only this hunk (even after reverting H1c) the file regained **17** failures — same family
as H1c. **Reverted** (ADR-S32). Possible need: update key only when parent `setProps`
changes the `key` prop without breaking Vapor's keyed remount rules for Transition/KeepAlive
fixtures.

| Option | Trade-offs |
|---|---|
| (a) Revisit with a narrow guard (e.g. only when `propsRef.value.key !== c.key`) | Might fix setProps tests without the regression. |
| (b) `isVapor` test variants where keyed remount timing differs | No harness guesswork. |
| (c) Leave `rawProps.key = () => c.key` | Stable; any setProps-key test stays red until understood. |

**⚑ Provisional default:** (c).
**Decided (owner, 2026-11-19):** (c) — propsRef key stays reverted.

### QS14. Dialog/Combobox `unmountOnHide=false` and `v-show` vs inline `display` (FIX_PLAN step 20)

Remaining reds: Dialog (3), Combobox (2) in `triage.md`. Dirty-tree used inline `display` and
`forceMount` on content (R10); that changes VDOM semantics (consumer `style="display:…"` can
override hidden content).

| Option | Trade-offs |
|---|---|
| (a) Keep `v-show` in VDOM; Vapor-only twin or compile-time path | No VDOM behaviour change. |
| (b) Inline `display` with guard so consumer attrs cannot override | VDOM behaviour change. |
| (c) Leave tests red until Vue Vapor supports `v-show` on components | Stable. |

**⚑ Provisional default:** (c). **Do not implement** without maintainer choice.
**Decided (owner, 2026-11-19):** (a) — Vapor-only `v-show`/`display` path (C1); else (c).

### QS15. FocusScope stack registration timing (FIX_PLAN step 21)

`FocusScope/FocusScope.test.ts` — Combobox input inside Dialog (#2749) fails in pure Vapor.
Dirty-tree changed stack registration in `setup` for all VDOM users (R6); **reverted**.

| Option | Trade-offs |
|---|---|
| (a) Vapor-only stack timing | Isolated; needs VDOM parity proof. |
| (b) Harness focus emulation | May hide real traps. |
| (c) Leave red until understood | Current. |

**⚑ Provisional default:** (c).
**Decided (owner, 2026-11-19):** re-check after C1; Vapor-only fix allowed else (c).

### QS16. Combobox `resetSearchTermOnBlur` 1 ms `setTimeout` (W9) and input sync (W11)

**W9:** `setTimeout(…, 1)` on close comes from upstream `05ef43bf` / #2284 (defer
`resetSearchTerm` until after blur). Vapor test: "opening the popup should not reset searchTerm
when close". **Keep `setTimeout`** unless a VDOM test proves the deferral is obsolete.

**W11:** Prototype `syncInputValue` in `ComboboxInput` broke **VDOM** (`pnpm test:run` 3548→3548
fail). Native typing test did not prove harness vs Reka. **Do not** land `syncInputValue` without
a VDOM-safe design; investigate `suite/test-utils.ts` `setValue` / keyboard path first.

**⚑ Provisional default:** leave both Combobox Vapor fails red; file QS under W9/W11 in triage.
**Decided (owner, 2026-11-19):** keep `setTimeout`; fix harness only (C4), else leave red.

### QS17. Dialog dev `useWarning` fires twice under pure Vapor (FIX_PLAN_4 §9.1)

**Symptom:** `Dialog.test.ts` `toHaveBeenCalledTimes(1)` fails with 2 calls for both missing-title
and missing-description cases; VDOM `pnpm exec vitest run src/Dialog/Dialog.test.ts` passes.

**Tried (step 33):** `nextTick` deferral, `findById` via `contentElement`, per-root
`devA11yWarned`, `onMounted` `ran` guard — no delta. Likely duplicate `onMounted` or a second
`DialogContentImpl` shell in Vapor jsdom; needs a minimal reproduction against plain Vue 3.6 Vapor.

| Option | Trade-off |
|---|---|
| (a) Harness dedupe identical `console.warn` per tick | Hides real double warnings. |
| (b) Defer checks in `useWarning` until DOM ids exist | VDOM-safe if timed correctly. |
| (c) Leave red; investigate Vue Vapor lifecycle | Current. |

**⚑ Provisional default:** (c).
**Decided (owner, 2026-11-19):** (c) plus C5 diagnosis; **never (a)** harness warn dedupe.

