# [RFC] Vue Vapor mode support: fix composables now, Vapor-compiled build later

### TL;DR

Reka already **mostly works in Vapor apps through `vaporInteropPlugin`** (Vue >= 3.6.0-rc.15),
but (1) Reka composables silently break when called from `<script setup vapor>` components, and
(2) Vapor apps must ship the whole VDOM runtime to use Reka. Only a handful of Reka modules
actually need vnodes, so a **Vapor build from the same source** is realistic. I have a
backwards-compatible first step with tests and would like to know if you'd accept it.

Follows up on @zernonia's note in #2721 ("if there is demand, please open a dedicated issue").

### What breaks today

1. **Silent bug, interop included.** A Vapor wrapper component (the shadcn-vue pattern):

   ```vue
   <script setup vapor lang="ts">
   const props = defineProps<CollapsibleRootProps>()
   const emits = defineEmits<CollapsibleRootEmits>()
   const forwarded = useForwardPropsEmits(props, emits) // -> {} in Vapor
   </script>

   <template>
     <CollapsibleRoot v-bind="forwarded">
       …
     </CollapsibleRoot>
   </template>
   ```

   forwards **no props and no emits**: `getCurrentInstance()` is `null` in Vapor components
   by design (Vue 3.6 release notes). `useForwardExpose` throws in the same situation.
2. **Small divergence under interop:** with `as-child`, Vue applies Reka's merged attrs to Vapor
   slot content as fallthrough attrs, so the parent's attrs win over the child's own (Reka's VDOM
   `Slot` gives the child priority). SSR of those attrs is also broken upstream (vuejs/core#16269).
3. **No VDOM-free option.** Compiling Reka's source as Vapor fails because of a few vnode-based
   modules (`Primitive`/`Slot`, `Presence`, `Collection`, virtualizers) and ~11 `getCurrentInstance` users.
4. **A memory leak under interop** (pre-existing, found while benchmarking): with a Vapor app +
   `vaporInteropPlugin`, unmounted Reka components are retained (≈22 MiB per mount/unmount cycle of
   1000 Checkboxes). It reproduces with the unmodified `useForwardExpose`; root cause not yet
   identified (may be Vue's interop rather than Reka).

### Audit (2.11.0)

`h()` components: 3 (`Primitive`, `Presence`, `Collection`). `cloneVNode` on slots: 4 files.
`getCurrentInstance`: 11 files. `vnode.*` reads: 7 files. Everything else (~240 SFCs) already
compiles to Vapor unchanged. Full table in the PR description.

### Options considered (scores 1-5, 5 = best; full table and reasoning in the PR / CHANGES.md)

| Strategy | Maintainer accept. | Back-compat | Maint. cost | Vapor bundle/perf | DX | Total |
|---|---|---|---|---|---|---|
| A. Interop only (document it) | 5 | 5 | 5 | 1 | 2 | 18 |
| B. Interop + Vapor-safe composables | 5 | 5 | 5 | 1 | 4 | 20 |
| **C. Single source, dual compile + swap 4 vnode modules** (vael-ui pattern, includes B) | 4 | 5 | 4 | 5 | 5 | **23** |
| D. Hand-written parallel Vapor components / package | 1 | 5 | 1 | 5 | 3 | 15 |
| E. Zag/Ark-style machines + prop getters | 1 | 2 | 2 | 4 | 3 | 12 |
| F. Melt/Bits-style slot-prop spreading instead of `asChild` | 2 | 2 | 3 | 5 | 3 | 15 |
| G. Vuetify0-style interop + `__VUE_INSTANCE_SETTERS__` shim | 3 | 5 | 5 | 1 | 3 | 17 |

### Proposal (incremental, no breaking changes)

1. **Now (prototype ready):** instance adapter + opt-in `import 'reka-ui/vapor'` for interop users;
   Vapor twins of `Primitive`/`Slot`/`Presence`/`Collection` swapped in by a build plugin when Reka
   is compiled as Vapor; a private Vue 3.6 test package. The default entry never touches Vue 3.6
   internals, so Vue 3.4/3.5 and tree-shaking are unaffected.
2. **Next:** virtualizers; reduce the pure-Vapor mount/memory overhead; Vue-only repro of the leak.
3. **Later:** publish a Vapor-compiled build (`reka-ui/vapor` or a separate package: your call).
4. **Upstream:** ask Vue for a public generic-instance API, `$el`/slot-root fallthrough in pure Vapor.

### Where the prototype stands

- VDOM suite: **3552 passed, 35 skipped** (`pnpm test:run` on `feat/vapor-full-suite`); +15 new
  unit tests in the Vapor workspace; type-check/lint/build pass.
- 48 component families run in VDOM, two interop modes and **pure Vapor** (`createVaporApp`, no
  interop plugin): **48/48, 48/48, 48/48, 47/48** (only ListboxVirtualizer missing in pure Vapor).
- Pure-Vapor **full Reka suite** (local gate): **3541 pass / 11 fail / 35 skip** — see
  `vapor-proposal/triage.md` (packaging freeze after FIX_PLAN_7; not claiming green).
  All 414 exported components compile to Vapor. The VDOM renderer is absent from the pure-Vapor bundle.
- Benchmark (real Chrome, 4x CPU, medians): pure Vapor **updates take 0.26-0.75x of VDOM time**,
  but mount is 0.90-1.66x and memory per instance 1.38-1.45x, so the Vapor path still has
  per-instance overhead to optimise. Today's interop path is the slowest mode on most list
  scenarios and ships both runtimes (gzip: VDOM 60.0, interop 98.7, pure Vapor 73.9 KiB).

### Questions for maintainers

- Same package (`reka-ui/vapor`) or a separate package for the Vapor build? Peer range for Vue 3.6?
- Is the opt-in side-effect import acceptable, or would you prefer `app.use(...)`?
- OK with a private `packages/vapor` test workspace pinned to a Vue 3.6 prerelease, and with
  relying on Vue's `@internal` `currentInstance` until a public API exists?
- Ship pure Vapor as experimental with the mount/memory trade-off documented, or optimise first?
