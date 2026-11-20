# Reka UI × Vue Vapor: context and task handoff

Last updated: 2026-11-20 (Asia/Tehran). Read this first. It is enough to pick the work up cold.
**Packaging freeze** after FIX_PLAN_7 — see §11 before resuming fixes or perf hill-climb.

## 1. Goal

Make [Reka UI](https://github.com/unovue/reka-ui) work with Vue 3.6 **Vapor mode**. That means three ways to use it:

| Mode | What it means | Status |
|---|---|---|
| VDOM (today's Reka) | normal `createApp` | unchanged, all tests pass |
| Interop | Vapor app + `vaporInteropPlugin`, or VDOM app with Vapor children | works (116 pass + 2 expected fail) |
| **Pure Vapor** | `createVaporApp`, no interop plugin, Options API compiled out | 47/48 families; full suite **3541 / 11 / 35** (freeze) |

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
- Vue is pinned to `3.6.0-rc.15` in `packages/vapor` (Q2; rc.16 tried 2026-11-20 — see RELATED_ISSUES).
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

FIX_PLAN_7 steps **H0–H7** are complete on `feat/vapor-full-suite` (tip includes H7 docs:
`96230bb55`). Phase F ran one experiment (**H7-E1**, lazy as-child applier): **reverted**; gate
unchanged at **3541 / 11 / 35** pure Vapor, **3552 / 35 skip** `pnpm test:run`.

- **No FIX_PLAN_8** and no further perf hill-climb on this branch until the owner says otherwise.
- **Docs to open upstream when ready:** `vapor-proposal/upstream/` (not posted). See
  `RELATED_ISSUES.md` for the Vue/Reka map (#16269 fixed in rc.16; QS7 still red; #16305 open).
- **Owner decision next:** QS14 Combobox persistent content visibility (`USER_GUIDE_DRAFT.md`,
  ADR-S53); then triage the remaining QS-blocked reds.
- Proposal packaging: refresh `ISSUE.md`, `PULL_REQUEST.md`, `reka-discussion.md` at freeze
  (this section). rc.16 recheck recorded 2026-11-20 (pin stayed rc.15).
