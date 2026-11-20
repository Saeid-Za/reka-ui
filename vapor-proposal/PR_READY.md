# Reka UI × Vue Vapor: ready to post

The one guide to follow for posting the Vapor work upstream. Nothing here has been pushed or posted.
Every hash, branch name and number below was checked against the repo on 2026-11-20 (Asia/Tehran).

- Repo: `/media/saeid/projects/Contribs/reka-ui` (remote `origin` = `https://github.com/unovue/reka-ui`)
- Archive branch: `feat/vapor-full-suite` (full history; do not push it)
- PR branches (stacked): `vapor-pr/1-vdom-safe` → `vapor-pr/2-vapor-entry` → `vapor-pr/3-vapor-test-suite`
- Ready-to-paste bodies (also as files for `--body-file`): `vapor-proposal/upstream/bodies/`
- A copy of this file is committed as `vapor-proposal/PR_READY.md` on `feat/vapor-full-suite`.

> **Before you post anything, read [§7 Pre-flight](#7-pre-flight-checklist).** Upstream `v2` has moved
> 55 commits since the PR base (`a9873a029` → `f67a0e082`), and the stack no longer applies cleanly.
> The branches must be rebased (onto new branch names) and re-verified first.

## Contents

1. [Overview](#1-overview)
2. [Branch map](#2-branch-map)
3. [Posting order and why](#3-posting-order-and-why)
4. [Ready-to-paste texts](#4-ready-to-paste-texts)
5. [Step-by-step commands](#5-step-by-step-commands)
6. [Known issues, limitations, likely maintainer questions](#6-known-issues-limitations-likely-maintainer-questions)
7. [Pre-flight checklist](#7-pre-flight-checklist)
8. [Re-running the gates and the benchmarks](#8-re-running-the-gates-and-the-benchmarks)

---

## 1. Overview

**What it is.** Vue 3.6 adds Vapor mode (`<script setup vapor>`, no virtual DOM). Reka works in Vapor
apps today only through `vaporInteropPlugin`, and even then its forwarding composables
(`useForwardProps`, `useEmitAsProps`, `useForwardPropsEmits`, `useForwardExpose`) silently do nothing
inside Vapor components, because `getCurrentInstance()` is `null` there by design. Reka's source also
cannot be compiled as Vapor, because `Primitive`/`Slot`, `Presence`, `Collection` and a handful of
instance readers depend on vnodes.

**What the stack does** (no breaking changes, default entry unchanged for Vue 3.4/3.5):

1. **PR 1, VDOM-safe prep:** one internal seam for instance access (`shared/instance.ts`) plus small
   fixes found by running the suite in other modes. Mergeable on its own.
2. **PR 2, opt-in `reka-ui/vapor` entry + Vapor twins:** `import 'reka-ui/vapor'` makes the composables
   work in Vapor components; `*.vapor.*` twins of the vnode-based modules are swapped in only when
   Reka's source is compiled as Vapor; a CI check fails when a twin's original changes; docs guide.
3. **PR 3, private `packages/vapor` test package:** pinned to `vue@3.6.0-rc.16`, runs Reka's whole jsdom
   suite compiled as pure Vapor (`createVaporApp`, no interop), fixture families in four modes, the
   options-API probe and the Chrome benchmark harness.

**End state (gates).** Verified on the PR branch tips and the archive branch
(logs in `/media/saeid/projects/Contribs/box-run/logs/`):

| Check | Base `a9873a029` | PR 1 `4d71ac239` | PR 2 `1ae885e04` | PR 3 `50e64807d` |
|---|---|---|---|---|
| build (vue-tsc + tsdown) | pass | pass | pass | pass |
| `eslint .` | pass | pass | pass | pass |
| `vitest run` (jsdom, VDOM) | 3533 passed, 35 skipped | 3548 passed, 35 skipped | 3558 passed, 35 skipped | 3560 passed, 35 skipped |
| `check:vapor-twins` | — | — | 11 in sync | 11 in sync |
| Pure-Vapor full suite | — | — | — | 3559 passed, 1 expected fail, 35 skipped (3595) |
| Fixtures: VDOM / interop / pure Vapor | — | — | — | 56 passed / 116 passed + 2 expected fail / 70 passed + 1 todo |
| `test:no-options-api` | — | — | — | 1 passed |

Archive branch `feat/vapor-full-suite` (`c56d53a84` before this doc): pure Vapor 3559 / 1 expected
fail / 35 skipped; VDOM 3560 / 35 skipped. The one expected failure is Tabs SSR (QS7, see §6).

**Performance (this machine, quiet, 2 passes in reversed order).**

Arkan (i7-12700H, Chrome 155, 4× CPU throttle), 2026-11-20 19:02–19:25 (Asia/Tehran), idle load 0.5
before and after; *before* = `a1e9d43d2` (rc.15), *rc.16 only* = `6e02e7b96`, *now* = `c56d53a84`.

| Metric | VDOM: now vs before | Vapor: now vs before | Vapor: now vs rc.16 only (our code alone) |
|---|---|---|---|
| checkbox mount | −1.6 % noise | **−15.0 %** | +1.2 % noise |
| collapsible mount | −3.0 % noise | **−27.6 %** | +3.9 % noise |
| tabs mount | +0.1 % noise | **−10.6 %** | +7.2 % (just above the 5.8 % spread) |
| listbox-virtual mount | +6.7 % noise | **−7.6 %** | +4.8 % noise |
| listbox-virtual scroll | −3.8 % noise | −5.3 % noise | +4.8 % noise |
| checkbox update | −4.0 % noise | **−22.3 %** | +1.6 % noise |
| checkbox residual heap after unmount | +0.1 % noise | **−27.6 %** | +4.1 % (+13.5 KB, small but real) |
| plain mount | **−7.2 %** | +14.8 % (1.5 ms; noise vs F0) | +10.3 % noise |
| bundle gzip | +0.2 % (+139 B) | +2.6 % | +0.1 % |

Verdict: **no VDOM regression**; the Vapor build is 8–28 % faster and uses 28 % less residual memory than
before, but **those gains come from Vue rc.16**, not from our code. Our cleanup is roughly
performance-neutral on top of rc.16 (small costs on tabs mount and residual heap), which is the price of
removing the big twins. The box run's claim that our code alone sped up checkbox mount/update by
11–14 % did not hold on this quiet machine (+1.2 % / +1.6 %, noise).

Caveat: *before* is the Vapor branch before this round, not upstream `v2`; the benchmark harness only
exists in PR 3's `packages/vapor`, so there is no measured upstream-VDOM baseline in this run.

Full tables: `vapor-proposal/PERF_RESULTS_LOCAL.md` (this machine, primary) and
`vapor-proposal/PERF_RESULTS_RC16.md` (my box, loaded, secondary reference only).

---

## 2. Branch map

All three branches are stacked. PR 1's base is the merge-base with upstream `v2`, `a9873a029`
(upstream `v2` is now at `f67a0e082`, see §7).

### `vapor-pr/1-vdom-safe` @ `4d71ac239`: base `a9873a029` (upstream `v2`)

6 commits, 31 files, +1282 / −251.

- `2dee34f4b` refactor(shared): read the current instance through one seam
- `c383e20c0` fix(shared): re-read the enclosing form once mounted in useFormControl
- `902e17caf` fix(Select): ignore a comment anchor as the content element
- `6a514e0e7` fix(Combobox): drive content display from present
- `86c731e0f` refactor(virtualizer): render items through Primitive as-child
- `4d71ac239` refactor(Popover,Stepper): avoid dynamic component and bare text swaps

Contains: `shared/instance.ts` seam and its callers (`useForwardProps`, `useEmitAsProps`,
`useForwardRef`, `useForwardScopeId`, `useForwardExpose`, `resolveElement`, Autocomplete/Combobox/Form/
TagGroup roots); `useFormControl` re-reads `closest('form')` once mounted; `SelectContentImpl` ignores a
comment anchor; `ComboboxContentImpl` derives `display` from `present`; virtualizers render through
`Primitive as-child`; `PopoverTrigger` uses `v-if`/`v-else`; `StepperRoot` renders the live
announcement only when set; `test/mode.ts` (`isVapor`, always `false` here).
Verification: build, eslint, VDOM 3548 passed / 35 skipped.

### `vapor-pr/2-vapor-entry` @ `1ae885e04`: base `vapor-pr/1-vdom-safe`

+8 commits, 29 files, +1393 / −65.

- `b11fb7049` feat(vapor): add the opt-in reka-ui/vapor entry
- `8b1d52905` build(vapor): export reka-ui/vapor and keep its side effects
- `a4ebd0629` feat(Primitive): add Vapor implementations of Primitive, Slot and Presence
- `972561da2` feat(Collection): add a Vapor useCollection over a shared core
- `f2cacf2fa` feat(vapor): swap only the timing-sensitive parts of FocusScope and trigger ids
- `9b2c3f743` ci(vapor): fail when a twin's original changes without review
- `b697ce1f3` docs(guides): add a Vue Vapor mode guide
- `1ae885e04` chore(vapor): refresh the instance twin hash

Contains: `reka-ui/vapor` package export (Vue ≥ 3.6 resolver for Vapor instances + Vapor half of
`useForwardExpose`), `sideEffects` list, the 11 Vapor twins (`Primitive`, `Slot`, `Presence`,
`Collection` ×3, `DialogContent`, `stackTiming`, `triggerIdSync`, `instance`, `useForwardExpose`),
the as-child DOM applier, the twin drift check in the build workflow, CONTRIBUTING rule and
`docs/content/docs/guides/vapor.md`.
Verification: build (`dist/vapor.js` 211 B), eslint, VDOM 3558 passed / 35 skipped, twins 11 in sync.

### `vapor-pr/3-vapor-test-suite` @ `50e64807d`: base `vapor-pr/2-vapor-entry`

+3 commits, 167 files, +7168 / −183 (166 files, +6955 / −50 without `pnpm-lock.yaml`).

- `27dbcf986` test(vapor): add an isolated Vue 3.6 Vapor test package
- `ed09f7e66` test: make existing tests mode-aware for the pure-Vapor suite run
- `50e64807d` test: probe __VUE_OPTIONS_API__=false builds

Contains: `packages/vapor` (private `@reka-ui/vapor-tests`, `vue@3.6.0-rc.16` for itself only), the
full-suite runner (Vite plugin that swaps twins, VTU/Testing Library adapters, the `vaporH.ts`
render-function bridge, 746 lines), fixture families, `bench/run.mjs`, mode-aware edits to existing
tests, the `__VUE_OPTIONS_API__=false` probe, root `pnpm test:vapor`.
Verification: everything in the table in §1.

### Other branches (do not push)

- `feat/vapor-full-suite`: the archive, all history and the `vapor-proposal/` docs.
- `feat/vapor-support`, `backup/full-suite-pre-rebase-2`, `wip/dirty-1732`: older work/backups.

---

## 3. Posting order and why

| # | Where | What | Why this position |
|---|---|---|---|
| 1 | `unovue/reka-ui` issue | RFC: Vue Vapor mode support | @zernonia asked for a dedicated issue in [#2721](https://github.com/unovue/reka-ui/issues/2721). Maintainers decide the shape (same package? side-effect import? prerelease test workspace?) before reviewing 9 000 lines. Every later post links to it. |
| 2 | `vuejs/core` feature request | [Vapor] fall through attrs to a slot's single root, incl. SSR | The only remaining red (QS7) needs a Vue API. Filing it early gives the RFC and PR 2/3 an issue number for the expected failure. **Unverified standalone** (see the note in §4.3). |
| 3 | `vuejs/core` bug/question | [Vapor] template ref to a Vapor component has no `$el` | Verified on rc.16 (two machines). A migration difference the Reka guide documents; worth an upstream answer ("by design" is a fine outcome). |
| 4 | `vueuse/vueuse` issue | `useMounted` / `tryOnMounted` / `useCurrentElement` in Vapor | Verified at runtime on @vueuse/core 14.1.0, source-checked on 15.0.0. Reka ships a test-only shim for it; the issue lets that shim be temporary. |
| — | `vuejs/core` | Checkbox optional prop becoming `false` | **Do not file.** It does not reproduce standalone; plain Vue behaves the same in VDOM and Vapor (`vue-checkbox-optional-prop.md`). Upstream `v2` already fixed the story (`3b50f1742`, #3261). |
| 5 | `unovue/reka-ui` PR | PR 1 (ready for review) | Small, VDOM-only, mergeable alone. Open after the RFC, ideally after a maintainer reply. |
| 6 | `unovue/reka-ui` PR | PR 2 (draft) | Depends on PR 1 and on the RFC answers. |
| 7 | `unovue/reka-ui` PR | PR 3 (draft) | Depends on PR 2; biggest review cost (`vaporH.ts`, prerelease pin). |

Recommendation: post 1–4 the same day; wait for a maintainer reaction on the RFC (a few days) before
opening the PRs. If they say "go ahead", open all three at once as below.

---

## 4. Ready-to-paste texts

Placeholders: `#RFC` = the Reka RFC issue number; `VUE_SSR_URL`, `VUE_EL_URL`, `VUEUSE_URL` = the URLs from steps
2–4. The RFC is posted first, so its body shows "(link to follow)" (the token sits in an invisible HTML
comment). After steps 2–4, the `sed` one-liner in §5.5 fills every body file, then you edit the RFC and
open the PRs with the filled files. Never paste a body that still contains a bare `#RFC` or `*_URL` token.

### 4.1 Reka RFC issue (`unovue/reka-ui`)

Body file: `vapor-proposal/upstream/bodies/1-reka-rfc.md`

**Title:** [RFC] Vue Vapor mode support: Vapor-safe composables now, Vapor build from the same source

<details open><summary>Body (copy everything between the lines)</summary>

---

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

---

</details>

### 4.2 Vue feature request: attrs to a slot's root, incl. SSR (`vuejs/core`)

Body file: `vapor-proposal/upstream/bodies/2-vue-vapor-ssr-as-child.md`

> Verification: the gap is shown by Reka's Tabs SSR test on rc.16 (expected failure, re-run 2026-11-20),
> and a server-side string merge was prototyped and rejected (Rating hydration mismatch). The small
> `AsChild`/`App` snippet in the body illustrates the missing API but was **not** run as a standalone
> `renderToString` repro. Vue's issue form asks for a reproduction link: build an SFC-playground or
> StackBlitz repro (`createVaporSSRApp` + `renderToString` of the two SFCs) before filing.

**Title:** [Vapor] Fall through attrs to a slot's single root element, including SSR

<details open><summary>Body (copy everything between the lines)</summary>

---

**What problem does this feature solve?**

Headless libraries (Reka UI, Radix-Vue derivatives, Ark UI) implement `as-child`: a wrapper
component renders no element of its own and gives its attrs, classes, styles and listeners
to the single element its default slot renders. In VDOM this is
`cloneVNode(slots.default()[0], attrs)`, and it works the same on the server and the client.

Vapor has no vnodes, so a Vapor `as-child` component can only apply attrs to the rendered
element after mount. That works on the client, but `createVaporSSRApp` + `renderToString`
emits the slot content without them, so first paint lacks `tabindex`, `aria-*` and
`data-*` attributes until hydration patches them in.

Minimal shape (vue 3.6.0-rc.16):

```vue
<!-- AsChild.vue -->
<script setup vapor>
defineOptions({ inheritAttrs: false })
</script>

<template>
  <slot />
</template>
```

```vue
<!-- App.vue -->
<script setup vapor>
import AsChild from './AsChild.vue'
</script>

<template>
  <AsChild data-x="1" tabindex="-1">
    <button>hi</button>
  </AsChild>
</template>
```

Wanted on server and client: `<button data-x="1" tabindex="-1">hi</button>`. There is no
public Vapor API for `AsChild` to get there.

In Reka's pure-Vapor build the parent attrs do reach the compiled SSR slot call (as the
`slotAttrs` argument of `ssrRenderSlotInner`), but nested compiled slots receive `undefined`
for it, so the attrs never reach the element. A string-level merge on the server is not a fix:
it cannot see keys the child binds itself (including falsy ones) and causes hydration
mismatches.

**What does the proposed API look like?**

For example: honour `v-bind="$attrs"` (or a dedicated directive/option) on `<slot>` as
fallthrough onto the slot content's single root element, on the client, in SSR and during
hydration, with VDOM's precedence (`mergeProps(attrs, child.props)`: keys the child binds win,
even when `false`).

Related, but a different path: #16269 / #16340 fixed the interop case (VDOM `cloneVNode` on a
Vapor slot vnode). This request is about pure Vapor (`createVaporApp` / `createVaporSSRApp`).

---

</details>

### 4.3 Vue bug/question: `$el` on a ref to a Vapor component (`vuejs/core`)

Body file: `vapor-proposal/upstream/bodies/3-vue-expose-proxy-el.md`

> Verification: reproduced on vue 3.6.0-rc.16 on two machines (Vapor: keys `[]`, `$el` `null`; VDOM:
> `$el` is the `SPAN`). Vue's form wants a playground link: paste the two SFCs into
> https://play.vuejs.org (Vapor toggle) and add the link.

**Title:** [Vapor] template ref to a Vapor component has no `$el`

<details open><summary>Body (copy everything between the lines)</summary>

---

**Vue version:** 3.6.0-rc.16

**Steps to reproduce**

```vue
<!-- Child.vue -->
<script setup vapor>
</script>

<template>
  <span class="child">child</span>
</template>
```

```vue
<!-- Parent.vue -->
<script setup vapor>
import { onMounted, ref } from 'vue'
import Child from './Child.vue'

const child = ref()
onMounted(() => {
  console.log(child.value, Object.keys(child.value), child.value.$el)
})
</script>

<template>
  <Child ref="child" />
</template>
```

Mount `Parent` with `createVaporApp(Parent).mount('#app')`.

**What is expected?**

The same as VDOM (the same two SFCs without `vapor`, mounted with `createApp`):
`child.value.$el` is the `<span>`.

**What is actually happening?**

`child.value` is an empty object (no own keys) and `child.value.$el` is `undefined`.

Results from running both builds of the same SFCs in jsdom:

| Build | `!!child.value` | keys | `$el` |
|---|---|---|---|
| VDOM (`createApp`) | true | `[]` | `SPAN` |
| Vapor (`createVaporApp`) | true | `[]` | `null` / `undefined` |

**Any additional comments?**

If this is by design (Vapor refs only expose what `defineExpose()` returns), could the docs
say so in the Vapor migration notes? Libraries that forward refs (Reka UI's
`useForwardExpose`, and similar helpers in other headless libraries) read `$el` from child
component refs, and the workaround is for every wrapper to `defineExpose({ $el })`. A public
way to get a Vapor component's root element from its ref would also work.

---

</details>

### 4.4 VueUse issue (`vueuse/vueuse`)

Body file: `vapor-proposal/upstream/bodies/4-vueuse-vapor-instance.md`

> Verification: runtime repro on @vueuse/core 14.1.0 + vue 3.6.0-rc.16; 15.0.0 checked by reading the
> published source only. Check the latest VueUse release again before filing.

**Title:** `useMounted`, `tryOnMounted` and `useCurrentElement` misbehave in Vue Vapor components

<details open><summary>Body (copy everything between the lines)</summary>

---

**Describe the bug**

In Vue 3.6 Vapor components (`<script setup vapor>`), `getCurrentInstance()` returns `null`
by design. Several VueUse helpers use it to decide whether they run inside a component:

- `useMounted()` registers `onMounted` only when `getCurrentInstance()` is truthy, so in a
  Vapor component it never becomes `true`. `useSupported()` builds on it, so its computed is
  never re-evaluated after mount.
- `tryOnMounted(fn)` (via `getLifeCycleTarget`) sees no instance and calls `fn()` right
  away during setup, before anything is mounted. `useParentElement()` relies on it and reads
  the parent before the element is in the DOM.
- `useCurrentElement()` reads `getCurrentInstance().proxy.$el`; in a Vapor component the
  instance is `null`, so evaluating it throws.

`onMounted`, `onUpdated` and friends do work in Vapor components; only the
`getCurrentInstance()` check fails.

**Reproduction**

```vue
<script setup vapor>
import { useMounted } from '@vueuse/core'
import { onMounted } from 'vue'

const mounted = useMounted()
onMounted(() => setTimeout(() => console.log('useMounted:', mounted.value)))
</script>

<template>
  <span>hi</span>
</template>
```

Mount with `createVaporApp(App).mount('#app')`: it logs `false`. Without `vapor` (and
`createApp`) it logs `true`. The other two follow from the same check in the source
(`packages/shared/tryOnMounted`, `packages/core/useCurrentElement`).

**System info**

vue 3.6.0-rc.16, @vueuse/core 14.1.0 (same code in 15.0.0).

**Additional context**

Vue exposes the current Vapor instance internally (`currentInstance`), but not through
`getCurrentInstance()`; see vuejs/core#16305. Until there is a public API, one option is to
treat "inside setup" as "can register lifecycle hooks": e.g. register `onMounted` without the
instance check and catch the dev warning, or accept an explicit target. Reka UI currently
works around this by giving VueUse a `getCurrentInstance` that also returns the Vapor instance
in its Vapor test build.

---

</details>

### 4.5 PR 1 (`vapor-pr/1-vdom-safe` → `unovue/reka-ui:v2`)

Body file: `vapor-proposal/upstream/bodies/5-pr-1-vdom-safe.md`

**Title:** refactor: read the component instance through one seam (Vapor prep, no behaviour change)

<details open><summary>Body (copy everything between the lines)</summary>

---

### 🔗 Linked issue

RFC: #RFC (answers #2721).

### ❓ Type of change

- [ ] 📖 Documentation (updates to the documentation, readme or JSdoc annotations)
- [x] 🐞 Bug fix (a non-breaking change that fixes an issue)
- [x] 👌 Enhancement (improving an existing functionality like performance)
- [ ] ✨ New feature (a non-breaking change that adds functionality)
- [ ] 🧹 Chore (updates to the build process or auxiliary tools and libraries)
- [ ] ⚠️ Breaking change (fix or feature that would cause existing functionality to change)

### 📚 Description

## Summary

First, VDOM-only step of Vapor support (#2721, RFC: #RFC). It changes
nothing for current users and can be merged on its own.

- `shared/instance.ts`: `getInstance()` plus small accessors (assigned props, component name,
  scope id, root node) over `getCurrentInstance()`. `useForwardProps`, `useEmitAsProps`,
  `useForwardRef`, `useForwardScopeId`, `useForwardExpose`, `resolveElement` and the roots
  that read the instance (`AutocompleteRoot`, `ComboboxRoot`, `FormRoot`, `TagGroupRoot`) go
  through it instead of reading `vnode` internals. A later, opt-in entry can register a
  resolver for Vapor instances; until then the code path is the same as today.
- Fixes found while running the suite in other render modes, all VDOM-safe:
  - `useFormControl` reads `closest('form')` again once mounted (the computed is not reactive
    to DOM insertion).
  - `SelectContentImpl` ignores a comment anchor as the content element (as-child content that
    renders nothing made `hasAttribute` / floating-ui throw).
  - `ComboboxContentImpl` derives `display` from `present`, so closed persistent content is
    hidden without relying on `v-show` on a component. Consumer styles still apply.
- Template-only refactors: virtualizers render the window with `v-for` + `Primitive as-child`
  instead of cloning slot vnodes in a computed; `PopoverTrigger` uses `v-if`/`v-else` instead of
  `<component :is>`; `StepperRoot` renders the live announcement only when set.
- `test/mode.ts`: an `isVapor` flag (always `false` in this repo's run) for the mode-aware
  tests in the follow-up PRs.

6 commits, 31 files, +1282 / −251.

## Test evidence (local, 2026-11-20)

| Check | Base (`a9873a029`) | This branch |
|---|---|---|
| `pnpm --filter reka-ui build` (vue-tsc + tsdown) | pass | pass |
| `eslint .` | pass | pass |
| `vitest run` (jsdom) | 3533 passed, 35 skipped | **3548 passed, 35 skipped** |

New tests: `shared/instance.test.ts`, Combobox persistent-content display and object-model
search term, `useRenderedContentId` comment-anchor cases, virtualizer item rendering.

## Performance

No runtime change intended for VDOM users. The benchmark harness lives in PR 3's package, so there is no
direct upstream-`v2` comparison; across the last round of this work (Chrome 155, 4× CPU throttle, 2 passes
in reversed order) every VDOM timing (checkbox, collapsible, tabs, virtual listbox mount / scroll / update
/ unmount) stayed within noise and the VDOM bench bundle changed by +139 B gzip (+0.2 %). Full table in
the RFC (#RFC).

## Known issues

None in VDOM. The branch was cut from `a9873a029`; `v2` has moved since (see the notes on
rebasing in the stack description).

## Breaking changes

None. `shared/instance.ts` is internal (not exported from the package entry).

### 📝 Checklist

- [x] I have linked an issue or discussion.
- [ ] I have updated the documentation accordingly. (No user-facing change in this PR.)

---

</details>

### 4.6 PR 2 (`vapor-pr/2-vapor-entry` → `unovue/reka-ui:v2`, draft, stacked)

Body file: `vapor-proposal/upstream/bodies/6-pr-2-vapor-entry.md`

**Title:** feat: opt-in `reka-ui/vapor` entry and Vapor twins for the vnode-based parts

<details open><summary>Body (copy everything between the lines)</summary>

---

> Stacked on PR 1. Until PR 1 is merged this PR also shows its 6 commits; review the last 8.

### 🔗 Linked issue

RFC: #RFC (answers #2721). Stacked on PR 1. Vue: VUE_SSR_URL, VUE_EL_URL.

### ❓ Type of change

- [x] 📖 Documentation (updates to the documentation, readme or JSdoc annotations)
- [ ] 🐞 Bug fix (a non-breaking change that fixes an issue)
- [ ] 👌 Enhancement (improving an existing functionality like performance)
- [x] ✨ New feature (a non-breaking change that adds functionality)
- [ ] 🧹 Chore (updates to the build process or auxiliary tools and libraries)
- [ ] ⚠️ Breaking change (fix or feature that would cause existing functionality to change)

### 📚 Description

## Summary

- **`import 'reka-ui/vapor'`** (new package export, Vue >= 3.6): registers a resolver for
  Vapor component instances and the Vapor half of `useForwardExpose`. With it,
  `useForwardProps`, `useEmitAsProps`, `useForwardPropsEmits` and `useForwardExpose` work when
  called from `<script setup vapor>` components (today they silently forward nothing, because
  `getCurrentInstance()` is `null` in Vapor by design). Works with `vaporInteropPlugin` and the
  published VDOM build. The default `reka-ui` entry never imports Vue 3.6-only APIs; Vue 3.4 /
  3.5 and tree-shaking are unaffected. `sideEffects` lists the entry and resolver files so
  bundlers keep the registration.
- **Vapor twins** for the only modules that need vnodes: `Primitive`, `Slot`, `Presence`,
  `Collection` (`*.vapor.vue` / `*.vapor.ts`), plus `DialogContent` (`v-show` on a
  component). The as-child DOM applier (`Primitive/asChildAttrs.ts`) applies attrs, classes,
  styles and listeners to the rendered element, letting attrs the child binds itself win (VDOM
  `mergeProps` precedence). Nothing in the VDOM build imports them; they are used when Reka's
  source is compiled as Vapor (PR 3's test package does this).
- **No `isVapor` branches in shared sources.** Where timing differs, the difference is a tiny
  swapped module: `FocusScope/stackTiming(.vapor).ts` (when a scope joins the focus stack) and
  `shared/triggerIdSync(.vapor).ts` (following a re-rendered trigger id).
- **Twin drift check:** each twin carries `// @vapor-twin-of <original> <sha12>`;
  `pnpm --filter reka-ui check:vapor-twins` runs in the build workflow and fails when an
  original changes until the twin is reviewed (`--update`). Rule documented in CONTRIBUTING.
- **Docs:** new guide `docs/content/docs/guides/vapor.md` (setup, `$el` migration note for
  template refs, known differences).

8 commits, 29 files, +1393 / −65.

## Test evidence (local, 2026-11-20)

| Check | Result |
|---|---|
| `pnpm --filter reka-ui build` (vue-tsc + tsdown + postbuild) | pass; `dist/vapor.js` 211 B, `dist/shared/instance.vapor.js` 420 B |
| `pnpm --filter reka-ui check:vapor-twins` | pass (11 twins) |
| `eslint .` | pass |
| `vitest run` (jsdom, VDOM) | **3558 passed, 35 skipped** (base 3533) |

The Vapor side of these files is exercised by PR 3 (pure-Vapor run of the whole suite).

## Performance

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

## Known issues

- Pure-Vapor SSR: as-child attrs reach the element on the client only, so the first paint of
  server-rendered markup lacks them until hydration (Tabs SSR test is an expected failure in
  the Vapor run). Needs a Vue API: VUE_SSR_URL.
- Refs to Vapor components expose only what `defineExpose()` returns (no `$el`). Documented
  in the guide; asked upstream in VUE_EL_URL.
- Relies on Vue's internal `currentInstance` export (Vue >= 3.6) inside the opt-in entry only,
  until Vue offers a public API (vuejs/core#16305).

## Breaking changes

None. New export `reka-ui/vapor`; `sideEffects` changes from `false` to a list of the Vapor
entry/resolver files.

### 📝 Checklist

- [x] I have linked an issue or discussion.
- [x] I have updated the documentation accordingly.

---

</details>

### 4.7 PR 3 (`vapor-pr/3-vapor-test-suite` → `unovue/reka-ui:v2`, draft, stacked)

Body file: `vapor-proposal/upstream/bodies/7-pr-3-vapor-test-suite.md`

**Title:** test: isolated Vue 3.6 Vapor test package and a pure-Vapor run of the full suite

<details open><summary>Body (copy everything between the lines)</summary>

---

> Stacked on PR 2. Until PRs 1 and 2 are merged this PR shows their commits too; review the
> last 3.

### 🔗 Linked issue

RFC: #RFC (answers #2721). Stacked on PR 2. Expected failure tracked in VUE_SSR_URL.

### ❓ Type of change

- [ ] 📖 Documentation (updates to the documentation, readme or JSdoc annotations)
- [ ] 🐞 Bug fix (a non-breaking change that fixes an issue)
- [ ] 👌 Enhancement (improving an existing functionality like performance)
- [ ] ✨ New feature (a non-breaking change that adds functionality)
- [x] 🧹 Chore (updates to the build process or auxiliary tools and libraries)
- [ ] ⚠️ Breaking change (fix or feature that would cause existing functionality to change)

### 📚 Description

## Summary

- **`packages/vapor`** (private `@reka-ui/vapor-tests`, never published). It pins
  `vue@3.6.0-rc.16` **for itself only** (needed for `createVaporApp`, Vapor SSR and the rc.16
  interop fixes); `packages/core` keeps its Vue range. It contains:
  - 48 fixture families run in VDOM, `vdom-app + interop`, `vapor-app + interop` and pure Vapor;
  - **`test:full-suite`**: Reka's own `packages/core/src/**/*.test.ts`, unchanged in intent,
    compiled as pure Vapor (`createVaporApp`, no interop) through a Vite plugin that swaps in
    the `*.vapor.*` twins, with VTU / Testing Library adapters and a render-function bridge for
    tests written with `h()`;
  - a benchmark harness (`bench/run.mjs`, real Chrome via playwright-core).
- Existing tests become mode-aware only where VDOM and Vapor legitimately differ (comment
  anchors in markup, SSR module resets, the Vue SSR gap). VDOM assertions are unchanged.
- `test:no-options-api` probe; root `pnpm test:vapor`.

3 commits, 167 files, +7168 / −183 (+6955 / −50 without the lockfile).

## Test evidence (local, 2026-11-20)

| Check | Result |
|---|---|
| `pnpm --filter reka-ui build`, `check:vapor-twins`, `eslint .` | pass |
| `vitest run` (jsdom, VDOM) | **3560 passed, 35 skipped** (base 3533) |
| Pure-Vapor full suite (`test:full-suite`) | **3559 passed, 1 expected fail, 35 skipped** (3595) |
| `test:vdom` (fixtures, VDOM baseline) | 56 passed |
| `test:interop` (both interop modes) | 116 passed, 2 expected fail |
| `test:vapor-only` (fixtures, pure Vapor) | 70 passed, 1 todo |
| `test:no-options-api` | 1 passed |

Expected failures, each with the reason in the test:
- Vapor full suite: Tabs SSR "keeps the default output when ids do not diverge" — pure-Vapor
  SSR cannot fall attrs through to a slot's root yet (VUE_SSR_URL).
- Interop: the as-child attr precedence divergence under `vaporInteropPlugin` (Vue applies
  Reka's attrs as fallthrough, so the parent wins over the child's own attrs).

## Performance

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

## Known issues

- Lockfile: pnpm resolves the peer `@vue/compiler-dom` of root-level tooling
  (`@vue/test-utils`, `@testing-library/vue`, `@antfu/eslint-config`) to the rc.16 copy
  brought in by `packages/vapor`. A clean `pnpm install --lockfile-only` from `v2` produces the
  same entries; core's `vue` stays 3.5.44 and the VDOM suite is unchanged. If maintainers
  prefer, the package can move out of the workspace or use `dedupe-peer-dependents=false`.
- Not wired into CI yet (it needs a Vue prerelease); run with `pnpm test:vapor` /
  `pnpm --filter @reka-ui/vapor-tests test:full-suite`.

## Breaking changes

None (test-only package and test changes).

### 📝 Checklist

- [x] I have linked an issue or discussion.
- [ ] I have updated the documentation accordingly. (No user-facing change in this PR.)

---

</details>

---

## 5. Step-by-step commands

Run from `/media/saeid/projects/Contribs/reka-ui`. `gh` 2.83.0 is installed but **not logged in** on
this machine: run `gh auth login` first (or do each step in the browser; the manual path is given too).

### 5.1 Log in and fork

```bash
gh auth login                       # GitHub.com, HTTPS, browser
cd /media/saeid/projects/Contribs/reka-ui
gh repo fork unovue/reka-ui --remote --remote-name fork --clone=false
git remote -v                       # origin = unovue/reka-ui, fork = <you>/reka-ui
```

Manual: fork on https://github.com/unovue/reka-ui/fork, then
`git remote add fork https://github.com/<you>/reka-ui.git`.

### 5.2 Rebase onto current `v2` (new branch names; the originals stay untouched)

See §7 for what conflicts and why. Do this in a separate worktree so the archive checkout stays clean:

```bash
git fetch origin v2
git worktree add ../wt-rebase -b vapor-pr2/1-vdom-safe vapor-pr/1-vdom-safe
cd ../wt-rebase
git rebase origin/v2                              # resolve: Autocomplete/Combobox/Form/TagGroup roots, ListboxVirtualizer
git branch vapor-pr2/2-vapor-entry vapor-pr/2-vapor-entry
git rebase --onto vapor-pr2/1-vdom-safe vapor-pr/1-vdom-safe vapor-pr2/2-vapor-entry      # + FocusScope.test.ts
git branch vapor-pr2/3-vapor-test-suite vapor-pr/3-vapor-test-suite
git rebase --onto vapor-pr2/2-vapor-entry vapor-pr/2-vapor-entry vapor-pr2/3-vapor-test-suite
#   + Checkbox story (take upstream's #3261 version, drop ours), Collapsible/Primitive/Tabs tests, pnpm-lock.yaml
#   lockfile conflict: `git checkout origin/v2 -- pnpm-lock.yaml && pnpm install && git add pnpm-lock.yaml`, then `git rebase --continue`
pnpm install
pnpm --filter reka-ui check:vapor-twins           # will flag Primitive, Slot, DialogContent: port upstream changes, then --update
```

Then re-run every gate in §8 on each rebased tip and update the numbers in the bodies.
From here on, the commands use the rebased names `vapor-pr2/*`; if `v2` has not moved by the time you
post (it has), use `vapor-pr/*` instead.

### 5.3 Push the three branches to your fork

```bash
git push -u fork vapor-pr2/1-vdom-safe:vapor/1-vdom-safe
git push -u fork vapor-pr2/2-vapor-entry:vapor/2-vapor-entry
git push -u fork vapor-pr2/3-vapor-test-suite:vapor/3-vapor-test-suite
```

### 5.4 Create the issues (steps 1–4 of §3)

Reka accepts plain issues, so `gh` works:

```bash
B=vapor-proposal/upstream/bodies
gh issue create -R unovue/reka-ui --title "$(cat $B/1-reka-rfc.title.txt)" --body-file $B/1-reka-rfc.md --label "feature request"
```

(If `--label` is refused because you lack triage rights, drop it.) The command prints the issue URL; its
number is `RFC` below.

**Vue and VueUse: use the browser forms**, not `gh`. Both repos disable blank issues and require a
reproduction link in the form, and issues without one get closed:

- `$el` bug (§4.3): https://github.com/vuejs/core/issues/new?template=bug_report.yml. Fields: Vue
  version `3.6.0-rc.16`; reproduction link (make a https://play.vuejs.org link with the two SFCs, Vapor
  on); steps / expected / actual from the body.
- Attrs-to-slot-root, incl. SSR (§4.2): vuejs/core routes **feature requests** to
  https://github.com/vuejs/rfcs/discussions. Either post it there (the official route), or, once you
  have a StackBlitz repro that shows `createVaporSSRApp` + `renderToString` output differing from the
  client, file it with the bug form above. Decide which before posting (see the report).
- VueUse (§4.4): https://github.com/vueuse/vueuse/issues/new?template=bug_report.yml. Reproduction: a
  StackBlitz with `vue@3.6.0-rc.16` (or the current 3.6) and the `useMounted` SFC from the body; tick
  the validation boxes.

Paste the title and the body file's text into the matching fields (move the steps/expected/actual
paragraphs into their own fields for the Vue bug form). Note each URL.
### 5.5 Fill the links back in

```bash
RFC=1234                                             # Reka RFC issue number
VUE_SSR_URL=https://github.com/vuejs/core/issues/NNNNN
VUE_EL_URL=https://github.com/vuejs/core/issues/NNNNN
VUEUSE_URL=https://github.com/vueuse/vueuse/issues/NNNN
sed -i "s/(link to follow)<!--\([A-Z_]*\)-->/\1/g; s|#RFC|#$RFC|g; s|VUE_SSR_URL|$VUE_SSR_URL|g; s|VUE_EL_URL|$VUE_EL_URL|g; s|VUEUSE_URL|$VUEUSE_URL|g" $B/*.md
# Update the RFC itself with the three upstream links:
gh issue edit $RFC -R unovue/reka-ui --body-file $B/1-reka-rfc.md
```

Also put the Vue SSR URL into the `it.fails` comment of the Tabs SSR test
(`packages/core/src/Tabs/Tabs.test.ts`) on the rebased PR 3 branch and amend/push that branch (it is
your fork branch, so that is fine).

### 5.6 Open the PRs

GitHub only allows a PR into `unovue/reka-ui` to target a branch that exists in `unovue/reka-ui`, so a
stack from a fork cannot be expressed with `--base`. Two options:

- **A (recommended): all three against `v2`, PR 2 and PR 3 as drafts.** Each body says "stacked on
  PR N, review the last K commits". Maintainers see the whole plan, CI runs on each, and nothing waits
  on you. After PR 1 merges: `git rebase --onto origin/v2 <old PR1 tip> vapor-pr2/2-vapor-entry`,
  `git push --force-with-lease fork vapor-pr2/2-vapor-entry:vapor/2-vapor-entry`, mark PR 2 ready; same for PR 3.
- **B: open only PR 1, wait for it to merge, then open PR 2, then PR 3.** Clean diffs, but slow, and
  reviewers cannot see where the seam in PR 1 leads. Use B only if maintainers ask for it.

```bash
ME=$(gh api user -q .login)
gh pr create -R unovue/reka-ui --base v2 --head $ME:vapor/1-vdom-safe \
  --title "$(cat $B/5-pr-1-vdom-safe.title.txt)" --body-file $B/5-pr-1-vdom-safe.md
gh pr create -R unovue/reka-ui --base v2 --head $ME:vapor/2-vapor-entry --draft \
  --title "$(cat $B/6-pr-2-vapor-entry.title.txt)" --body-file $B/6-pr-2-vapor-entry.md
gh pr create -R unovue/reka-ui --base v2 --head $ME:vapor/3-vapor-test-suite --draft \
  --title "$(cat $B/7-pr-3-vapor-test-suite.title.txt)" --body-file $B/7-pr-3-vapor-test-suite.md
```

Then replace `PR 1` / `PR 2` mentions with the real numbers: `gh pr edit <n> -R unovue/reka-ui --body-file ...`
after editing the body files, and add a comment on the RFC listing the three PRs:
`gh issue comment $RFC -R unovue/reka-ui --body "Implementation: #<pr1> (VDOM-safe prep), #<pr2> (reka-ui/vapor + twins, draft), #<pr3> (Vapor test package, draft)."`

Manual path: https://github.com/unovue/reka-ui/compare/v2...<you>:reka-ui:vapor/1-vdom-safe (and the same
for 2 and 3, choosing "Create draft pull request").

---

## 6. Known issues, limitations, likely maintainer questions

### Known issues and limitations

- **QS7, Tabs SSR in pure Vapor (expected failure).** Under `createVaporSSRApp`, as-child attrs reach
  the element only on the client, so first paint of server HTML lacks `tabindex`, `data-orientation`,
  collection/roving attrs until hydration. Marked `it.fails` in the Vapor run only. A Reka-side fix
  (server string merge) was tried and reverted: it cannot see attrs the child binds to `false` and broke
  Rating hydration (patch kept in `vapor-proposal/experiments/`). Needs the Vue API in §4.2.
- **QS9, `$el` on refs to Vapor components.** Vapor refs expose only `defineExpose()` output; wrapper
  components that users ref must `defineExpose({ $el })`. Reka's own red test was a bridge bug (fixed,
  `e3908a5e8`); the user-facing difference is documented in the Vapor guide and in §4.3.
- **QS17, Dialog dev-warning test flake.** Dialog `console.warn` assertions failed intermittently under
  pure Vapor in earlier runs; green in every full run on 2026-11-20. Time-boxed: if it recurs, run with
  `--sequence.shuffle` and a seed; never ship it with `retry`.
- **Vue prerelease pin.** `packages/vapor` pins `vue@3.6.0-rc.16`. `packages/core` keeps its range
  (dev `vue` 3.5.44). pnpm resolves root tooling's peer `@vue/compiler-dom` to the rc.16 copy in the
  lockfile (PR 3 known issue; alternative: move the package out of the workspace or
  `dedupe-peer-dependents=false`).
- **Internal Vue API.** The opt-in entry reads Vue's internal `currentInstance` (Vue ≥ 3.6) until
  [vuejs/core#16305](https://github.com/vuejs/core/issues/16305) gives a public API.
- **`vaporH.ts` bridge size.** 746 lines that translate `h()`-based tests to Vapor. It is the biggest
  long-term maintenance risk; raise it in the RFC (question 4) before maintainers find it in PR 3. It
  still matches unkeyed siblings by position (no identity keying yet).
- **Interop precedence divergence.** Under `vaporInteropPlugin`, Vue applies Reka's attrs as
  fallthrough, so the parent wins over the child's own attrs (2 expected fails in the interop fixtures).

### Likely maintainer questions (with answers)

1. **"Does this change anything for current users?"** No. PR 1 is a refactor with VDOM tests
   3533 → 3548 (new tests only). The default entry never imports Vue 3.6 APIs; Vue 3.4/3.5 and
   tree-shaking are unaffected. `sideEffects` changes from `false` to a list of two Vapor files.
2. **"Why not `if (isVapor)` in the components?"** Shared sources stay mode-agnostic; where timing
   differs, a tiny swapped module (`stackTiming`, `triggerIdSync`) carries the difference, and the
   twin drift check fails CI when an original changes.
3. **"How many twins, and how big?"** 11, listed in §2. `FocusScope` went from a 371-line copy to a
   swapped timing helper; the `ListboxItem` and `ComboboxContent` twins were deleted in the cleanup.
4. **"Who keeps twins in sync?"** `check:vapor-twins` (sha12 per original) runs in the build workflow;
   the CONTRIBUTING rule explains porting and `--update`.
5. **"Why a prerelease pin in the repo?"** Only the private test package needs it (for
   `createVaporApp`, Vapor SSR and the rc.16 interop fixes). It can stay out of CI until Vue 3.6 is
   stable, or run as a non-blocking job.
6. **"Is Vapor actually faster with Reka?"** See §1: VDOM unchanged within noise; the Vapor build is 8–28 % faster than before with 28 % less residual memory, almost entirely thanks to Vue 3.6.0-rc.16; this stack's own code is about neutral on top of rc.16.
7. **"Separate package?"** Open question in the RFC; the current shape (`reka-ui/vapor` subpath) costs
   nothing for VDOM users. A Vapor-compiled distributable is a later step either way.
8. **"Can PR 3 be smaller?"** Most of its size is fixtures and the suite runner. The bridge could be
   dropped if tests move from `h()` to SFC fixtures over time; that is a reasonable follow-up.

---

## 7. Pre-flight checklist

- [ ] **Rebase onto current `v2`.** `origin/v2` is `f67a0e082`, 55 commits past the base `a9873a029`.
      A dry merge (`git merge-tree`) conflicts in:
      - PR 1: `Autocomplete/AutocompleteRoot.vue`, `Combobox/ComboboxRoot.vue`, `Form/FormRoot.vue`,
        `Listbox/ListboxVirtualizer.vue`, `TagGroup/TagGroupRoot.vue`.
      - PR 2 adds: `FocusScope/FocusScope.test.ts` (upstream #3290, #3320 changed FocusScope stack handling;
        re-check `stackTiming.vapor.ts` against them).
      - PR 3 adds: `Checkbox/story/_Checkbox.vue` (take upstream's #3261 version and drop ours),
        `Collapsible/Collapsible.test.ts`, `Primitive/Primitive.test.ts`, `Tabs/Tabs.test.ts`, `pnpm-lock.yaml`.
      - Twin originals changed upstream: `Primitive/Primitive.ts` (d01c58180, #3271 unsafe `as`),
        `Primitive/Slot.ts` (1cc2b2143, #3327 disabled attr), `Dialog/DialogContent.vue` (24cc6d65f, #2066).
        Port each to its `.vapor` twin, then `check:vapor-twins --update`.
      Rebase onto **new** branch names (§5.2) so the verified `vapor-pr/*` branches stay as they are.
- [ ] Re-run all gates (§8) on each rebased tip; update the numbers in the bodies and in this file.
- [ ] Re-check that the Vue issues are not already filed/fixed (search "vapor slot attrs ssr",
      "vapor template ref $el") and whether a newer Vue 3.6 RC/stable changes QS7 or QS9.
- [ ] Commit messages follow Conventional Commits with family scopes (`CONTRIBUTING.md`); commitlint and
      lint-staged run via simple-git-hooks on commit. Already true for all 17 commits.
- [ ] **CLA / sign-off:** `CONTRIBUTING.md` and the PR template ask for neither a CLA nor `Signed-off-by`.
      Nothing to do.
- [ ] PR template: each body already has the "Linked issue", "Type of change" and checklist sections.
- [ ] Bundle-size CI runs on PRs; PR 1 and PR 2 change the VDOM bundle by +139 B gzip on the VDOM bench bundle (+0.2 %, measured on the full stack).
- [ ] `gh auth login` done; fork exists; remote `fork` added.
- [ ] Optional: delete `~/reka-move` and the leftover worktrees listed in §8.

---

## 8. Re-running the gates and the benchmarks

Gates (run in the worktree of the branch you want to check; `pnpm@10.13.1`, Node 24):

```bash
pnpm install --frozen-lockfile
pnpm --filter reka-ui build
pnpm lint
pnpm --filter reka-ui test:run                         # VDOM jsdom suite
pnpm --filter reka-ui check:vapor-twins                # PR 2+
pnpm --filter reka-ui test:no-options-api              # PR 3
(cd packages/vapor && pnpm exec vitest run -c vitest.suite.config.ts --maxWorkers=4)   # pure-Vapor full suite, PR 3
(cd packages/vapor && pnpm test)                       # fixture families, PR 3
```

Keep `--maxWorkers=4` on this machine: higher counts got the run killed by earlyoom before.
The script used for the box verification is `/media/saeid/projects/Contribs/box-run/verify.sh`
(paths point at the box; change `/workspace/Contribs` to `/media/saeid/projects/Contribs`).

Benchmarks (what produced `PERF_RESULTS_LOCAL.md`):

```bash
cd /media/saeid/projects/Contribs/reka-ui
git worktree add --detach ../wt-bench/before a1e9d43d2      # before this round (vue rc.15)
git worktree add --detach ../wt-bench/vue16  6e02e7b96      # only the rc.16 bump
git worktree add --detach ../wt-bench/now    <commit>       # what you want to measure
for w in before vue16 now; do (cd ../wt-bench/$w && pnpm install --frozen-lockfile); done
setsid nohup ../local-run/bench.sh > ../local-run/logs/bench/runner.out 2>&1 &   # 2 passes, reversed order, ~45 min
cat ../local-run/logs/bench/summary.txt                    # load per run, exit codes
L=../local-run/logs/bench
node ../local-run/perfcmp.mjs $L/before-1.json,$L/before-2.json $L/now-1.json,$L/now-2.json $L/vue16-1.json,$L/vue16-2.json
```

`bench.sh` runs `packages/vapor/bench/run.mjs` (Chrome via playwright-core, CPU throttle 4×, 10 runs +
3 warm-up per scenario) in each worktree. Close other heavy jobs (vitest, eslint, playwright) first.
Clean up with `git worktree remove ../wt-bench/<name>`.

Worktrees right now: `../wt-bench/*` were removed after the 2026-11-20 run (recreate them with the
commands above). Still present from earlier work: `../reka-wt/base` (detached at `a9873a029`) and
`../reka-wt/stack` (has `vapor-pr/3-vapor-test-suite` checked out, so that branch cannot be checked out
elsewhere until you remove it); `/tmp/reka-ab-manual` and `/tmp/reka-ab3` are stale (`git worktree prune`).
