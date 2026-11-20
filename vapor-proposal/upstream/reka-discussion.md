# Draft: Reka maintainers — Vapor compatibility track

**Do not post upstream.** Snapshot for eventual discussion issue.

- Branch: `feat/vapor-full-suite`; harness in `packages/vapor/`.
- Approach: Vapor SFC twins + render-function test bridge (`vaporH.ts`); VDOM sources unchanged unless VDOM-tested.
- Latest gate (local, packaging freeze post FIX_PLAN_7): **3541 pass / 11 fail / 35 skip** pure Vapor full suite; **3552 pass / 35 skip** `pnpm test:run`. Phase F ended **0** kept / **1** reverted (H7-E1).
- Known differences: see `vapor-proposal/OPEN_QUESTIONS.md` (QS7, QS8, QS9, QS12, QS14–QS17).
- Docs in `vapor-proposal/` (`DECISIONS.md`, `FULL_SUITE.md`, `USER_GUIDE_DRAFT.md`).
