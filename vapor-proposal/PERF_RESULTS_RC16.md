# Perf A/B (same box, 2 passes each, reversed order)

> **Superseded by `PERF_RESULTS_LOCAL.md`** (owner's machine, quiet, 2026-11-20). This box run was loaded; its *now vs before* direction holds, but its *now vs rc.16-only* improvements for checkbox mount/update did not reproduce (noise locally).

before = a1e9d43d2 (pre FIX_PLAN_8), rc.16 only = 6e02e7b96, now = 605cbfc59. Box load avg ~2-3.6 during runs (logged in logs/bench/summary.txt). Verdict uses pass-to-pass spread as the noise threshold. Times are script ms medians.

| metric | before | rc.16 only | now | Δ now vs before | Δ now vs rc.16-only | pass-to-pass spread (max of the 3 points) | verdict |
|---|---|---|---|---|---|---|---|
| bundle gzip B (vdom) | 70,850 (70,850 / 70,850) | 71,011 (71,011 / 71,011) | 70,989 (70,989 / 70,989) | +0.2% | -0.0% | — | larger |
| bundle gzip B (interop) | 110,359 (110,359 / 110,359) | 113,534 (113,534 / 113,534) | 113,463 (113,463 / 113,463) | +2.8% | -0.1% | — | larger |
| bundle gzip B (vapor) | 85,684 (85,684 / 85,684) | 87,769 (87,769 / 87,769) | 87,897 (87,897 / 87,897) | +2.6% | +0.1% | — | larger |
| plain mount script ms (vapor) | 17 (18.1 / 15.8) | 21.2 (20.3 / 22.1) | 17.2 (15.6 / 18.8) | +1.5% | -18.9% | 18.6% | noise |
| checkbox mount script ms (vapor) | 499.6 (488.3 / 510.9) | 476.4 (491.6 / 461.1) | 411.8 (412.2 / 411.3) | -17.6% | -13.6% | 6.4% | improvement |
| collapsible mount script ms (vapor) | 553.5 (587.3 / 519.8) | 418.3 (458.2 / 378.3) | 402.6 (391.7 / 413.6) | -27.3% | -3.7% | 19.1% | improvement |
| tabs mount script ms (vapor) | 1,337.5 (1,429.5 / 1,245.6) | 1,011.1 (1,079.3 / 943) | 1,140 (1,054.4 / 1,225.5) | -14.8% | +12.7% | 15.0% | noise |
| listbox-virtual mount script ms (vapor) | 26.4 (28 / 24.9) | 22.8 (23.9 / 21.7) | 24.8 (23.3 / 26.3) | -6.2% | +8.8% | 12.1% | noise |
| listbox-virtual scroll script ms (vapor) | 431.1 (456.5 / 405.8) | 364.8 (362.7 / 366.9) | 408 (389.8 / 426.1) | -5.4% | +11.8% | 11.8% | noise |
| checkbox update:on script ms (vapor) | 551.5 (593.8 / 509.2) | 516.2 (554 / 478.4) | 459.1 (459.7 / 458.6) | -16.7% | -11.1% | 15.3% | improvement |
| checkbox unmount script ms (vapor) | 98.3 (113.1 / 83.4) | 112.3 (114.2 / 110.3) | 106.1 (106.7 / 105.5) | +8.0% | -5.5% | 30.2% | noise |
| checkbox bytes/instance (vapor) | 31,181.1 (31,181.3 / 31,181) | 31,556.2 (31,556.2 / 31,556.1) | 31,639.9 (31,638.7 / 31,641.1) | +1.5% | +0.3% | 0.0% | noise |
| checkbox residual after unmount B (vapor) | 531,708 (531,788 / 531,628) | 399,140 (399,112 / 399,168) | 415,594 (415,368 / 415,820) | -21.8% | +4.1% | 0.1% | improvement |
| listbox-virtual mount heap B (vapor) | 2,414,856 (2,414,832 / 2,414,880) | 2,416,308 (2,416,308 / 2,416,308) | 2,441,236 (2,441,236 / 2,441,236) | +1.1% | +1.0% | 0.0% | noise |
| plain mount script ms (vdom) | 20.3 (23.1 / 17.4) | 23 (24.8 / 21.1) | 17.5 (17.3 / 17.7) | -13.6% | -23.7% | 28.1% | noise |
| checkbox mount script ms (vdom) | 678.1 (746.8 / 609.4) | 730.2 (749.7 / 710.6) | 656.4 (670.5 / 642.3) | -3.2% | -10.1% | 20.3% | noise |
| collapsible mount script ms (vdom) | 279.1 (274.6 / 283.5) | 267 (271.8 / 262.2) | 268 (250.3 / 285.6) | -4.0% | +0.4% | 13.2% | noise |
| tabs mount script ms (vdom) | 904 (960.9 / 847.1) | 881.6 (848.9 / 914.3) | 891.6 (856 / 927.3) | -1.4% | +1.1% | 12.6% | noise |
| listbox-virtual mount script ms (vdom) | 20.1 (22 / 18.3) | 23.1 (23 / 23.3) | 20.3 (19.7 / 20.9) | +0.7% | -12.3% | 18.4% | noise |
| listbox-virtual scroll script ms (vdom) | 412.1 (450.7 / 373.5) | 441.5 (485.2 / 397.8) | 389.1 (389.7 / 388.5) | -5.6% | -11.9% | 19.8% | noise |
| checkbox update:on script ms (vdom) | 592.7 (624.1 / 561.3) | 629 (670.6 / 587.5) | 583.3 (590.3 / 576.2) | -1.6% | -7.3% | 13.2% | noise |
| checkbox unmount script ms (vdom) | 64.2 (72.8 / 55.5) | 79 (81.4 / 76.6) | 66.7 (72.4 / 60.9) | +3.9% | -15.6% | 27.0% | noise |
| checkbox bytes/instance (vdom) | 21,760.8 (21,760.4 / 21,761.3) | 21,764.3 (21,766.3 / 21,762.4) | 21,764.3 (21,764.2 / 21,764.4) | +0.0% | -0.0% | 0.0% | noise |
| checkbox residual after unmount B (vdom) | 553,240 (553,240 / 553,240) | 554,592 (554,780 / 554,404) | 553,742 (553,812 / 553,672) | +0.1% | -0.2% | 0.1% | noise |
| listbox-virtual mount heap B (vdom) | 2,017,286 (2,017,268 / 2,017,304) | 2,021,856 (2,021,832 / 2,021,880) | 2,021,254 (2,021,260 / 2,021,248) | +0.2% | -0.0% | 0.0% | noise |
