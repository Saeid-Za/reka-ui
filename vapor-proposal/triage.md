# Pure-Vapor full-suite triage (FIX_PLAN_8 / Vue rc.16)

Gate: **3542 pass / 10 fail / 35 skip** (`packages/vapor/suite/out/report.json`,
`--maxWorkers=4`). Vue pin: **3.6.0-rc.16**.
`pnpm test:run`: **3552 pass / 35 skip**.

Progress: rc.16; Checkbox U1; TagGroup U3; **QS14** `604dea598`; **QS15** `129abab66`;
**QS16** `456194c50`; **9.2** `f0ddd2351`; **9.4** `c83598fc2` (Popover SSR single Vue). Gate numbers
below may be stale until the next full suite.

## Flaky when green (QS17)

| File | Notes |
|---|---|
| `Dialog/Dialog.test.ts` — missing title/description `console.warn` ×2 | **flaky (QS17)** — green isolated and on current gate; red in full suite at G1. Do not treat green as fixed. |

## Fixed this round (not in remaining reds)

| Item | Commit |
|---|---|
| QS14 Combobox persistent hide | `604dea598` |
| QS15 FocusScope Combobox-in-Dialog | `129abab66` |
| QS16 Combobox searchTerm on close | `456194c50` |
| 9.2 AlertDialog cancel registration | `f0ddd2351` |
| 9.4 Popover SSR hydrate | `c83598fc2` |

## Owner leave-red / docs (needed for full green)

| Question | Tests | Path to green |
|---|---|---|
| QS7 | Tabs SSR ×1 | A+B: accept known + draft Vue repro (`upstream/vue-vapor-ssr-as-child.md`) |
| QS9 | `useForwardExpose` ×1 | **A+C locked:** manual `defineExpose({ $el })` + Vue draft; leave 1 red |
| QS12 | Slider out-in ×2 | Owner A: redesign Transition bridge |

## Remaining failure buckets (confirm on next full gate)

| File | Bucket |
|---|---|
| `Slider/Slider.test.ts` ×2 | **QS12** |
| `Tabs/Tabs.test.ts` | **QS7** |
| `shared/useForwardExpose.test.ts` | **QS9** |
| `Listbox/Listbox.test.ts` (reactive fallthrough) | **new** — investigate if still red after 9.4 harness |
