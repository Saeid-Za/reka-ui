# Maintainability audit: Vapor branches and twins (2026-11-20, Asia/Tehran)

Scope: `packages/core/src` product files (tests, `story/`, `__probe__` excluded) at the
post-audit tip, plus the twin maps in `packages/vapor/rekaVapor.ts`. Maintainers are
expected to reject `if (isVapor)` branches inside shared product sources.

## 1. Runtime Vapor branches in shared product files

| File | Line(s) | What it does | Verdict |
|---|---|---|---|
| `shared/instance.ts` | many | The adapter: `getInstance`, `isVaporInstance`, block/element lookup. | **Keep.** This is the single place that is *meant* to know about both instance shapes; everything else should go through it. |
| `shared/useForwardExpose.ts` | 31 | Delegates to the Vapor implementation registered by `instance.vapor.ts` (no Vapor code in the default build). | **Keep** (registry hook, not inline logic). |
| `shared/resolveElement.ts` | 28 | Vapor ref without `$el` → first block element. | **Keep / move into `instance.ts`** (`resolveInstanceElement()`); low value, cosmetic. |
| `shared/useForwardScopeId.ts` | 24 | `instance.scopeId` vs `instance.vnode.scopeId`. | **Move into `instance.ts`** as `getInstanceScopeId()`; trivial, recommended before upstream. |
| `shared/useTriggerId.ts` | 75–100, 188 | Vapor: watch `attrs.id` + MutationObserver on `id` (no update hook for attr-only changes); skip `$forceUpdate`. | **Recommend twin hook** (`useTriggerId.vapor.ts` swapped like `useForwardExpose`). Largest inline branch left; not moved this pass (shared by every trigger, needs its own gate). |
| `TagGroup/TagGroupRoot.vue` | 190–200 (`ee148a24c`) | Vapor-only post-flush `tabIndex = 0` when the group is empty. | **Should not stay.** Root cause is the as-child applier (`Primitive/asChildAttrs.ts`) snapshotting `childOwned` once, so a *reactive* child-owned attr (`tabindex` only bound when empty) loses to RovingFocusGroup's `-1`. Fix belongs in the applier (track the child's bound keys reactively), then delete the TagGroup branch. A whole-SFC twin would be worse (300 lines of drift). Not moved this pass: an applier change touches every as-child layer. |

## 2. Twins (`rekaVapor.ts`)

| Twin | Size vs original | Needed? | Verdict |
|---|---|---|---|
| `SWAPS` Primitive / Slot / Presence / Collection | rewrites (vnode APIs) | Yes | **Keep** (ADR-001 core). |
| `DialogContent.vapor.vue` | v-show → `:style` | Yes (removing it fails 5 Dialog tests) | **Keep**; or move the `present`→`display` logic into `DialogContentImpl` like QS14 and delete. Twin is already drifting (missing comments added upstream since). |
| `ComboboxContent.vapor.vue` | v-show → `:style` | **No** since QS14 `604dea598` | **Deleted** in `b879aea7a`. |
| `AlertDialogCancel.vapor.vue` | +watch re-register | **No**: 9.2 was a harness reconciliation bug | **Deleted** with the shared AlertDialog owner Map in `e6f798f89`. |
| `FocusScope.vapor.vue` (`129abab66`) | **371-line full copy** for a ~3-line difference (stack add in setup) | Yes for QS15 | **Revisit.** Extract the registration timing into a tiny module (`focusScopeStack.ts` + `.vapor.ts`) and swap only that, or prove sync add is VDOM-safe. Full-file twin will drift. |
| `ListboxItem.vapor.vue` (`0ed4724d2`) | full copy + 70 lines of rawProps re-application | Only for one render-function-bridge test | **Revisit.** It broke ColorSwatchPicker + Combobox highlight (getters applied as values); fixed in `ae9c10ec1`. It reads `instance.rawProps` internals and re-applies listeners on top of native fallthrough (double-listener risk). Compiled-template Vapor fallthrough is already reactive; the failing test uses `h()`. Prefer fixing the bridge (`vaporH.ts`) and deleting the twin. |

## 3. FIX_PLAN_8 changes made in shared files

| Commit | Change | Shared improvement or Vapor-only? | Recommendation |
|---|---|---|---|
| `ee148a24c` TagGroup | Vapor-guarded tabIndex patch | Vapor-only workaround | Fix in applier, delete (see §1). |
| `f0ddd2351` AlertDialog owner Map | Owner-keyed cancel registration + twin | Not needed: the harness `data-testid` match alone keeps 6/6 in both modes | **Reverted** (`e6f798f89`). |
| `456194c50` Combobox QS16 | (a) tighter `modelValue` watch; (b) on close, copy `input.value` into the model when `resetSearchTermOnBlur=false` | (b) is test-driven: its own comment cites the harness assignment `input.element.value = 'Testing'` with no `input` event; removing (b) re-reds only that test in Vapor, VDOM stays 113/113. (a) changes VDOM semantics for deep-mutated objects (same ref → no reset). | Drop (b), mark the test with a QS16 note (or fix the test to dispatch `input`, which is what users do); keep (a) only with a VDOM test for object models. |
| `604dea598` (QS14) | `ComboboxContentImpl` `display` from `present` | Legit shared change: VDOM already hid via `v-show`; `present` defaults `true`; consumer `style` still merges after. | **Keep**; enabled deleting a twin. |

## 4. Decision review (read from the diffs, not the docs)

| Decision | Verdict | Evidence / suggestion |
|---|---|---|
| Vue rc.16 pin (`6e02e7b96`) | Keep, revisit | Needed for #16340. Cost: rc.16 broke the Checkbox story, which was papered over in the story file (`374fa886a`). Lockfile churn (-240 lines) will conflict upstream, so keep it out of the Reka PR. |
| Checkbox story `v-bind` (`374fa886a`) | Revisit | Its comment says Vapor `defineProps` materialises omitted `trueValue`/`falseValue` as `false` on rc.16, which VDOM does not do. That is a Vue Vapor vs VDOM prop-casting difference that users with `v-bind="props"` wrappers will hit. Build a minimal repro and file it upstream; keep the story change only as a workaround. |
| QS7 real SSR fix | Change to accept + upstream | Path B was tried in full (§ OPEN_QUESTIONS QS7). A string merge greens Tabs but breaks Rating hydration. Needs a Vue API. |
| QS9 A+C, red test | Change the presentation | Keep the contract but mark it `it.fails` when `isVapor`, linking the Vue draft. The suite then goes green and stays honest (it flips red when Vue adds `$el`). A permanent red trains people to ignore the gate. |
| QS12 VaporTransition mount-once (`811de613e`) | Keep (harness-only), add coverage | It only touches `suite/vaporH.ts`, so it proves nothing about real Vapor `<Transition mode="out-in">`. Add one compiled-SFC story test (Slider in out-in) so a real Vapor Transition bug cannot hide behind the bridge. |
| QS14 present→display (`604dea598`) | Keep | VDOM equivalent: `present` defaults `true`, VDOM `v-show` already hid, and consumer `style` still merges after. It also let the twin be deleted. Add a VDOM test for `forceMount` + closed + consumer `style.display` to pin it down. |
| QS15 FocusScope twin (`129abab66`) | Revisit | 371-line copy for a ~3-line timing change, so drift is guaranteed. Also, Vapor registering in setup vs VDOM on `nextTick` changes stack order when scopes nest (siblings that mount in the same tick). Extract only the registration into a swapped module, and add a nested-scope test that runs in both modes. |
| QS16 (`456194c50`) | Change | The DOM→model copy on close exists for a harness assignment without an `input` event (verified: removing it re-reds only that Vapor test; VDOM 113/113). Drop it. The watch guard alters deep-object semantics, so keep it only with a VDOM test. |
| 9.2 AlertDialog | Changed | Product owner Map + twin reverted (`e6f798f89`); the harness fix was enough. The `data-testid` matching in `vaporH.ts` is a smell: the bridge reconciles unkeyed siblings by position. Long term, key-by-identity in the bridge (or require keys in the test) instead of testid heuristics. |
| 9.4 popoverSsrHarness | Revisit | Regex-rewrites one test's source, including `if (!isVapor) vi.resetModules()`. That is brittle (silently no-ops if the test changes) and invisible to readers. Prefer an explicit `isVapor` branch in the test (QS6 precedent) or a generic single-runtime fix with no source rewrite. |
| Listbox twin (`0ed4724d2`) | Revisit | Caused 3 regressions (fixed `ae9c10ec1`). It reads `rawProps` internals and only serves an `h()` bridge test. Fix the bridge and delete it. |
| TagGroup (`ee148a24c`) | Change | Inline `isVaporInstance` branch in product SFC; fix the as-child applier instead (§1). |
| QS17 flaky acceptance | Keep, time-boxed | Green in all 4 full runs today. If it recurs, run `--sequence.shuffle` with a seed and capture it. Do not ship with `retry`. |
| ADR-001 twin strategy | Keep, with a rule | Twin only modules that use vnode APIs or truly diverge, and keep twins *small* (swap a hook or helper, not a 300-line SFC). Add a CI check that diffs each `.vapor.vue` against its source so drift is visible. |
| VueUse shim (ADR-010) | Keep for now | VueUse #5050 (`getCurrentScope` fallback) only covers `provideLocal`/`injectLocal`. Lifecycle helpers need an instance, and `$el` needs a block. Open a VueUse issue for `useMounted`/`tryOnMounted`/`useParentElement` under Vapor and link it. |
| Stopping Phase F perf | Keep | One reverted experiment, no profile-backed lever. Correctness and maintainability work have higher value. |


## 5. Outcome of the approved recommendations (2026-11-20)

Final gate (2026-11-20, Asia/Tehran, archive `605cbfc59`, Vue 3.6.0-rc.16):
pure-Vapor full suite **3559 passed / 1 expected fail / 35 skipped (3595)**, exit 0;
`pnpm test:run` **3560 passed / 35 skipped (3595)**, exit 0. vue-tsc, build, eslint and the
twin drift check pass. The one expected failure is QS7 (Tabs SSR, `it.fails` in Vapor only).
PR branches: see `upstream/` and `/media/saeid/projects/Contribs/PR_READY.md`.

| # | Item | Archive commit(s) | Outcome |
|---|---|---|---|
| 1 | QS9 | `e3908a5e8` | Real cause was the test bridge not releasing component refs on unmount. Fixed in `vaporH.ts`; test passes honestly, no `it.fails`. Also fixed 4 unhandled rejections (`c68477826`, Select comment anchor). QS7 marked `it.fails` in Vapor only (`a0ff5e503`). |
| 2 | QS16 | `7b8a44cda` | DOM→model copy dropped; product files back to upstream. Cause was the test assigning `input.element.value` without an input event (now `setValue`). Watch guard not needed (it broke in-place mutation). Object-model tests added, both modes. |
| 3 | TagGroup | `af5bf6735` | Vapor branch removed from `TagGroupRoot.vue`; the as-child applier now lets attrs a child binds itself win (`registerOwnAttrs`). |
| 4 | FocusScope | `a1ee4d7a1` | 371-line twin deleted; only `stackTiming(.vapor).ts` is swapped. Negative control: without the swap QS15 fails. Nested-scope test added, both modes. |
| 5 | ListboxItem twin | `1b6617ecb` | Deleted; the bridge fix covers it. |
| 6 | 9.4 | `cb36836a6` | Regex test rewrite and `popoverSsrHarness.ts` removed; explicit `if (!isVapor) vi.resetModules()` in the test. |
| 7 | 9.2 | `6ea474e10` | `data-testid` matching removed; the bridge keeps positions of empty children (`HOLE`). |
| 8 | useTriggerId etc. | `39d3dc919` | `triggerIdSync(.vapor).ts` swap; `resolveElement` / `useForwardScopeId` via `instance.ts` helpers. No `isVapor` left in shared product sources (only `isVaporInstance` dispatch in `instance.ts` / `useForwardExpose.ts`). |
| 9 | QS14 / QS12 tests | `3618f6406`, `9444ebd37` | QS14: closed persistent content hidden + consumer style kept (VDOM passes with or without the fix; Vapor needs it); `force-mount` stays consumer-controlled (upstream semantics, so "forceMount + closed" is visible by design). QS12: template-compiled `<Transition mode="out-in">` test (real Vapor Transition); without Suspense the leaving Slider is unmounted in both modes, so the test pins safety and ordering, not input. |
| 10 | Twin drift | `02eda1240`, `605cbfc59` | `check-vapor-twins.mjs` (annotation + sha12 of the original), CI step, CONTRIBUTING rule. It caught a real drift on its first run (instance.ts) and was refreshed. |
| + | Type-check | `be00b149f` | Archive had 5 vue-tsc errors (virtualizer `Key` type, Tree slot type, `findBlockElement`); merge-base was clean. Fixed. |
| + | Cleanup | `71b150573`, `ceb7f8d46`, `7873bebda` | Planning-doc references removed from code; unused import; user guide `docs/content/docs/guides/vapor.md`. |
