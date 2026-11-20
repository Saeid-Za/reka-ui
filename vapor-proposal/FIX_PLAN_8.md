# FIX_PLAN_8: Vue rc.16 + clear remaining full-suite reds

Base: `feat/vapor-full-suite` @ packaging freeze + RELATED_ISSUES docs.
Rules: same as FIX_PLAN_7 (one root cause per commit, gate numbers in body, no stash,
no weaken tests, no push). Owner QS decisions stay until this plan asks for new ones.

## Goal

1. Adopt Vue **3.6.0-rc.16** in `packages/vapor`.
2. Fix every red that is allowed without a new owner decision.
3. Re-gate + update `triage.md` / RELATED_ISSUES / freeze notes.
4. Report remaining reds + decisions needed for **full green**, with recommendations.

## Order

| Step | Item | Success |
|---|---|---|
| U0 | Bump Vue rc.15→rc.16, install, gate | Numbers recorded (expect ~3538/14/35) |
| U1 | Checkbox indicator ×2 + form submit (rc.16) | Green or STOP with diagnosis |
| U2 | 9.2 AlertDialog cancel | Green or leave + note |
| U3 | 9.3 TagGroup tabindex | Green or leave + note |
| U4 | 9.4 Popover SSR harness | Green or leave + note |
| U5 | QS14 Combobox display (one Vapor-only attempt) | Green or revert + known issue |
| U6 | QS15 FocusScope (Vapor-only allowed) | Green or leave |
| U7 | QS16 Combobox searchTerm (harness-only; no VDOM break) | Green or leave |
| U8 | Docs + final report | triage + decisions table |

**Leave for owner (do not weaken tests):** QS7 (SSR known), QS9 (expose `$el`), QS12 (Transition bridge) unless a safe fix appears while working.

## Gate

```sh
pnpm test:run   # keep 3552/35
pnpm --filter ./packages/vapor test:full-suite -- --maxWorkers=4
```
