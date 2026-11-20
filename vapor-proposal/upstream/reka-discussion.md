# Draft: Reka maintainers — Vapor compatibility track

**Do not post upstream.** Snapshot for eventual discussion issue.

- Branch: `feat/vapor-full-suite`; harness in `packages/vapor/`.
- Approach: Vapor SFC twins + render-function test bridge (`vaporH.ts`); VDOM sources unchanged unless VDOM-tested.
- Latest gate (local, packaging freeze post FIX_PLAN_7): **3541 pass / 11 fail / 35 skip** pure Vapor full suite; **3552 pass / 35 skip** `pnpm test:run`. Phase F ended **0** kept / **1** reverted (H7-E1).
- Vue pin: `packages/vapor` **3.6.0-rc.15** (freeze). Prefer ≥ rc.16 for interop SSR (#16269/#16340) once Checkbox regressions on rc.16 are understood.
- Known differences: see `vapor-proposal/OPEN_QUESTIONS.md` (QS7, QS8, QS9, QS12, QS14–QS17).
- Upstream map: `vapor-proposal/upstream/RELATED_ISSUES.md` (QS7 still red after #16340; #16305 open for `getCurrentInstance`).
- Docs in `vapor-proposal/` (`DECISIONS.md`, `FULL_SUITE.md`, `USER_GUIDE_DRAFT.md`).
