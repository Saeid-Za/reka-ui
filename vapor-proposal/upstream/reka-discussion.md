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
  has an API for it (feature request prepared).
- Fixture families: VDOM 56/56, interop 116 + 2 expected (the interop as-child precedence
  divergence), pure Vapor 70 + 1 todo.

PERF_SECTION

### Questions for maintainers

1. Same package (`reka-ui/vapor`) or a separate package for an eventual Vapor-compiled build?
   Vue 3.6 peer range?
2. Is the opt-in side-effect import fine, or would you prefer `app.use(...)`?
3. OK with a private test workspace pinned to a Vue prerelease, and with the opt-in entry
   relying on Vue's internal `currentInstance` until vuejs/core#16305 gives a public API?
4. Should PR 3's pure-Vapor run go into CI now (non-blocking) or later?

Upstream items I'll file (texts ready): Vue — Vapor SSR fallthrough to a slot root;
`$el` on refs to Vapor components. VueUse — `useMounted` / `tryOnMounted` /
`useCurrentElement` in Vapor components.
