# Pure-Vapor full-suite triage (after G1)

Gate: **3535 pass / 17 fail / 35 skip** (`packages/vapor/suite/out/report.json`,
`--maxWorkers=4`). Rows below come from `node suite/triage.mjs suite/out/report.json
suite/out/triage.json` (**17** failures).

## Actionable now (section 9, in order)

| # | Test | Notes |
|---|---|---|
| 9.1 | `Dialog/Dialog.test.ts` — no description / no title should warn to the console (2 tests) | Warn fires twice in Vapor (`toHaveBeenCalledTimes(1)` → 2) |
| 9.2 | `AlertDialog/AlertDialog.test.ts` — keep the registered cancel element when another cancel button unmounts | Vapor only (K1 reverted, ADR-S34) |
| 9.3 | `TagGroup/TagGroup.test.ts` — focuses the group once the last tag is removed | U9 tabindex (`-1` vs `0`) |
| 9.4 | `Popover/Popover.ssr.test.ts` — keep the server content in place and hydrate once the content loads | S2 harness (`vi.resetModules` / SSR stack) |

## Blocked on owner decisions (remaining reds)

| Question | Tests |
|---|---|
| QS14 `v-show` / `unmountOnHide` | Combobox ×2 (hidden node `display`, persistent Escape) |
| QS12 Transition slot | Slider out-in ×2 |
| QS16 Combobox `setTimeout` | Combobox opening should not reset `searchTerm` when close |
| QS7 Tabs SSR (red on purpose) | Tabs keeps the default output when ids do not diverge |
| QS9 forward expose | `useForwardExpose` ×5 |
| QS15 FocusScope stack | FocusScope Combobox input keep focus inside a Dialog |

## All failures (17)

| File | Test | Bucket / fix |
|---|---|---|
| `Dialog/Dialog.test.ts` | given a default Dialog … when no description has been provided should warn to the console | **9.1** |
| `Dialog/Dialog.test.ts` | given a default Dialog … when no title has been provided should warn to the console | **9.1** |
| `AlertDialog/AlertDialog.test.ts` | … keep the registered cancel element when another cancel button unmounts | **9.2** |
| `TagGroup/TagGroup.test.ts` | tagGroup removal focuses the group once the last tag is removed | **9.3** |
| `Popover/Popover.ssr.test.ts` | … keep the server content in place and hydrate it once the content loads | **9.4** (S2) |
| `Combobox/Combobox.test.ts` | unmountOnHide=false keeps the same hidden content node … | **QS14** |
| `Combobox/Combobox.test.ts` | two persistent Comboboxes … Escape when a hidden one mounted after it | **QS14** |
| `Combobox/Combobox.test.ts` | opening the popup should not reset searchTerm when close | **QS16** |
| `Slider/Slider.test.ts` | out-in transition … pointer input while the page leaves (horizontal) | **QS12** |
| `Slider/Slider.test.ts` | out-in transition … pointer input while the page leaves (vertical) | **QS12** |
| `Tabs/Tabs.test.ts` | ssr hydration keeps the default output when ids do not diverge | **QS7** |
| `FocusScope/FocusScope.test.ts` | Combobox input inside Dialog (#2749) keeps focus | **QS15** |
| `shared/useForwardExpose.test.ts` | safely read cached child exposures … $el-only ref | **QS9** |
| `shared/useForwardExpose.test.ts` | release forwarded component when child unmounts | **QS9** |
| `shared/useForwardExpose.test.ts` | forward component instance for component | **QS9** |
| `shared/useForwardExpose.test.ts` | merge child exposed properties with parent props | **QS9** |
| `shared/useForwardExpose.test.ts` | forward multiple exposed properties | **QS9** |
