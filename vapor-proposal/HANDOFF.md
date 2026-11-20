# Reka UI × Vue Vapor: context and task handoff

Last updated: 2026-11-20 (Asia/Tehran). Read this first. It is enough to pick the work up cold.
**Packaging freeze** after FIX_PLAN_7 — see §11. **Latest:** §12 (post-audit gate 3550 / 2 / 35; `MAINTAINABILITY_AUDIT.md`).

## 1. Goal

Make [Reka UI](https://github.com/unovue/reka-ui) work with Vue 3.6 **Vapor mode**. That means three ways to use it:

| Mode | What it means | Status |
|---|---|---|
| VDOM (today's Reka) | normal `createApp` | unchanged, all tests pass |
| Interop | Vapor app + `vaporInteropPlugin`, or VDOM app with Vapor children | works (116 pass + 2 expected fail) |
| **Pure Vapor** | `createVaporApp`, no interop plugin, Options API compiled out | 47/48 families; full suite **3550 / 2 / 35** (2026-11-20 audit; reds QS7, QS9) |

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

## 5. Verified results on this machine (packaging freeze, 2026-11-20)

| Run | Result |
|---|---|
| `pnpm build` | ok |
| `pnpm test:run` (VDOM) | **3552 pass, 35 skip**, 130/130 files |
| vapor `test:vdom` | 51 pass |
| vapor `test:interop` | 116 pass, 2 expected fail |
| vapor `test:vapor-only` | 61 pass, 1 todo (post H5 options-api config) |
| vapor `test:full-suite` (pure Vapor) | **3541 pass, 11 fail, 35 skip** (`--maxWorkers=4`). Historical progression in `FULL_SUITE.md`. |

Current failure buckets: **`vapor-proposal/triage.md`** (11 rows).

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

## 8. What's failing now (11, pure-Vapor full suite)

**Superseded for day-to-day work by `triage.md` and §11.** Eleven failures remain after
FIX_PLAN_7; most are blocked on owner decisions (QS7, QS9, QS12, QS14–QS16). Actionable
without decisions: AlertDialog cancel registration (9.2), TagGroup focus (9.3), Popover SSR
hydration (9.4). Dialog `console.warn` tests are **flaky** (QS17) — green on the current gate
but not trusted.

Do **not** resume broad fix plans or Phase F hill-climb unless the owner reopens work. When
fixing again: one commit per item, gate numbers in the body, VDOM gate **3552 / 35 skip**.

## 9. Gotchas

- **Never use `git stash`.** It is shared across worktrees. Also, the repo's lint-staged pre-commit hook
  stashes internally. Switching it to `lint-staged --no-stash` is a pending owner decision.
- commitlint enforces conventional commits with a short title.
- Vue is pinned to `3.6.0-rc.16` in `packages/vapor` (FIX_PLAN_8 U0; see RELATED_ISSUES).
- The NTFS drive is slower than ext4 for `node_modules`. If installs or tests feel slow, a checkout on the home partition is an option.
- `getCurrentInstance()` returns null inside Vapor components. Anything reading `instance.vnode`, `$el` or
  `instance.proxy` needs the Vapor resolver path (`setVaporInstanceResolver`).

## 10. Decisions waiting on the owner or maintainers

- Whether and when to open the upstream issue and PR. The texts are ready.
- The QS6 `isVapor` branching convention, QS7 SSR as-child markup, QS8 listener order and QS9 non-exposing refs.
- Q17 behaviour-changing perf levers, and Q18 recommending `__VUE_OPTIONS_API__: false`.
- Whether to keep E10b (shared Proxy handler, +58 B gzip for about 1% memory). It is commit `6dd7451`.
- The lint-staged `--no-stash` change.

## 11. Packaging freeze (post FIX_PLAN_7 H7)

FIX_PLAN_7 H0–H7 complete; **FIX_PLAN_8** adopted Vue **rc.16** and cleared Checkbox + TagGroup.
Current tip includes U3 (`ee148a24c`). Gate: **3542 / 10 / 35** pure Vapor, **3552 / 35** `pnpm test:run`.

- **No further perf hill-climb** until the owner says otherwise.
- **Docs to open upstream when ready:** `vapor-proposal/upstream/` (not posted). See
  `RELATED_ISSUES.md` (#16269 fixed in rc.16; QS7 still red; #16305 open).
- **Owner decisions for full green:** see end of `triage.md` / latest chat report (QS7, QS9,
  QS12, QS14–QS16, 9.2, 9.4, QS15).

## 12. Post-audit state (2026-11-20, Asia/Tehran)

- Vue **3.6.0-rc.16**. Gate: pure Vapor **3550 / 2 / 35**, `pnpm test:run` **3552 / 35**.
- Reds: **QS7** Tabs SSR (accept + upstream; path B attempted and reverted, see
  OPEN_QUESTIONS QS7 and `experiments/qs7-path-b-ssr-merge.patch`), **QS9** useForwardExpose
  (manual `defineExpose({ $el })`, leave red).
- Audit commits: `ae9c10ec1` ListboxItem twin getter fix (had re-reded ColorSwatchPicker +
  Combobox ×2), `e6f798f89` AlertDialog product change + twin reverted (harness bug only),
  `b879aea7a` ComboboxContent twin deleted (redundant after QS14).
- Remaining maintainability work: `MAINTAINABILITY_AUDIT.md` (TagGroup branch → applier,
  FocusScope full-copy twin → small swapped module, ListboxItem twin → bridge fix,
  useTriggerId branch → swapped hook, QS16 DOM→model sync is test-driven).
- Run the gate with `pnpm exec vitest run -c vitest.suite.config.ts --maxWorkers=4` directly;
  `pnpm test:full-suite -- --maxWorkers=4` passes a literal `--` through.


## 13. PR-ready state (2026-11-20, Asia/Tehran)

Final gate (2026-11-20, Asia/Tehran, archive `605cbfc59`, Vue 3.6.0-rc.16):
pure-Vapor full suite **3559 passed / 1 expected fail / 35 skipped (3595)**, exit 0;
`pnpm test:run` **3560 passed / 35 skipped (3595)**, exit 0. vue-tsc, build, eslint and the
twin drift check pass. The one expected failure is QS7 (Tabs SSR, `it.fails` in Vapor only).
PR branches: see `upstream/` and `/media/saeid/projects/Contribs/PR_READY.md`.

Archive branch `feat/vapor-full-suite` was only appended to (no amend/rebase/reset). Commits
this round:

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

PR branches (local only, cut from the merge-base `a9873a029` with `origin/v2`):
`vapor-pr/1-vdom-safe` (6), `vapor-pr/2-vapor-entry` (+8), `vapor-pr/3-vapor-test-suite`
(+3). `git diff 605cbfc59 vapor-pr/3-vapor-test-suite` touches only `vapor-proposal/`.
Worktrees: `../reka-wt/stack` (PR branches), `../reka-wt/base` (merge-base).
