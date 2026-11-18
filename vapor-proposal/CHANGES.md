# Vue Vapor support for Reka UI: research, audit, strategy, plan

Local prototype: `/workspace/reka-vapor/reka-ui`, branch `feat/vapor-support`
(base `a9873a0`, reka-ui 2.11.0). Vue checked: **3.6.0-rc.15** (newest 3.6
prerelease on npm on 2026-11-18; source cloned at tag `v3.6.0-rc.15`).
Nothing was pushed or posted.

---

## 1. What Vapor changes for a component library (verified in Vue 3.6.0-rc.15 source)

| Fact | Where verified |
|---|---|
| `getCurrentInstance()` returns `null` inside a Vapor component: it only returns `currentInstance` when `!currentInstance.vapor`, otherwise `currentRenderingInstance` (a VDOM instance during a VDOM render, so it can even point at the **wrong** component in interop). | `runtime-core/src/componentCurrentInstance.ts`; also stated in the [v3.6.0-beta.1 release notes](https://github.com/vuejs/core/releases/tag/v3.6.0-beta.1) |
| `currentInstance` (generic VDOM or Vapor instance) is exported at runtime from `vue` but marked `@internal` and missing from the `.d.ts`. `useInstanceOption()` (also `@internal`) only exposes `ce`/`type`/`uid`. | `runtime-core/src/index.ts`, built `runtime-core.d.ts` |
| A Vapor instance has no `vnode`: props passed by the parent live in `rawProps` (static getters + `$` dynamic sources), output lives in `block` (Node / fragment / component / array). Template refs to a Vapor component resolve to a proxy over `exposed`, cached on first access. | `runtime-vapor/src/component.ts` (`VaporComponentInstance`, `getExposed`), `componentProps.ts` |
| `useAttrs()` / `useSlots()` work in Vapor (the instance is its own setup context). | `runtime-core/src/apiSetupHelpers.ts` |
| Vapor slots are functions returning blocks; there are no vnodes to inspect or clone. In **pure Vapor**, fallthrough attrs are not applied to a slot root (dev warning instead). | `runtime-vapor/src/component.ts` (`applyFallthroughAttrs`, `resolveFallthroughOwner`) |
| In **interop**, calling `slots.default()` from a VDOM component on a Vapor slot returns one opaque `VaporSlot` vnode; since rc.15, `cloneVNode(vaporSlotVNode, extras)` makes `extras` the fallthrough attrs of the slot content's single root. This is exactly the path Reka's `Slot` (as-child) uses. | `runtime-vapor/src/vdomInterop.ts` (`vaporSlotsProxyHandler`), `runtime-core/src/vnode.ts` (`cloneVaporSlotMeta`); [vuejs/core#14771](https://github.com/vuejs/core/issues/14771) (crash, fixed), [vuejs/core#15989](https://github.com/vuejs/core/pull/15989) (fallthrough fix) |
| Still open: SSR of cloned attrs on Vapor slot content hydrates without them (cites Reka `Slot`/Nuxt UI). | [vuejs/core#16269](https://github.com/vuejs/core/issues/16269) |
| `v-memo` is ignored in Vapor (compiler warning). | Vapor compiler warnings while compiling `ListboxItem.vue`, `PopperContent.vue`, `ComboboxItem.vue` |
| Reka maintainers (v3 roadmap, 2026-09-04): v3 stays a VDOM library; a Vapor-native build is out of 3.0 scope, "please open a dedicated issue". | [unovue/reka-ui#2721](https://github.com/unovue/reka-ui/issues/2721) |
| Related Reka bug: `useId`'s `import * as vue` pulls `@vue/runtime-vapor` into every bundle on 3.6. | [unovue/reka-ui#3018](https://github.com/unovue/reka-ui/issues/3018) |

## 2. How other libraries avoid the virtual DOM (cloned into `/workspace/reka-vapor/refs`)

| Library | How it works without vdom | Vapor relevance | Source |
|---|---|---|---|
| **Zag.js** (`@zag-js/vue`) | Framework-agnostic state machines; the Vue adapter only uses reactivity + lifecycle (`computed`, `shallowRef`, `onMounted`, `onBeforeUnmount`, `watch`). Components are "prop getters" (`api.getTriggerProps()`) the user `v-bind`s onto their own elements, normalized by `normalizeProps`. No `h`, no `getCurrentInstance`, no vnode cloning. | Adapter is Vapor-friendly as written. | [chakra-ui/zag](https://github.com/chakra-ui/zag) `packages/frameworks/vue/src/{machine,normalize-props}.ts` |
| **Ark UI** (Vue) | Components over Zag, but its `asChild` is the same vnode technique as Reka (`Dynamic`: `renderSlotFragments` + `mergeProps` + `cloneVNode`, `factory.ts` uses `h`). | Same interop-only status as Reka. | [chakra-ui/ark](https://github.com/chakra-ui/ark) `packages/vue/src/{components/factory.ts,utils/dynamic.ts}` |
| **Bits UI** (Svelte 5) | No asChild: a `child` snippet receives merged `props` and the user spreads them (`{#snippet child({ props })}<button {...props}/>`). State in classes (`CollapsibleTriggerState`). | Vue analogue: scoped slot props + `v-bind`, works in Vapor. | [huntabyte/bits-ui](https://github.com/huntabyte/bits-ui) `src/lib/bits/collapsible/components/collapsible-trigger.svelte` |
| **Melt UI** (Svelte) | Builders return attribute stores + a `use:` action the user spreads onto elements (`makeElement`). | Same attribute-spreading idea. | [melt-ui/melt-ui](https://github.com/melt-ui/melt-ui) `src/lib/internal/helpers/makeElement.ts` |
| **Kobalte** (Solid) | No vdom in Solid; polymorphism via `as` rendered with `<Dynamic component={as} {...others}/>` (and `as` may be a component receiving props). | Vue analogue: `<component :is>` + prop passing. | [kobaltedev/kobalte](https://github.com/kobaltedev/kobalte) `packages/core/src/polymorphic/polymorphic.tsx` |
| **vael-ui** (Vue) | Writes every component once as a normal SFC and compiles it **twice** (VDOM build + Vapor build via `unplugin-vue` with Vapor on) into `vael-ui` and `vael-ui/vapor`; shared composables are imported from the VDOM build so state is not duplicated. Avoids `asChild`. | Proof that single-source dual compile works for a Vue UI lib. | [Mini-Sylar/vael-ui](https://github.com/Mini-Sylar/vael-ui) `packages/vapor-ui/tsdown.config.ts` |
| **Vuetify0** (`@vuetify/v0`) | Stays VDOM; runs in Vapor apps via `vaporInteropPlugin`; isolated Vue 3.6 test package (`tests/vapor`, which this prototype's harness is modelled on). Finds the Vapor instance by subscribing to the `__VUE_INSTANCE_SETTERS__` global. | Interop-first; the instance trick depends on an SSR-build global, so not adopted here. | [vuetifyjs/0](https://github.com/vuetifyjs/0) `packages/0/src/utilities/instance.ts`, [Vapor guide](https://0.vuetifyjs.com/guide/integration/vapor) |
| Headless UI (Vue) | No Vapor work; last release 1.7.23. | none | [npm](https://www.npmjs.com/package/@headlessui/vue) |

## 3. Audit of Reka UI 2.11.0 (`packages/core/src`, tests and stories excluded)

| Pattern | Count | Files | Vapor-only impact | Interop (rc.15) |
|---|---|---|---|---|
| `h()` render-function components | 3 components (+1 helper) | `Primitive/Primitive.ts`, `Presence/Presence.ts`, `Collection/Collection.ts` (`CollectionSlot`/`CollectionItem`), `shared/withDefault.ts` (helper) | **Breaks**: Vapor runtime treats them as Vapor components whose setup returns a non-block ("setup() returned non-block value") | works |
| `cloneVNode` / `mergeProps` on slot vnodes (asChild) | 4 files | `Primitive/Slot.ts`, `Listbox/ListboxVirtualizer.vue`, `Tree/TreeVirtualizer.vue`, `ScrollArea/ScrollAreaVirtualizer.vue` | breaks | works (child-own-attr precedence differs, see §6) |
| Slot vnode inspection (`renderSlotFragments`, `slots.default()`) | 3 users | `Slot.ts`, `Presence.ts`, `ScrollAreaVirtualizer.vue` (+ virtualizers) | breaks | works |
| `<Primitive>` usage | 252 in 246 files | almost every component | fine once `Primitive` works | works |
| `as-child` / `asChild` mentions | 244 in 186 files | | | |
| `<Presence>` | 27 files | all animated content | fine once `Presence` works | works |
| `useForwardExpose()` | 247 files | almost every component | **Throws** (`getCurrentInstance()!` null) | works |
| `getCurrentInstance` | 11 files | `useForwardExpose`, `useForwardProps`, `useEmitAsProps`, `useForwardScopeId`, `useTriggerId` (`useContentMounted`), `useForwardRef`, `Presence.ts`, `FormRoot.vue`, `TagGroupRoot.vue`, `AutocompleteRoot.vue`, `ComboboxRoot.vue` | null → crash or silent no-op | **also broken when the composable is called from a user's Vapor component** (see §6) |
| `vnode.props` / `vnode.el` / `vnode.scopeId` / `subTree` / `.$.` | 7 files | `useForwardProps`, `useForwardExpose`, `resolveElement`, `useForwardScopeId`, `useTriggerId`, `FormRoot.vue`, `TagGroupRoot.vue` | no vnode in Vapor | works |
| `useEmitAsProps` / `useForwardPropsEmits` / `useForwardProps` | 25 / 30 / 10 files | | silent: forwarded nothing | same silent failure from Vapor callers |
| `useContentMounted` (`instance.proxy.$forceUpdate`, `vnode.el`) | 9 files | Dialog/Drawer/Popover/Tooltip/Menu/Select/NavigationMenu/Combobox content, triggers | breaks | works |
| `$el` reads | 3 components + shared | `MenuSubTrigger.vue`, `DateFieldRoot.vue`, `SelectContentImpl.vue` | needs `$el` exposed | works |
| `useForwardScopeId` | 6 components | Checkbox, Switch, Toggle, ToggleGroupItem, Radio, RadioGroupItem | scope id semantics differ | works |
| `<Teleport>` | 16 files | all `*Portal.vue`, `Teleport.vue` | compiles to `VaporTeleport`; untested | works |
| `v-memo` | 3 files | `ListboxItem.vue`, `PopperContent.vue`, `ComboboxItem.vue` | ignored (perf only) | n/a |
| `useAttrs` / `useSlots` | 5 / 4 files | | fine | fine |
| `<Transition>` | 0 | Reka animates with CSS + `Presence` | — | — |
| `inheritAttrs: false` | 57 files | | fine | fine |

Empirical check (prototype test package): with **no Reka change**, Primitive as-child,
Collapsible, Checkbox, Tabs, Dialog (teleport, focus, Escape, close) and template refs all
work from Vapor components in both `createVaporApp + vaporInteropPlugin` and
`createApp + vaporInteropPlugin`. Compiling Reka's own source as Vapor and mounting with
`createVaporApp` alone fails immediately (`Primitive`: non-block setup; `useForwardExpose`:
`Cannot read properties of null (reading 'exposed')`).

## 4. Strategy comparison (scores 1-5, 5 = best)

| # | Strategy | Maintainer acceptability | Backwards compat | Maintenance cost (5 = no duplication) | Bundle / perf in Vapor apps | DX | Total |
|---|---|---|---|---|---|---|---|
| A | **Interop only**: document `vaporInteropPlugin`, change nothing | 5 | 5 | 5 | 1: ships the VDOM runtime; every Reka component is an interop crossing | 2: composables silently forward nothing from Vapor components; precedence divergence; SSR bug #16269 | 18 |
| B | **Interop + Vapor-safe composables** (opt-in `reka-ui/vapor` registers an instance resolver) | 5 | 5 | 5 | 1 | 4 | 20 |
| C | **Single source, dual compile** (vael-ui pattern) + swap only the few render-function modules + B | 4: one new entry, 4 swapped modules, no API change | 5 | 4: ~810 added lines in `packages/core/src` (tests excluded, measured on the branch), not per component | 5: no VDOM runtime needed | 5: same components/API, `import … from 'reka-ui/vapor'` | **23** |
| D | **Parallel hand-written `.vapor.vue` components / separate package** | 1 | 5 | 1: ~245 duplicated components to keep in sync | 5 | 3: two drifting libraries | 15 |
| E | **Zag/Ark-style**: framework-agnostic machines + prop getters | 1: full rewrite, contradicts v3 roadmap | 2: API change | 2: huge now (better long-term) | 4 | 3: `v-bind="api.getXProps()"` instead of components; Ark Vue still uses vnode asChild | 12 |
| F | **Melt/Bits-style builders**: replace `asChild` with slot-prop spreading (`v-slot="{ props }"` + `v-bind`) | 2 as a replacement (breaking), 4 as an additive escape hatch | 2 / 5 | 3: every part must forward slot props (~186 files) | 5 | 3 | 15 |
| G | **Vuetify0-style**: interop + instance shim via `__VUE_INSTANCE_SETTERS__` | 3: relies on an SSR-build global | 5 | 5 | 1 | 3 | 17 |

**Pick: C (single source, dual compile with a tiny swap layer), shipped in phases, with B as its first,
immediately useful slice.**

Why:
- Only 3-4 modules in Reka actually depend on vnodes (`Primitive`, `Presence`, `Collection`,
  the virtualizers). Every other SFC already compiles to Vapor from the **same source**, which
  the prototype now shows for 47 of 48 component families. Swapping a handful of modules at build time
  is far cheaper than D, E or F and changes no public API.
- The swapped modules cannot be single-sourced without regressing the VDOM build: the VDOM
  `Slot` must keep `cloneVNode` (it is SSR-correct and gives the child priority), and Vapor has no
  vnode to clone. So "swap these few files" is the smallest honest unit.
- B is needed in every scenario anyway: user wrappers (shadcn-vue style) compiled as Vapor call
  `useForwardPropsEmits` today and silently forward nothing, even with interop.
- A/G leave Vapor apps paying for the VDOM runtime, which is the reason people pick Vapor.
- F is worth adding later **as an additive escape hatch** (e.g. for Vapor SSR, where attributes
  applied on mount do not render on the server), not as the migration path.

The prototype already followed C; the comparison confirmed it, and the one adjustment was to
add the opt-in `reka-ui/vapor` entry (B) so the composable fix also helps interop users today.

## 5. Changes needed in Reka (full list)

1. **Instance access** (done in prototype): `shared/instance.ts` with `getInstance()`,
   `getAssignedPropKeys()`, `hasAssignedProp()`, `getInstanceRootNode()`, `findBlockElement()`;
   Vapor resolver registered only by the opt-in `reka-ui/vapor` entry (`shared/instance.vapor.ts`
   imports Vue 3.6's internal `currentInstance`), so the default build keeps Vue 3.4/3.5 support
   and tree-shaking.
2. **Composables** (done): `useForwardProps`, `useEmitAsProps` (and so `useForwardPropsEmits`),
   `useForwardExpose` (Vapor path updates `exposed` in place because Vapor caches the ref proxy;
   reads a Vapor child's exposed proxy; `$el` from the block), `useForwardScopeId`, `resolveElement`.
3. **Primitive** (done): `Primitive.vapor.vue` with `<component :is>`; `as-child` applies attrs to
   the slotted element (`asChildAttrs.ts`: classes/styles merged, listeners chained, child-owned
   attributes win, diffed on update); exposes `$el`.
4. **Presence** (done): `Presence.vapor.vue` (v-if'd slot, element from the block, attrs passed
   through like the VDOM version).
5. **Collection** (done): registry logic moved to `collectionCore.ts`; `Collection.vapor.ts`
   with `CollectionSlot.vapor.vue`/`CollectionItem.vapor.vue` replaces the `h()` parts in the Vapor
   build. Tabs, RovingFocus, Listbox, Menu, Select, Tree... pass in pure Vapor.
6. **`useContentMounted`** (done, in `useTriggerId.ts`): goes through the adapter instead of
   `$forceUpdate()`/`vnode.el`.
7. **Remaining `getCurrentInstance` users** (done): `FormRoot`/`TagGroupRoot` → `hasAssignedProp`;
   `AutocompleteRoot`/`ComboboxRoot`/`useForwardRef` → `getInstance()`.
8. **Virtualizers** (todo, the only pure-Vapor gap): `cloneVNode` of slot output; needs a Vapor
   variant (OPEN_QUESTIONS Q9).
9. **Overlays** (verified): Dialog, AlertDialog, Popover, Tooltip, HoverCard, DropdownMenu,
   ContextMenu, Menubar, NavigationMenu, Select, Combobox, Toast pass their family check
   (render + one open/interaction) in pure Vapor.
10. **Packaging** (todo): build a Vapor-compiled `reka-ui/vapor` (tsdown + `unplugin-vue` Vapor mode
    + the swap plugin from `packages/vapor/rekaVapor.ts`); CI job for `packages/vapor`
    (OPEN_QUESTIONS Q1-Q4, Q12). `sideEffects` now lists `dist/shared/instance.vapor.*` (a real bug
    found by a consumer-build test: the resolver registration was tree-shaken away).
11. **Unrelated but needed**: fix `useId`'s namespace import (#3018).
12. **`$el` on Vapor component refs** (done): `exposeRootElement()` (in `shared/instance.ts`) defines
    `$el` on a Vapor instance's `exposed`; the swap plugin injects the call into every Reka SFC.
13. **Write-only `forwardRef` in Vapor** (done): avoids "Maximum recursive updates" because Vapor
    sets dynamic refs inside a render effect.
14. **Async components** (done): `defineAsyncComponent` → `defineVaporAsyncComponent` in the Vapor
    build; `Presence.vapor.vue` waits for lazily mounted content.
15. **VueUse** (done, shim): VueUse 14/15 calls `getCurrentInstance()`; the Vapor build hands it a
    Vapor-aware one (OPEN_QUESTIONS Q5).
16. **as-child precedence fixes** (done): Presence uses override mode (consumer wins like VDOM
    fallthrough); attrs land inside the popper wrapper like VDOM `PopperContent`.

Every decision above is recorded ADR-style in `DECISIONS.md`.

## 6. Findings worth reporting

- **Silent bug today (interop):** a Vapor component that wraps a Reka component with
  `useForwardPropsEmits(props, emits)` forwards **nothing** (props and emits), because
  `getCurrentInstance()` is null. Covered by a test that reproduces it without the opt-in.
- **Interop precedence divergence:** Reka's VDOM `Slot` lets the child's own props win
  (`mergeProps(attrs, child.props)`). Under interop, Vue applies the clone extras as fallthrough
  attrs to the Vapor content root, where the parent wins; Reka cannot see the Vapor content's props
  to pre-merge. Recorded as `it.fails` in the interop suite; the Vapor-only `Primitive` keeps
  Reka's semantics.
- **Interop memory leak (pre-existing):** with a Vapor app + interop, residual heap grows by
  ≈22 MiB per mount/unmount cycle of 1000 Checkboxes. It reproduces with the unmodified upstream
  `useForwardExpose` in a VDOM component under a Vapor parent; root cause not identified
  (`BENCHMARKS.md` §7, OPEN_QUESTIONS Q8). Not reported anywhere yet.
- **`sideEffects` bug in the opt-in entry** (fixed in this branch, see §5.10).
- **Vapor component refs have no `$el`**, and Vapor sets dynamic refs inside a render effect
  (reading reactive state there loops). Both affect any library that reads `ref.$el`.
- **Upstream asks (Vue):** (1) a public, typed way to read the current generic instance (props
  passed, root block, exposed) instead of the `@internal` `currentInstance`; (2) slot-root
  fallthrough in pure Vapor (what interop already does with `SlotFallthroughOwner`), which would
  make `asChildAttrs.ts` unnecessary; (3) #16269 (SSR of cloned attrs).

## 7. Phased plan

| Phase | Scope | User impact | Risk |
|---|---|---|---|
| 0 | Docs: Vapor apps use `vaporInteropPlugin` with Vue >= 3.6.0-rc.15; known issues above | works today | none |
| 1 (this PR) | Instance adapter + composables + opt-in `reka-ui/vapor`; Vapor twins of `Primitive`/`Slot`/`Presence`/`Collection`; `$el`/async/VueUse handling; private `packages/vapor` test package (Vue 3.6 pinned, not in default CI run) with 48 families in 4 modes; benchmark | fixes silent forwarding bug in Vapor wrappers; 47/48 families work in pure Vapor from source; no VDOM behaviour change | low: VDOM path unchanged, all 3548 core tests pass |
| 2 | Virtualizers; profile and reduce pure-Vapor mount/memory cost (as-child applier); Vue-only repro of the interop leak | full pure-Vapor coverage | medium |
| 3 | Ship Vapor-compiled `reka-ui/vapor` (dual build), CI against Vue 3.6, docs page | VDOM-free Reka in Vapor apps | medium (Vue 3.6 still prerelease) |
| 4 | Track Vue APIs from §6; drop `asChildAttrs.ts` and the internal import when available; optional slot-props escape hatch (strategy F) for Vapor SSR | cleaner internals | low |

## 8. Prototype status (honest)

Branch `feat/vapor-support`, 12 commits on `a9873a0` (patches in `/workspace/reka-vapor/patches/`).

- `pnpm --filter reka-ui exec vitest run`: **130 files, 3548 passed, 35 skipped** (baseline before
  the branch: 128 files, 3533 passed, 35 skipped).
- `type-check`, `build-only`, `eslint` on all changed files: pass / clean. In `dist/`, only
  `shared/instance.vapor.{js,cjs}` reference `currentInstance`.
- `pnpm test:vapor` (Vue 3.6.0-rc.15, jsdom):
  - `vdom` baseline: **50 passed** (48 families + fixture check + consumer `sideEffects` build check).
  - interop (both app modes): **114 passed, 2 expected fail** (the precedence divergence).
  - pure Vapor: **57 passed, 1 expected fail** (ListboxVirtualizer, known gap), **1 todo**
    (other virtualizers); includes the compile check: all 414 exported components are Vapor.
- **Pure-Vapor coverage per component: 47/48** (table in `COVERAGE.table.md`; everything but
  ListboxVirtualizer).
- **Benchmark** (Chrome 156, 4x CPU, medians; full report in `BENCHMARKS.md`): pure Vapor updates take
  0.26-0.75x of VDOM time (Tabs ≈3.7x faster); mount 0.90-1.66x and unmount 1.35-1.80x of VDOM;
  memory per instance 1.38-1.45x of VDOM; app bundle gzip VDOM 60.0 / interop 98.7 / pure Vapor
  73.9 KiB; the VDOM renderer is absent from the pure-Vapor bundle.
- Not done: virtualizers; a published compiled `reka-ui/vapor`; Vapor SSR/hydration; tests other than
  the benchmark run in jsdom.
