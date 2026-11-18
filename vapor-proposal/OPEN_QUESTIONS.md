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
