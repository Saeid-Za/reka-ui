# Reka UI × Vue Vapor: context and task handoff

Last updated: 2026-11-19 (Asia/Tehran). Read this first. It is enough to pick the work up cold.

## 1. Goal

Make [Reka UI](https://github.com/unovue/reka-ui) work with Vue 3.6 **Vapor mode**. That means three ways to use it:

| Mode | What it means | Status |
|---|---|---|
| VDOM (today's Reka) | normal `createApp` | unchanged, all tests pass |
| Interop | Vapor app + `vaporInteropPlugin`, or VDOM app with Vapor children | works (116 pass + 2 expected fail) |
| **Pure Vapor** | `createVaporApp`, no interop plugin, Options API compiled out | 47/48 families; full suite 3365 / 184 |

The upstream deliverables are an issue and a PR. Both are drafted in `vapor-proposal/ISSUE.md` and
`vapor-proposal/PULL_REQUEST.md`. **Nothing has been pushed or opened on GitHub yet.** That is the
owner's call.

Ground rules the owner set:
- Document every decision in `DECISIONS.md` (ADR style).
- Defer big decisions to maintainers in `OPEN_QUESTIONS.md`. Each one gets a provisional default marked ⚑ and is not decided unilaterally.
- Be document-driven. Once tests are green, hill-climb performance, memory and bundle size, with each experiment logged in `PERF_LOG.md`.
- Branch tests that inherently differ by mode with an `isVapor` flag. Use `skipIf` only with a written reason (today, no test uses it).
- Server-rendering tests are not skipped; they run on Vapor SSR and hydration.

## 2. Where things are

| Path | What |
|---|---|
| `/media/saeid/projects/Contribs/reka-ui` | **the working repo**. Upstream clone plus the branches restored from the export bundle |
| `/media/saeid/projects/Contribs/reka-vapor-export` | the original export: bundle, patches, docs snapshot, raw bench data, helper scripts, `REFERENCES.md` |

Branches (base: upstream `a9873a0` on `v2`):

| Branch | Content |
|---|---|
| `feat/vapor-full-suite` | **newest, checked out.** Everything below plus the full-suite harness, Vapor SSR, `isVapor` branching and Reka fixes |
| `feat/vapor-support` | Vapor support plus perf rounds 1–2 (35 commits). Proposal docs live here too |
| `backup/full-suite-pre-rebase-2` | safety copy from before a rebase. It can be deleted |

Docs live in `vapor-proposal/` on each branch. The `feat/vapor-full-suite` copy is the most complete:

| File | Read it for |
|---|---|
| `ISSUE.md`, `PULL_REQUEST.md` | upstream-facing text |
| `CHANGES.md` | file-by-file list of what changed in Reka and why |
| `DECISIONS.md` | the 43 ADRs: strategy, perf (ADR-0xx) and suite (ADR-S0x) |
| `OPEN_QUESTIONS.md` | Q1–Q18 (packaging, peer range, SSR, perf levers…) and QS1–QS9 (test harness) |
| `FULL_SUITE.md` | how Reka's full suite runs under pure Vapor, plus the failure triage by cause |
| `BENCHMARKS.md`, `PERF_LOG.md` | benchmark method, results and every perf experiment (kept or reverted) |
| `COVERAGE.table.md` | per-family pure-Vapor coverage |

## 3. Machine setup (done 2026-11-19)

- Node 24.21 (fnm). pnpm 10.13.1 via corepack, with the shim installed in `~/.local/bin`.
- `pnpm install --frozen-lockfile` is done. Git hooks (`simple-git-hooks`) are installed.
- `git config --global --add safe.directory /media/saeid/projects/Contribs/reka-ui` was added because the
  drive is NTFS (`fuseblk`) and owned by root, so git otherwise refuses with "dubious ownership".
- `pnpm build` passes.

## 4. How to run

```sh
cd /media/saeid/projects/Contribs/reka-ui

pnpm build                                   # reka-ui + plugins
pnpm test:run                                # Reka's normal (VDOM) suite
pnpm --filter ./packages/vapor test          # 3 modes: test:vdom, test:interop, test:vapor-only
pnpm --filter ./packages/vapor test:full-suite   # Reka's full suite under pure Vapor (~3 min)
cd packages/vapor && node suite/report.mjs   # per-file table from the full-suite JSON report
node suite/triage.mjs <vitest-json> <out.json>   # buckets failures by root cause
```

Benchmark (Playwright with real Chrome, 4x CPU throttle): see `vapor-proposal/BENCHMARKS.md`, and the
bench lives in `packages/vapor/bench`. `reka-vapor-export/scripts/ab.sh` does an interleaved A/B
against any commit (`BASE=<sha>`). It was written for the old box layout, so fix its paths first.

## 5. Verified results on this machine (2026-11-19)

| Run | Result |
|---|---|
| `pnpm build` | ok |
| `pnpm test:run` (VDOM) | **3549 pass, 35 skip**, 130/130 files |
| vapor `test:vdom` | 51 pass |
| vapor `test:interop` | 116 pass, 2 expected fail |
| vapor `test:vapor-only` | 60 pass, 1 expected fail, 1 todo |
| vapor `test:full-suite` (pure Vapor) | **3365 pass, 184 fail, 35 skip**. The progression was 2938/610 → 3105/443 → 3316/232 → 3336/212 → 3365/184 |

## 6. Architecture in one paragraph

The same Reka source is compiled twice, once for VDOM and once for Vapor. Only the modules tied to
the virtual DOM get `.vapor.vue`/`.vapor.ts` twins, which a build plugin swaps in (`packages/vapor/rekaVapor.ts`):
- `Primitive`/`Slot`: `asChild` clones VNodes in VDOM, while the Vapor twin applies attrs to the child's element;
- `Presence`;
- the instance helpers: `useForwardExpose` etc., because `getCurrentInstance()` is null in Vapor.

The opt-in `reka-ui/vapor` entry registers the Vapor instance resolver and the Vapor `useForwardExpose`, so
the default VDOM bundle carries no Vapor code. It is in fact smaller than upstream. Alternatives
that were researched and rejected are scored in `DECISIONS.md`: Zag/Ark state machines, Melt/Bits prop
spreading, hand-written Vapor components, interop-only, and Vuetify0. Reference repos are listed in `REFERENCES.md`.

## 7. Performance (pure Vapor vs VDOM, end of round 2)

- Memory per instance vs VDOM: Checkbox 1.29x, Collapsible 1.37x and Tabs 1.39x. Before tuning these were 1.38/1.41/1.45x.
- Bundle (gzip): VDOM 61.3 KB, which is below upstream; pure Vapor 75.9 KB. The gap is Vue's runtime-vapor, not Reka.
- Unmount is still 1.1–2.0x slower than VDOM. Heap profiles show most of it is Vapor's own bookkeeping. The bigger levers change behaviour, so they are left in Q17.
- Known pre-existing issue: under interop, memory grows about 22 MiB per mount/unmount cycle (Q8).

## 8. What's failing now (184, pure-Vapor full suite) and the next tasks

By file: useRenderedContentId 76, Combobox 23, ScrollArea 11, Slider 8, Listbox 8, useForwardExpose 6, Tree 6,
NavigationMenu 5, Dialog 5, StepperAnnouncement 4, Presence 4, useForwardScopeId 3, Tooltip 3, Popover 3,
DismissableLayer 3, and one each in 16 other files.

Do these in this order. Root-cause labels match `FULL_SUITE.md`.

1. **U1/U2 in `useRenderedContentId` (76).** This is the biggest bucket and isn't diagnosed. The suspects are KeepAlive
   deactivation (the test bridge's KeepAlive vs Reka's `onDeactivated`) and as-child content with no element.
   Check first whether it is the harness or Reka.
2. **R1 virtualizers (~33: Combobox, Listbox, ScrollArea, Tree).** The known gap (ADR-017, Q9). Item refs read `$el`, which does not
   exist on Vapor instances. ListboxVirtualizer is also the 1 failing family scenario.
3. **Harness gaps (about 20).** `findComponent(cssSelector)` is not implemented (Slider, DismissableLayer), and
   `findComponent(Component)` returns empty (NavigationMenu, ScrollArea, PopperRootContext). Fix them in
   `packages/vapor/suite/test-utils.ts`.
4. **R5 remainder: `useForwardExpose` (6).** Forwarding a ref to a Vapor component that exposes nothing. See QS9; the
   provisional default leaves these red, so it needs a maintainer answer.
5. **R7 `unmountOnHide=false` (Dialog, Combobox).** Persistent content isn't hidden.
6. **R6 `useForwardScopeId` (3).**
7. **SSR (3).** Dialog.ssr (the `vi.mock` doesn't reach the server-compiled module), Popover.ssr (suspected double Vue after
   `vi.resetModules`), and Tabs as-child attrs missing from server markup (QS7).
8. **Singles (U9).** Investigate them one by one.
9. Once the suite is green: perf round 3 (Q17 levers only if maintainers agree), then refresh `PULL_REQUEST.md` /
   `CHANGES.md` with the final numbers.

Workflow per fix:
- Add a failing test, or use the existing red one.
- Fix it.
- Re-run the full suite and `pnpm test:run`. The VDOM suite must stay at 3549 / 35.
- Update the triage table in `FULL_SUITE.md` and add an ADR when a choice was made.
- Make one commit per root cause, with the new counts in the message.

## 9. Gotchas

- **Never use `git stash`.** It is shared across worktrees. Also, the repo's lint-staged pre-commit hook
  stashes internally. Switching it to `lint-staged --no-stash` is a pending owner decision.
- commitlint enforces conventional commits with a short title.
- Vue is pinned to `3.6.0-rc.15` in `packages/vapor` (Q2 covers the peer range).
- The NTFS drive is slower than ext4 for `node_modules`. If installs or tests feel slow, a checkout on the home partition is an option.
- `getCurrentInstance()` returns null inside Vapor components. Anything reading `instance.vnode`, `$el` or
  `instance.proxy` needs the Vapor resolver path (`setVaporInstanceResolver`).

## 10. Decisions waiting on the owner or maintainers

- Whether and when to open the upstream issue and PR. The texts are ready.
- The QS6 `isVapor` branching convention, QS7 SSR as-child markup, QS8 listener order and QS9 non-exposing refs.
- Q17 behaviour-changing perf levers, and Q18 recommending `__VUE_OPTIONS_API__: false`.
- Whether to keep E10b (shared Proxy handler, +58 B gzip for about 1% memory). It is commit `6dd7451`.
- The lint-staged `--no-stash` change.
