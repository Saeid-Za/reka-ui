# FIX_PLAN: cleaning up the dirty tree after 0b2c515e

Written 2026-11-19 17:40 (Tehran) by a reviewer, from the state of the repo at 17:32.
Audience: an agent that follows steps literally. **Do the steps in order. Do not skip,
merge, or reorder steps. Do not invent fixes that are not in this file.** When a step
says STOP, stop and report to the owner.

Repo: `/media/saeid/projects/Contribs/reka-ui`, branch `feat/vapor-full-suite`.
Last good commit: `0b2c515e` (16:00). Everything after it is uncommitted.
Backup of the dirty tree (made by the reviewer): `/media/saeid/projects/Contribs/dirty-snapshot-1732.patch`.

---

## 0. Situation in one paragraph

Between 16:00 and 17:32 the previous agent edited 34 tracked files and created 5 untracked ones
without committing. Its last full pure-Vapor run (17:30) was 3513 pass / 36 fail / 35 skip.
35 of those 36 failures are in `shared/useRenderedContentId.test.ts`. They were fixed by
ADR-S20 (commit 71bfa1d7), so the dirty tree **regressed** them. The tree also mixes good fixes with
changes that break the project rules: tests whose expected value was rewritten to match a known bug,
VDOM behaviour changes, a library-wide context change, and test-harness heuristics. This plan sorts
every hunk into KEEP, REWORK, or REVERT and re-lands the good ones one commit at a time.

## 1. Rules (apply to every step)

1. One root cause per commit. Never commit two items from this plan together.
2. Before every commit, run the **gate** (section 3) and paste its numbers into the commit body.
3. `pnpm test:run` must stay **3549 pass / 35 skip**. If it changes, the commit is wrong. Fix it or drop it.
4. Never edit a test's expected value so it matches a bug. A test may branch on `isVapor`
   only when the difference is inherent to Vapor (anchor comments, render counts,
   attribute order). The VDOM branch must stay byte-identical to upstream.
5. Never use `git stash` (the lint-staged hook stashes internally and loses work).
6. Never `vi.mock`/`skip`/`todo` a test to make it pass.
7. Every kept change gets an ADR in `vapor-proposal/DECISIONS.md` (next free number: **ADR-S22**).
   Every behaviour change that a maintainer might disagree with gets a `QS` entry in
   `vapor-proposal/OPEN_QUESTIONS.md` (next free number: **QS12**) with options and a provisional default.
8. No `console.log` in `packages/core/src` (check: `git diff --cached | grep -n console.log` must be empty).
9. Do not rewrite an existing ADR in place. Supersede it with a new one.
10. Work locally. Never push. Never open GitHub issues or PRs.

## 2. Setup (step S)

```sh
cd /media/saeid/projects/Contribs/reka-ui
# make sure no other agent is still editing this repo (no running vitest / agent session)
git status --short                     # expect ~34 M + 5 ?? files (see section 6); more is fine, they go to the backup too
git switch -c wip/dirty-1732
git add -A
git commit --no-verify -m "wip: dirty tree snapshot 17:32 (do not merge)"
git switch feat/vapor-full-suite
git status --short                     # must be EMPTY now (clean at 0b2c515e)
mkdir -p packages/vapor/suite/out
printf 'packages/vapor/suite/out/\npackages/vapor/report.json\npackages/vapor/triage.json\n' >> .gitignore
```

`--no-verify` is allowed **only** for this one backup commit on `wip/dirty-1732`.

To bring a whole file from the backup: `git checkout wip/dirty-1732 -- <path>`.
To see one file's change: `git diff 0b2c515e wip/dirty-1732 -- <path>`.
For a file marked "partial", copy only the named hunk by hand-editing. Do not check out the whole file.

## 3. The gate (run before every commit)

```sh
cd /media/saeid/projects/Contribs/reka-ui
pnpm test:run 2>&1 | tail -5                               # must be 3549 pass / 35 skip
pnpm --filter ./packages/vapor test 2>&1 | grep -E "Tests|passed|failed"   # three modes
pnpm --filter ./packages/vapor test:full-suite -- --reporter=default --reporter=json \
  --outputFile=suite/out/report.json 2>&1 | tail -5
(cd packages/vapor && node suite/report.mjs suite/out/report.json)
```

Commit body template:

```
<what and why, 2-4 lines>

Full Vapor suite: <pass> pass / <fail> fail / <skip> skip (was <...>)
pnpm test:run: 3549 pass / 35 skip
Vapor modes: vdom <n> / interop <n> / vapor-only <n>
ADR: S<nn>   QS: <nn or none>
```

## 4. Step B: baseline

Run the gate on the clean `0b2c515e` tree **before changing anything**. Write the numbers into
`vapor-proposal/FULL_SUITE.md` under a new heading `## Baseline after 0b2c515e (r9)`.
This also answers the open question from review: the total was 3619 at 36c0f04a and 3584 at 15:55.
Run `git show 36c0f04a --stat` and find which test files were added and removed between the two.
Write one sentence explaining the 35-test difference.

Commit: `docs(vapor): r9 baseline after 0b2c515e` (docs only, gate numbers in the body).

If `useRenderedContentId.test.ts` is **not** 0 failures at the baseline, STOP and report. It means
0b2c515e already regressed ADR-S20, and the owner must decide what to do.

## 5. Step H: housekeeping commit

0. Copy the plan into the repo: `cp ../FIX_PLAN.md ../HANDOFF_2.md vapor-proposal/` (they live in
   `/media/saeid/projects/Contribs/` until now, so that step S's `git add -A` doesn't sweep them into the backup branch).
1. `git checkout wip/dirty-1732 -- packages/vapor/test-native/forward-expose-heuristic.test.ts packages/vapor/test-native/keep-alive-sfc.test.ts`
2. Move the demo out of `src`: `mkdir -p packages/vapor/test-native/fixtures`, then
   `git show wip/dirty-1732:packages/vapor/src/KeepAliveDemo.vue > packages/vapor/test-native/fixtures/KeepAliveDemo.vue`,
   and change the import in `keep-alive-sfc.test.ts` to `./fixtures/KeepAliveDemo.vue`.
3. Remove both debug logs if present (they are gone in the snapshot; check with grep).
4. Gate, then commit: `test(vapor): KeepAlive SFC and forward-expose heuristic tests; ignore suite output`.

If `forward-expose-heuristic.test.ts` only passes with the REVERTed useForwardExpose rewrite (item R8),
leave it failing and note that in the commit body. Do not edit it to pass.

## 6. Inventory of every changed file (decision per hunk)

| # | File(s) | Verdict | Why |
|---|---|---|---|
| R1 | `shared/createContext.ts` (`Symbol` → `Symbol.for`) | **REVERT** | Puts every context key in the global symbol registry. Two Reka copies, or any library with a same-named context, would then share contexts. It hides a harness problem: the SSR twin and the client load two module copies. |
| R2 | `TagGroup/TagGroupRoot.vue` (`tabindex` always 0) | **REVERT** | VDOM a11y regression: adds an extra tab stop to every non-empty grid. |
| R3 | `Tabs/Tabs.test.ts` (`TABS_VAPOR_SERVER_HTML`) | **REVERT** | Rewrites the expected value to match the known bug S3/QS7. The test must stay red until QS7 is decided. |
| R4 | `Popover/Popover.ssr.test.ts` (static `Popover` in Vapor) | **REVERT** | In Vapor the doMock gate no longer applies, so the test stops testing "keep server content until content loads". |
| R5 | `DateField/DateField.test.ts` (`innerHTML` → `textContent` for all modes) | **REVERT**, then REWORK | Changes the VDOM assertion. If Vapor needs it, branch with `isVapor` (see W5). |
| R6 | `FocusScope/FocusScope.vue`, `FocusScope/stack.ts` | **REVERT** | Changes focus-trap semantics for every VDOM user: it adds to the stack in setup, drops the explanatory comment, and loses the reactive global state. Raise a QS if a Vapor test needs it (see W6). |
| R7 | `vapor/suite/vaporH.ts` hunk: `descKey` from `data-testid` | **REVERT** | Harness heuristic that invents keys. It hides key bugs. |
| R8 | `shared/useForwardExpose.vapor.ts` (the whole +144 rewrite) | **REVERT** | Scans arbitrary exposed keys for "any Element" and walks the block tree on every resolve. Wrong element in general, a perf cost, and the prime suspect for the 35 useRenderedContentId regressions. |
| R9 | `Combobox/ComboboxRoot.vue` (`setTimeout` → `nextTick`) | **REVERT** unless W9 proves it safe | VDOM timing change on blur. |
| R10 | `Dialog/DialogContent.vue`, `DialogContentImpl.vue`, `DialogOverlay.vue`, `DialogOverlayImpl.vue`, `Combobox/ComboboxContent.vue`, and the `display:` hunk + `forceMount` prop in `ComboboxContentImpl.vue` | **REVERT**, then QS12 | Replacing `v-show` with an inline `display` changes VDOM: a consumer's `style="display:…"` in `$attrs` now wins and shows hidden content. This is R7 (`unmountOnHide=false`); it needs a maintainer decision. |
| R11 | `Combobox/ComboboxInput.vue` (`syncInputValue`) | **REVERT** unless W11 reproduces it | Looks like a harness `setValue` gap patched inside Reka. |
| K1 | `AlertDialog/AlertDialogCancel.vue`, `AlertDialogContent.vue` (sender check) | **KEEP** | Correct: only the registered cancel button may clear itself. Needs a VDOM test. |
| K2 | `Presence/Presence.vapor.vue` (`onRootFragmentUpdate`) | **KEEP** | Vapor-only file, same pattern as Primitive. |
| K3 | `Primitive/Primitive.vapor.vue` (rootVersion for non-as-child, `as` watcher) + `shared/instance.ts` (`findBlockNode`, `getInstanceRootNode` fallback) | **KEEP** (one commit) | Vapor-only paths. Needs the cycle guard (see K3 step). |
| K4 | `DropdownMenu/story/_DropdownMenu.vue`, `Menubar/story/_Menubar.vue` (hoist `useEmitAsProps`) | **KEEP** | A real bug fix: a composable was called inside the template. |
| K5 | `shared/useFormControl.ts` | **KEEP** | Still `true` before mount (SSR), real value after mount. |
| K6 | `Popover/PopoverTrigger.vue` (`component :is` → `v-if/v-else`) | **KEEP** after check | Equivalent template, and Vapor handles it. VDOM snapshots must be unchanged. |
| K7 | `Stepper/StepperRoot.vue` (`<template v-if>` announcement) | **KEEP** after check | Only if `pnpm test:run` snapshots are unchanged. |
| K8 | `Combobox/Combobox.test.ts` (`isVapor ? 1 : 3` render counts) | **KEEP** | Allowed `isVapor` branch: render counts are inherently different. Add a comment saying so. |
| K9 | `Popover/Popover.test.ts` (re-import `vue`/VTU after `resetModules`) | **KEEP** after check | Needed so the test uses the fresh module graph. VDOM must still pass. |
| W5 | DateField (rework of R5) | REWORK | Only if the Vapor DateField test fails because of anchors. |
| W6 | FocusScope (rework of R6) | REWORK → QS | |
| W9 | ComboboxRoot (check of R9) | CHECK | |
| W11 | ComboboxInput (check of R11) | CHECK | |
| W12 | `ComboboxContentImpl.vue` focus hunk (`checkFocusInput`, `hasFocusedInput`, watchers) | REWORK | Mixed with R10 in one file. Separate it, test it in VDOM, then decide. |
| W13 | `Toast/Toast.test.ts` (query current viewport) | REWORK | Changes the VDOM path too. Make it an `isVapor` branch, or prove the element really is replaced in both modes. |
| W14 | `shared/useForwardScopeId.ts` (read `scopeId` from the Vapor instance) | REWORK | Reverses an earlier decision ("Vapor stamps scope ids itself"). Needs an ADR and a test against double stamping. |
| H1 | `vapor/suite/vaporH.ts` other hunks: async setup, `Suspense`, `VaporTransition` slot, `rawProps.key` from `propsRef` | KEEP (harness, one commit per feature) | Harness capabilities. Each needs an ADR line. |
| H2 | `vapor/suite/vue-test.ts` (`defineAsyncComponent` → `defineVaporAsyncComponent`) | KEEP (harness) | |
| H3 | `vapor/suite/testFileVue.ts` (regex widened to `/test/*.ts`) | KEEP with ADR | Harness scope change. List which files it now affects. |
| H4 | `vapor/suite/ssrTwins.ts` (hard-coded `useBodyScrollLock`) | REWORK | Hard-coding a file name is a hack. Replace it with a documented rule, or keep it with an ADR and a comment that explains why this module must not be twinned (it relates to S1). |

Anything not in this table: do not bring it over. Report it.

## 7. Execution order (one commit each, gate before each)

1. **S**, **B**, **H** from sections 2, 4 and 5.
2. **K4** story files: `git checkout wip/dirty-1732 -- packages/core/src/DropdownMenu/story/_DropdownMenu.vue packages/core/src/Menubar/story/_Menubar.vue`. Commit `fix(stories): call useEmitAsProps in setup, not in the template`.
3. **K5** useFormControl. Commit `fix(useFormControl): read closest('form') only after mount`. ADR-S22.
4. **K1** AlertDialog. Add a VDOM test in `AlertDialog/AlertDialog.test.ts`: two cancel buttons; unmount the
   non-registered one; the registered one must stay registered (Escape/initial focus goes to it).
   Commit `fix(AlertDialog): only the registered cancel button can release itself`. ADR-S23.
5. **K3** Primitive.vapor + instance.ts. Before committing, add a `seen = new WeakSet()` cycle guard to
   `findBlockElement`, `findBlockNode` and the walk in `onRootFragmentUpdate` (they recurse through
   `forwarded` and `$block` and can loop). Commit `fix(vapor): resolve root nodes through forwarded refs and non-element blocks`. ADR-S24.
6. **K2** Presence.vapor. Commit `fix(Presence.vapor): re-sync as-child attrs on root fragment updates`. ADR-S25.
7. Run the gate. **Check useRenderedContentId.** If it is not back to the baseline failure count, STOP and report
   which of steps 2–6 changed it (bisect by commit: `git stash` is forbidden, use `git switch --detach <sha>`).
8. **K6** PopoverTrigger. Check: `pnpm test:run` has no snapshot changes in Popover. Commit `refactor(PopoverTrigger): v-if/v-else instead of a dynamic component`. ADR-S26 (why Vapor needs it).
9. **K7** StepperRoot. Same snapshot check. If any VDOM snapshot changes, DROP K7 and write QS12-stepper instead.
10. **K8**, **K9** test-only commits (one each). Each `isVapor` branch gets a one-line comment that names the inherent difference.
11. **H2**, then **H1** split into: (a) async setup, (b) Suspense, (c) VaporTransition slot, (d) key from propsRef.
    One harness commit each, so each one's effect on the counts is visible. Skip R7's `descKey` hunk.
12. **H3** testFileVue. ADR lists the files the wider regex now affects (`rg -l "" packages/core/src --glob '**/test/*.ts'`).
13. **H4** ssrTwins: rework as described in the table, then commit with an ADR.
14. **W14** useForwardScopeId: write ADR-S2x "supersedes the earlier scope-id decision because <evidence>". Add a test
    that renders a scoped child through Reka in pure Vapor and asserts the scope attribute appears **once**. If
    you can't show double-stamping is impossible, keep the old behaviour and leave R6 (useForwardScopeId 3 tests) red.
15. **W12** ComboboxContentImpl focus hunk only (no `display`/`forceMount`). Needs: `pnpm test:run` unchanged, plus one
    VDOM test for the case it fixes. If no VDOM test fails without it and it only helps Vapor, explain why in the ADR.
16. **W13** Toast test: rewrite as `const viewport = isVapor ? (document.querySelector('[data-viewport="b"]') as HTMLElement) : newViewport`, with a comment.
17. **W5** DateField: only if the Vapor run fails there. Use `isVapor ? x.textContent : x.innerHTML`.
18. **W9** ComboboxRoot: run `git log -L '/setTimeout/,+4:packages/core/src/Combobox/ComboboxRoot.vue'` and read
    the upstream commit and PR that added the 1 ms timeout. If its reason still applies, keep `setTimeout` and leave the Vapor
    test red with a QS. If it doesn't, the change needs a VDOM test that proves the old reason no longer applies.
19. **W11** ComboboxInput: write a `test-native` test that mounts a real Vapor SFC Combobox and types with
    `userEvent.type`. If it fails without `syncInputValue`, keep the fix (ADR). If it passes, the bug is in the
    harness's `setValue`: fix that in `suite/test-utils.ts` instead and leave Reka alone.
20. **QS12** Dialog/Combobox `unmountOnHide=false` (R10). Write the QS with options:
    (a) keep `v-show` in VDOM and use a Vapor-only path (a twin or an `isVapor` compile-time flag);
    (b) inline `display` with a guard so consumer attrs cannot override it (VDOM behaviour change);
    (c) leave R7's 5 tests red until Vue Vapor supports `v-show` on components.
    Provisional default: (c). **Do not implement.**
21. **QS13** FocusScope stack (R6/W6), only if a Vapor test needs it. Describe which test, what fails, and the options. Do not implement.
22. **QS7 note**: add a line under QS7 that the Tabs SSR test stays red on purpose (R3).

## 8. Leftovers from the 0b2c515e review (after section 7)

23. Virtualizer key: in `ListboxVirtualizer.vue` the template uses `:key="item.key"`, but the comment at
    "A row has its index as its key" depends on index keys. Check whether Reka passes `getItemKey` anywhere
    (`rg getItemKey packages/core/src`). If it doesn't, `item.key === item.index`, so write that in the ADR. Otherwise switch back to `:key="item.index"`.
24. Fragment slot: add VDOM tests to all three virtualizers where the slot renders `<template v-if>` and a
    fragment. They passed before (the old code unwrapped fragments). They must pass now.
25. VDOM A/B for the virtualizers: a 10k-option virtualized Listbox, mount + scroll + unmount + memory, comparing
    `0b2c515e~1` against HEAD. Use `reka-vapor-export/scripts/ab.sh` (fix its paths to this repo first). Log it in `PERF_LOG.md`.
    If VDOM regresses more than 5 %, STOP and report.
26. `$block` in Primitive's public expose → rename to a `Symbol('reka.block')` key (import it from `shared/instance.ts`).
    Type `forwarded` in `VaporInstanceLike` with a doc comment.
27. ADR-S21 was rewritten in place. Restore the original text from `git show 36c0f04a:vapor-proposal/DECISIONS.md`,
    and add a new ADR "supersedes S21: twins dropped, unified template" with the reasons.
28. Commit `0b2c515e` has an empty body. Do NOT rewrite history. Add its numbers to `FULL_SUITE.md` (r9 baseline) instead.
29. Regenerate the triage table in `FULL_SUITE.md` from the latest `suite/out/report.json` with
    `node suite/triage.mjs suite/out/report.json suite/out/triage.json`. Never hand-edit counts.

## 9. Then (only after 1–29)

Continue with the remaining failures in this order: `Listbox reactive fallthrough attrs` (1) → R6 scope-id →
SSR S1/S2 (fix the harness module loading, not the tests) → U9 singles. Same rules, same gate.

## 10. When to STOP and report to the owner

- The `pnpm test:run` count changes and you can't fix it within the same item.
- A step needs a decision that this file doesn't make.
- useRenderedContentId does not return to its baseline at step 7.
- A test only passes if you change its expected value (other than an inherent `isVapor` difference).
- The VDOM A/B regresses more than 5 %.

Report format: the item number, what you tried, the gate numbers, and the files touched.
