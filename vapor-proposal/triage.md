# Pure-Vapor full-suite triage (post FIX_PLAN_7, packaging freeze)

Gate: **3541 pass / 11 fail / 35 skip** (`packages/vapor/suite/out/report.json`,
`--maxWorkers=4`). Rows from `node suite/triage.mjs` (**11** failures).

## Flaky when green (QS17)

| File | Notes |
|---|---|
| `Dialog/Dialog.test.ts` — missing title/description `console.warn` ×2 | **flaky (QS17)** — green isolated and on current gate; red in full suite at G1 (`a8eb1dea` triage 9.1). Do not treat green as fixed. |

## Actionable now

| # | Test | Notes |
|---|---|---|
| 9.2 | `AlertDialog/AlertDialog.test.ts` — cancel registration | U9 Vapor only |
| 9.3 | `TagGroup/TagGroup.test.ts` — focus after last tag removed | U9 tabindex |
| 9.4 | `Popover/Popover.ssr.test.ts` — hydrate after content loads | S2 harness |

## Blocked (owner decisions)

| Question | Tests |
|---|---|
| QS14 | Combobox ×2 (hidden `display`, persistent Escape) |
| QS16 | Combobox searchTerm on close |
| QS12 | Slider out-in ×2 |
| QS7 | Tabs SSR hydration |
| QS15 | FocusScope + Combobox in Dialog |
| QS9 | `useForwardExpose` release forwarded component on unmount (1) |

## All failures (11)

| File | Bucket |
|---|---|
| `AlertDialog/AlertDialog.test.ts` | **9.2** |
| `Combobox/Combobox.test.ts` ×3 | **QS14** ×2, **QS16** |
| `FocusScope/FocusScope.test.ts` | **QS15** |
| `Popover/Popover.ssr.test.ts` | **9.4** |
| `Slider/Slider.test.ts` ×2 | **QS12** |
| `Tabs/Tabs.test.ts` | **QS7** |
| `TagGroup/TagGroup.test.ts` | **9.3** |
| `shared/useForwardExpose.test.ts` | **QS9** (1 remainder) |
