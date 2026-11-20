# Reka issue (RFC) — ready to paste

Status: ready to paste into https://github.com/unovue/reka-ui/issues/new (or Discussions →
Ideas). Answers @zernonia's "please open a dedicated issue" in #2721. Not posted.
Post this first, then link it from the three PRs.

---

**Title:** [RFC] Vue Vapor mode support: Vapor-safe composables now, Vapor build from the same source

### TL;DR

Reka works in Vapor apps today through `vaporInteropPlugin`, but its composables silently break
inside `<script setup vapor>` components, and a Vapor app has to ship the VDOM runtime to use
Reka. Only a handful of modules really need vnodes. I have a backwards-compatible, tested
implementation split into three stacked PRs and would like to know if you'd accept it, and in
which shape.

### What breaks today

1. **Silent bug, interop included.** A Vapor wrapper (the shadcn-vue pattern):

   ```vue
   <script setup vapor lang="ts">
   const props = defineProps<CollapsibleRootProps>()
   const emits = defineEmits<CollapsibleRootEmits>()
   const forwarded = useForwardPropsEmits(props, emits) // {} in Vapor
   </script>
   ```

   forwards no props and no emits: `getCurrentInstance()` is `null` in Vapor components by
   design. `useForwardExpose` fails the same way.
2. **Refs to Vapor components have no `$el`.** They only expose what `defineExpose()` returns.
3. **No VDOM-free option.** Compiling Reka's source as Vapor fails on `Primitive`/`Slot`,
   `Presence`, `Collection` (vnode cloning) and ~11 `getCurrentInstance` / `vnode.*` readers.

### Proposal (three PRs, no breaking changes)

1. **VDOM-safe prep** (mergeable alone): one internal seam for instance access
   (`shared/instance.ts`) and a few small fixes found by running the suite in other modes.
2. **Opt-in `reka-ui/vapor` entry + Vapor twins.** `import 'reka-ui/vapor'` makes the
   composables work in Vapor components (with interop and today's published build). Vapor
   implementations of `Primitive`, `Slot`, `Presence`, `Collection` (+ `DialogContent`) are
   swapped in only when Reka's source is compiled as Vapor. Timing differences are tiny swapped
   modules, never `if (isVapor)` in shared code, and a CI check fails when a twin's original
   changes. The default entry never imports Vue 3.6 APIs, so Vue 3.4/3.5 and tree-shaking are
   unaffected. Includes a docs guide.
3. **Private `packages/vapor` test package** pinned to Vue 3.6.0-rc.16, which runs Reka's whole
   jsdom suite compiled as pure Vapor (`createVaporApp`, no interop) plus fixture families in
   four modes and a Chrome benchmark.

### Where it stands (local, 2026-11-20)

- VDOM suite: **3560 passed, 35 skipped** (base 3533; +27 tests); build, vue-tsc, eslint pass.
- **Pure-Vapor full Reka suite: 3559 passed, 1 expected failure, 35 skipped.** The expected
  failure is Tabs SSR: pure-Vapor SSR cannot put as-child attrs on the slot's element until Vue
  has an API for it (Vue report linked below).
- Fixture families: VDOM 56/56, interop 116 + 2 expected (the interop as-child precedence
  divergence), pure Vapor 70 + 1 todo.

### Performance (local benchmark)

Chrome 155, 4× CPU throttle, 10 runs + 3 warm-up per scenario, 2 passes in reversed order on a quiet
i7-12700H (`packages/vapor/bench/run.mjs`). *before* = this work before its final cleanup round, on Vue 3.6.0-rc.15; *now* = this stack, on
rc.16; script-time medians. Both columns are this branch's code, so the VDOM column shows the cleanup
round did not regress VDOM; it is not a comparison with upstream `v2` (the bench lives in PR 3's package). Full table and method: `vapor-proposal/PERF_RESULTS_LOCAL.md` on the
author's archive branch (available on request).

| Scenario | VDOM before → now | Vapor before → now |
|---|---|---|
| checkbox ×1000 mount | 389 → 383 ms (noise) | 288 → 244 ms (−15 %) |
| collapsible mount | 156 → 151 ms (noise) | 325 → 235 ms (−28 %) |
| tabs mount | 470 → 471 ms (noise) | 637 → 570 ms (−11 %) |
| checkbox ×1000 update | 329 → 316 ms (noise) | 325 → 253 ms (−22 %) |
| listbox (virtual) scroll | 257 → 248 ms (noise) | 264 → 250 ms (noise) |
| residual heap after unmounting 1000 checkboxes | 554 → 555 KB (noise) | 471 → 341 KB (−28 %) |
| bundle, gzip | 70.85 → 70.99 KB (+0.2 %) | 85.68 → 87.90 KB (+2.6 %) |

- **No VDOM regression across this round.** Every VDOM timing is within noise (or faster); the VDOM bundle grows by 139 B gzip.
- The Vapor gains and the Vapor/interop bundle growth come from the Vue rc.15 → rc.16 bump; measured
  against an rc.16-only build, this stack's own code is neutral (within noise) except tabs mount (+7 %) and
  a small residual-heap increase (+4 %).

### Questions for maintainers

1. Same package (`reka-ui/vapor`) or a separate package for an eventual Vapor-compiled build?
   Vue 3.6 peer range?
2. Is the opt-in side-effect import fine, or would you prefer `app.use(...)`?
3. OK with a private test workspace pinned to a Vue prerelease, and with the opt-in entry
   relying on Vue's internal `currentInstance` until vuejs/core#16305 gives a public API?
4. Should PR 3's pure-Vapor run go into CI now (non-blocking) or later?
5. The pure-Vapor run needs a bridge (`packages/vapor/suite/vaporH.ts`, ~750 lines) that maps
   tests written with `h()` onto Vapor components. Are you OK carrying it, or would you rather
   move those tests to SFC fixtures over time so the bridge can shrink?

Related upstream reports (I am filing these right after this issue and will add the links):

- Vue: Vapor attrs fallthrough to a slot's root, incl. SSR (the Tabs SSR expected failure): (link to follow)<!--VUE_SSR_URL-->
- Vue: template ref to a Vapor component has no `$el`: (link to follow)<!--VUE_EL_URL-->
- VueUse: `useMounted` / `tryOnMounted` / `useCurrentElement` in Vapor components: (link to follow)<!--VUEUSE_URL-->
- Vue: public current-instance API for Vapor: vuejs/core#16305 (existing)
