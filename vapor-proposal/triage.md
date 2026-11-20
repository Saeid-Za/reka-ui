# Pure-Vapor full-suite triage (FIX_PLAN_8 / Vue rc.16)

Gate (2026-11-20 re-run): **3547 pass / 5 fail / 35 skip**
(`packages/vapor/suite/out/report.json`, `--maxWorkers=4`). Vue **3.6.0-rc.16**.
`pnpm test:run`: **3552 pass / 35 skip**. Tip: `20553dee6`.

## Flaky when green (QS17)

| File | Notes |
|---|---|
| `Dialog/Dialog.test.ts` — missing title/description `console.warn` ×2 | **flaky (QS17)** — green on current gate; order-dependent at G1. |

## Fixed this round

| Item | Commit |
|---|---|
| Checkbox story (rc.16 false defaults) | `374fa886a` |
| TagGroup empty tabindex | `ee148a24c` |
| QS14 Combobox persistent hide | `604dea598` |
| QS15 FocusScope Combobox-in-Dialog | `129abab66` |
| QS16 Combobox searchTerm on close | `456194c50` |
| 9.2 AlertDialog cancel registration | `f0ddd2351` |
| 9.4 Popover SSR hydrate | `c83598fc2` |

## Remaining failures (5)

| File | Bucket | Stance |
|---|---|---|
| `Listbox/Listbox.test.ts` — reactive fallthrough attrs | **new** | Investigate / fix (attr update stuck) |
| `Slider/Slider.test.ts` ×2 — out-in transition | **QS12** | Owner A: Transition bridge |
| `Tabs/Tabs.test.ts` — SSR hydration | **QS7** | A+B: accept + Vue draft |
| `shared/useForwardExpose.test.ts` — release forwarded child | **QS9** | A+C locked: manual `defineExpose({ $el })`; leave red |

## Owner leave-red / docs

| Question | Path |
|---|---|
| QS7 | Known pure-Vapor SSR first paint; `upstream/vue-vapor-ssr-as-child.md` |
| QS9 | Manual expose migration; `upstream/vue-expose-proxy-el.md` |
| QS12 | Redesign `VaporTransition` bridge |
