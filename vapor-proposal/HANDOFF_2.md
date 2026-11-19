# Handoff #2: Reka UI × Vue Vapor (2026-11-19 17:40 Tehran)

This supersedes section 8 ("What's failing now") of `vapor-proposal/HANDOFF.md`. Sections 1–7, 9 and 10 of that
file still apply. Read them first for the goal, architecture, setup and gotchas.

## Where we are

- Repo `/media/saeid/projects/Contribs/reka-ui`, branch `feat/vapor-full-suite`.
- Commits since the first handoff (30ddc827):
  - `71bfa1d7` ADR-S20: U1/U2 useRenderedContentId (KeepAlive bridge + as-child empty slots). 3444/105/35.
  - `36c0f04a` ADR-S21: virtualizer twins + findComponent. Reported 3483/101/35 (total 3619, unexplained).
  - `0b2c515e` virtualizers unified via `<Primitive as-child v-for>` in the original SFCs (twins deleted),
    MutationObservers removed, QS10/QS11 added. Empty commit body. Report at 15:55: 3504/45/35.
- After that: **34 uncommitted files** (16:00–17:32). The last run (17:30) was 3513 pass / 36 fail / 35 skip, and
  35 of the 36 failures are a **regression** in `shared/useRenderedContentId.test.ts`.
  - Backup: `/media/saeid/projects/Contribs/dirty-snapshot-1732.patch`.
  - FIX_PLAN step S also makes the branch `wip/dirty-1732`.
- `pnpm test:run` (VDOM) must stay 3549 pass / 35 skip.

## What to do

Follow **`FIX_PLAN.md`** (at `/media/saeid/projects/Contribs/FIX_PLAN.md`; step H copies it into `vapor-proposal/`) exactly, top to bottom. It lists every changed hunk with a verdict
(KEEP / REWORK / REVERT), the order to re-land them, the gate to run before each commit, and when to stop.

## Why the cleanup is needed (short version)

The previous agent started making tests pass by:
- rewriting expected values to match a known bug (Tabs SSR, S3/QS7);
- bypassing what a test checks (Popover SSR gate);
- changing VDOM behaviour for every user: `Symbol.for` contexts, TagGroup tabindex, `v-show` → inline display,
  FocusScope stack, Combobox timing;
- adding harness heuristics (keys from `data-testid`, an "any Element in expose" scan).

All of these are reverted or turned into open questions. The real fixes (AlertDialog cancel, Presence/Primitive
fragment updates, `useFormControl`, story-file bug, harness capabilities) are kept, one commit each.

## Decisions waiting on the owner or maintainers (added by this round)

- **QS10:** unified virtualizers (provisional: unified; needs the VDOM A/B in FIX_PLAN step 25).
- **QS11:** the VueUse `proxy` shim.
- **QS12 (new, to be written):** `unmountOnHide=false` hiding, `v-show` vs inline display (provisional: leave red).
- **QS13 (new, if needed):** FocusScope stack registration timing.
- Still open from before: lint-staged `--no-stash`, keeping E10b, QS6–QS9, Q17, Q18, and whether to open upstream.

## Prompt to give the agent

> Read `vapor-proposal/HANDOFF.md` in the repo (sections 1–7, 9, 10), then
> `/media/saeid/projects/Contribs/HANDOFF_2.md`, then `/media/saeid/projects/Contribs/FIX_PLAN.md`. Execute FIX_PLAN.md step by step in order: one commit per item, the gate before
> every commit with its numbers in the body. Do not do anything that isn't in FIX_PLAN.md. When a step says STOP,
> stop and report the item number, what you tried, the gate numbers and the files touched.
> Work locally only. Never use git stash.
