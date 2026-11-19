# Pure-Vapor full-suite triage (after FIX_PLAN_2 step 11x)

Gate: **3523 pass / 26 fail / 35 skip** (`suite/out/report.json`, 2026-11-19, `--maxWorkers=4`).
Each row maps to the expected FIX_PLAN item (or **unknown**).

| File | Test | Expected fix |
|---|---|---|
| `AlertDialog/AlertDialog.test.ts` | should keep the registered cancel element when another cancel button unmounts | **§9** AlertDialog cancel (Vapor only; K1 reverted ADR-S34) |
| `Combobox/Combobox.test.ts` | unmountOnHide=false keeps the same hidden content node… | **QS14 (step 20)** (R10 `v-show`; do not implement) |
| `Combobox/Combobox.test.ts` | two persistent Comboboxes… Escape when a hidden one mounted after it | **QS14 (step 20)** |
| `Combobox/Combobox.test.ts` | opening the popup should not reset searchTerm when close | **W9** (ComboboxRoot timeout) |
| `DateField/DateField.test.ts` | preserve other segment when one segment's value is deleted | **W5** (`isVapor` textContent vs innerHTML) |
| `Dialog/Dialog.ssr.test.ts` | SSR open modal… restore body pointer-events after hydrated dialog closes | **H4** / **§9 S1** (ssrTwins / module mock) |
| `Dialog/Dialog.test.ts` | unmountOnHide=false keeps content in DOM (modal) | **QS14 (step 20)** |
| `Dialog/Dialog.test.ts` | unmountOnHide=false keeps content in DOM (non-modal) | **QS14 (step 20)** |
| `Dialog/Dialog.test.ts` | two Dialogs unmountOnHide=false… Escape | **QS14 (step 20)** |
| `Dialog/Dialog.test.ts` | no description… should warn to the console | **unknown** |
| `Dialog/Dialog.test.ts` | no title… should warn to the console | **unknown** |
| `FocusScope/FocusScope.test.ts` | Combobox input inside Dialog (#2749) keeps focus | **W6** / **QS15 (step 21)** (FocusScope stack) |
| `Popover/Popover.ssr.test.ts` | open in SSR… hydrate once content loads | **H4** / **§9 S2** |
| `Slider/Slider.test.ts` | out-in transition… pointer input while page leaves (horizontal) | **QS12** (harness VaporTransition; reverted H1c) |
| `Slider/Slider.test.ts` | out-in transition… pointer input (vertical) | **QS12** |
| `Tabs/Tabs.test.ts` | ssr hydration keeps the default output when ids do not diverge | **step 22** (QS7; test stays red on purpose, R3) |
| `TagGroup/TagGroup.test.ts` | removal focuses the group once the last tag is removed | **§9 U9** |
| `Toast/Toast.test.ts` | viewport element replaced… pause/resume on current viewport | **W13** |
| `VisuallyHidden/HiddenNativeLabels.test.ts` | labelled forms… every twin… axe | **unknown** |
| `shared/useForwardExpose.test.ts` | safely read cached child exposures… $el-only ref | **QS9** / **W14** area |
| `shared/useForwardExpose.test.ts` | release forwarded component when child unmounts | **QS9** |
| `shared/useForwardExpose.test.ts` | forward component instance for component | **QS9** |
| `shared/useForwardExpose.test.ts` | merge child exposed properties with parent props | **QS9** |
| `shared/useForwardExpose.test.ts` | forward multiple exposed properties | **QS9** |
| `shared/useForwardScopeId.test.ts` | multi-root component root | **W14** |
| `shared/useForwardScopeId.test.ts` | RadioGroupItem onto control | **W14** |
| `shared/useForwardScopeId.test.ts` | ToggleGroupItem onto control | **W14** |
