# Pure-Vapor full-suite triage (FIX_PLAN_8 / Vue rc.16)

Gate: **3542 pass / 10 fail / 35 skip** (`packages/vapor/suite/out/report.json`,
`--maxWorkers=4`). Vue pin: **3.6.0-rc.16**.
`pnpm test:run`: **3552 pass / 35 skip**.

Progress since packaging freeze (3541/11 on rc.15): adopted rc.16; fixed Checkbox
story prop bind (U1); fixed TagGroup empty `tabindex` (U3).

## Flaky when green (QS17)

| File | Notes |
|---|---|
| `Dialog/Dialog.test.ts` — missing title/description `console.warn` ×2 | **flaky (QS17)** — green isolated and on current gate; red in full suite at G1. Do not treat green as fixed. |

## Actionable (failed one-shot; needs design or decision)

| # | Test | Notes |
|---|---|---|
| 9.2 | `AlertDialog/AlertDialog.test.ts` — cancel registration | U2: Vapor recreates cancel node; harness/twin attempt **reverted** |
| 9.4 | `Popover/Popover.ssr.test.ts` — hydrate after content loads | U4: `resetModules` + vue instance; attempt **reverted** |
| QS14 | Combobox ×2 persistent hide | U5: twin post-flush hide **reverted** (ContentImpl `display:flex` wins) |
| QS15 | FocusScope Combobox-in-Dialog | U6: extra `nextTick` register **reverted** |
| QS16 | Combobox searchTerm on close | U7: not harness-only; no VDOM-safe fix |

## Owner leave-red (prior decisions; needed for full green)

| Question | Tests | Path to green |
|---|---|---|
| QS7 | Tabs SSR ×1 | Accept known issue **or** pure-Vapor SSR repro / Reka SSR path |
| QS9 | `useForwardExpose` ×1 | Document + `isVapor` expose `$el` **or** Vue `$el` on expose proxy |
| QS12 | Slider out-in ×2 | Redesign `VaporTransition` bridge **or** accept leave-red |

## All failures (10)

| File | Bucket |
|---|---|
| `AlertDialog/AlertDialog.test.ts` | **9.2** |
| `Combobox/Combobox.test.ts` ×3 | **QS14** ×2, **QS16** |
| `FocusScope/FocusScope.test.ts` | **QS15** |
| `Popover/Popover.ssr.test.ts` | **9.4** |
| `Slider/Slider.test.ts` ×2 | **QS12** |
| `Tabs/Tabs.test.ts` | **QS7** |
| `shared/useForwardExpose.test.ts` | **QS9** (1 remainder) |
