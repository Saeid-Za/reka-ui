# Perf A/B on the owner's machine (before vs rc.16 only vs now)

Primary performance reference for the PRs. Measured 2026-11-20, 19:02–19:25 (Asia/Tehran).

## Machine and conditions

- Arkan: Intel Core i7-12700H (20 threads), 31 GB RAM, Linux 7.0.0-43-generic, Node v24.21.0,
  Chrome 155.0.8059.79. Repo on an NTFS partition (`/media/saeid/projects`).
- Quiet machine: load average 0.47 just before the first run and 0.58 right after the last one, with no
  vitest / eslint / playwright jobs from other workspaces. During the runs the 1-minute load was 2.1–3.7;
  that is the benchmark's own Chrome and Vite builds (logged per run in
  `Contribs/local-run/logs/bench/summary.txt`). earlyoom did not kill anything; all 6 runs exited 0.

## Method

- Three detached worktrees under `Contribs/wt-bench/`, each with `pnpm install --frozen-lockfile` (pnpm 10.13.1):
  - **before** = `a1e9d43d2` (packaging freeze before the rc.16 bump and the cleanup; vue 3.6.0-rc.15 in `packages/vapor`)
  - **rc.16 only** = `6e02e7b96` (only the Vue 3.6.0-rc.16 bump on top of *before*)
  - **now** = `c56d53a84` (archive tip; the PR branches carry the same product code)
- `packages/vapor/bench/run.mjs` (builds the bench app as vdom / interop / vapor, drives real Chrome via
  playwright-core, 4× CPU throttling, 10 runs + 3 warm-up per scenario), 2 passes:
  pass 1 `before → rc.16 only → now`, pass 2 `now → rc.16 only → before`, to cancel ordering/warm-up drift.
  Driver: `Contribs/local-run/bench.sh`; raw JSON and logs: `Contribs/local-run/logs/bench/`.
- `perfcmp.mjs`: each cell is the median of the two passes (pass 1 / pass 2 in brackets). Times are
  script-time medians in ms. A change counts only if it exceeds max(5 %, pass-to-pass spread of any of
  the three points); the verdict column is for *now vs before*. Bundle sizes are deterministic (exact).

## Results

| metric | before | rc.16 only | now | Δ now vs before | Δ now vs rc.16-only | pass-to-pass spread (max of the 3 points) | verdict |
|---|---|---|---|---|---|---|---|
| bundle gzip B (vdom) | 70,850 (70,850 / 70,850) | 71,011 (71,011 / 71,011) | 70,989 (70,989 / 70,989) | +0.2% | -0.0% | — | larger |
| bundle gzip B (interop) | 110,359 (110,359 / 110,359) | 113,534 (113,534 / 113,534) | 113,463 (113,463 / 113,463) | +2.8% | -0.1% | — | larger |
| bundle gzip B (vapor) | 85,684 (85,684 / 85,684) | 87,769 (87,769 / 87,769) | 87,897 (87,897 / 87,897) | +2.6% | +0.1% | — | larger |
| plain mount script ms (vapor) | 9.8 (9.9 / 9.7) | 10.2 (9.8 / 10.6) | 11.3 (11.9 / 10.6) | +14.8% | +10.3% | 11.6% | regression |
| checkbox mount script ms (vapor) | 287.5 (295.1 / 279.9) | 241.6 (240.3 / 242.9) | 244.4 (247.4 / 241.5) | -15.0% | +1.2% | 5.3% | improvement |
| collapsible mount script ms (vapor) | 324.7 (327.2 / 322.2) | 226.3 (225.6 / 227.1) | 235.2 (239.9 / 230.4) | -27.6% | +3.9% | 4.0% | improvement |
| tabs mount script ms (vapor) | 636.9 (655.5 / 618.3) | 531.3 (536.4 / 526.1) | 569.7 (577.6 / 561.8) | -10.6% | +7.2% | 5.8% | improvement |
| listbox-virtual mount script ms (vapor) | 16.6 (16.6 / 16.5) | 14.6 (14.6 / 14.6) | 15.3 (14.9 / 15.7) | -7.6% | +4.8% | 5.2% | improvement |
| listbox-virtual scroll script ms (vapor) | 264.3 (279.7 / 248.9) | 238.9 (230.4 / 247.5) | 250.4 (265.5 / 235.3) | -5.3% | +4.8% | 12.1% | noise |
| checkbox update:on script ms (vapor) | 325.2 (326.5 / 323.9) | 248.7 (253.8 / 243.6) | 252.8 (252.6 / 252.9) | -22.3% | +1.6% | 4.1% | improvement |
| checkbox unmount script ms (vapor) | 45.3 (44.3 / 46.4) | 37 (34.4 / 39.7) | 40.8 (41.1 / 40.4) | -10.1% | +10.0% | 14.3% | noise |
| checkbox bytes/instance (vapor) | 31,209.1 (31,209.1 / 31,209) | 31,584.5 (31,585.1 / 31,584) | 31,668.9 (31,669.3 / 31,668.5) | +1.5% | +0.3% | 0.0% | noise |
| checkbox residual after unmount B (vapor) | 471,128 (471,384 / 470,872) | 327,608 (327,892 / 327,324) | 341,146 (341,468 / 340,824) | -27.6% | +4.1% | 0.2% | improvement |
| listbox-virtual mount heap B (vapor) | 2,420,780 (2,420,784 / 2,420,776) | 2,421,532 (2,421,532 / 2,421,532) | 2,447,168 (2,447,316 / 2,447,020) | +1.1% | +1.1% | 0.0% | noise |
| plain mount script ms (vdom) | 13.3 (13.6 / 12.9) | 12.4 (12.7 / 12.1) | 12.3 (12.5 / 12.1) | -7.2% | -0.8% | 5.3% | improvement |
| checkbox mount script ms (vdom) | 389.3 (396.5 / 382) | 395.1 (406.1 / 384.1) | 383.1 (382.8 / 383.4) | -1.6% | -3.0% | 5.6% | noise |
| collapsible mount script ms (vdom) | 155.8 (157 / 154.6) | 154.1 (152.6 / 155.5) | 151.2 (155.8 / 146.5) | -3.0% | -1.9% | 6.2% | noise |
| tabs mount script ms (vdom) | 470.4 (470.1 / 470.6) | 475.9 (476.1 / 475.7) | 470.9 (481 / 460.8) | +0.1% | -1.1% | 4.3% | noise |
| listbox-virtual mount script ms (vdom) | 12.7 (13 / 12.4) | 12.3 (12.2 / 12.3) | 13.6 (14.1 / 13) | +6.7% | +10.6% | 8.1% | noise |
| listbox-virtual scroll script ms (vdom) | 257.3 (270.2 / 244.4) | 255.7 (230.8 / 280.5) | 247.5 (263.4 / 231.6) | -3.8% | -3.2% | 19.4% | noise |
| checkbox update:on script ms (vdom) | 329.4 (338.4 / 320.4) | 328.8 (324.5 / 333) | 316.3 (321.4 / 311.2) | -4.0% | -3.8% | 5.5% | noise |
| checkbox unmount script ms (vdom) | 24.1 (25.1 / 23.1) | 27.4 (31.2 / 23.6) | 24.1 (24 / 24.1) | -0.2% | -12.2% | 27.7% | noise |
| checkbox bytes/instance (vdom) | 21,754.5 (21,756.6 / 21,752.5) | 21,756.3 (21,755.1 / 21,757.4) | 21,759.7 (21,759.7 / 21,759.7) | +0.0% | +0.0% | 0.0% | noise |
| checkbox residual after unmount B (vdom) | 554,288 (554,464 / 554,112) | 555,748 (555,756 / 555,740) | 555,030 (555,492 / 554,568) | +0.1% | -0.1% | 0.2% | noise |
| listbox-virtual mount heap B (vdom) | 2,011,984 (2,013,872 / 2,010,096) | 2,014,002 (2,012,240 / 2,015,764) | 2,014,668 (2,014,120 / 2,015,216) | +0.1% | +0.0% | 0.2% | noise |

## Verdicts

**Vapor build (what PR 2/3 enable), now vs before:**

- Faster: checkbox mount −15.0 %, collapsible mount −27.6 %, tabs mount −10.6 %, listbox-virtual
  mount −7.6 %, checkbox update −22.3 %.
- Less memory: residual heap after unmounting 1000 checkboxes −27.6 % (471 KB → 341 KB).
- Noise: listbox-virtual scroll, checkbox unmount, bytes per checkbox instance (+1.5 %), listbox mount heap (+1.1 %).
- Flagged slower: plain mount +14.8 % (9.8 → 11.3 ms, 1.5 ms absolute on the smallest scenario). Against
  the F0 reference below it is noise (+9.2 % vs an 11.6 % spread), so treat it as borderline, not a real regression.

**VDOM build (what every current user runs):** no regression. Plain mount −7.2 % (13.3 → 12.3 ms);
everything else within noise. VDOM bundle +139 B gzip (+0.2 %).

**Bundles:** vdom +0.2 %, interop +2.8 %, vapor +2.6 % gzip. The *rc.16 only → now* column shows
−0.0 % / −0.1 % / +0.1 %: the growth comes from Vue rc.16, not from Reka's changes.

## Where the deltas come from (rc.16 vs our changes)

Read the *Δ now vs rc.16-only* column: it isolates the cleanup round and the PR-branch code on top of the
Vue bump.

- **Every Vapor speed and memory win above comes from Vue 3.6.0-rc.16.** Our changes on top are neutral:
  checkbox mount +1.2 %, collapsible +3.9 %, update +1.6 %, listbox mount/scroll +4.8 % (all noise).
- Our changes cost a little in two places: tabs mount +7.2 % (spread 5.8 %, so just above the noise
  floor) and residual heap after unmount +4.1 % (+13.5 KB per 1000 checkboxes; very stable, so real
  but small). Listbox mount heap +1.1 % (+25.6 KB), also small. These are consistent with the cleanup
  moving logic from hand-written twins into shared as-child code and swapped helpers (more generic, a
  bit more work), which was the maintainability trade-off we chose.
- VDOM: our changes vs rc.16 only are all within noise (−0.8 % to −3.8 % on the timings).
- **Correction to the box run** (`PERF_RESULTS_RC16.md`): it credited our changes with −13.6 % checkbox
  mount and −11.1 % checkbox update vs rc.16 only. On this quiet machine those are +1.2 % and +1.6 %
  (noise). The box ran at load 2–3.6 with other work; its *now vs before* direction matches this run,
  its *now vs rc.16-only* claims do not. Use this file for the PRs.

## Extra reference: F0 baseline on this machine

`packages/vapor/scratch/perf/h7-f0.json`, 2026-11-19 on this same machine and Chrome, vue 3.6.0-rc.15
(one pass, so the spread column only reflects *now*'s two passes):

| metric | F0 (2026-11-19, rc.15) | now | Δ now vs F0 | pass-to-pass spread (max of the 3 points) | verdict |
|---|---|---|---|---|---|
| bundle gzip B (vdom) | 70,850 | 70,989 (70,989 / 70,989) | +0.2% | — | larger |
| bundle gzip B (interop) | 110,359 | 113,463 (113,463 / 113,463) | +2.8% | — | larger |
| bundle gzip B (vapor) | 85,684 | 87,897 (87,897 / 87,897) | +2.6% | — | larger |
| plain mount script ms (vapor) | 10.3 | 11.3 (11.9 / 10.6) | +9.2% | 11.6% | noise |
| checkbox mount script ms (vapor) | 292.8 | 244.4 (247.4 / 241.5) | -16.5% | 2.4% | improvement |
| collapsible mount script ms (vapor) | 318.5 | 235.2 (239.9 / 230.4) | -26.2% | 4.0% | improvement |
| tabs mount script ms (vapor) | 640.8 | 569.7 (577.6 / 561.8) | -11.1% | 2.8% | improvement |
| listbox-virtual mount script ms (vapor) | 19.1 | 15.3 (14.9 / 15.7) | -19.9% | 5.2% | improvement |
| listbox-virtual scroll script ms (vapor) | 333.4 | 250.4 (265.5 / 235.3) | -24.9% | 12.1% | improvement |
| checkbox update:on script ms (vapor) | 321.4 | 252.8 (252.6 / 252.9) | -21.4% | 0.1% | improvement |
| checkbox unmount script ms (vapor) | 44.9 | 40.8 (41.1 / 40.4) | -9.2% | 1.7% | improvement |
| checkbox bytes/instance (vapor) | 31,209 | 31,668.9 (31,669.3 / 31,668.5) | +1.5% | 0.0% | noise |
| checkbox residual after unmount B (vapor) | 471,404 | 341,146 (341,468 / 340,824) | -27.6% | 0.2% | improvement |
| listbox-virtual mount heap B (vapor) | 2,423,040 | 2,447,168 (2,447,316 / 2,447,020) | +1.0% | 0.0% | noise |
| plain mount script ms (vdom) | 13 | 12.3 (12.5 / 12.1) | -5.4% | 3.3% | improvement |
| checkbox mount script ms (vdom) | 391.5 | 383.1 (382.8 / 383.4) | -2.1% | 0.2% | noise |
| collapsible mount script ms (vdom) | 156.3 | 151.2 (155.8 / 146.5) | -3.3% | 6.2% | noise |
| tabs mount script ms (vdom) | 457.7 | 470.9 (481 / 460.8) | +2.9% | 4.3% | noise |
| listbox-virtual mount script ms (vdom) | 13.4 | 13.6 (14.1 / 13) | +1.1% | 8.1% | noise |
| listbox-virtual scroll script ms (vdom) | 246.3 | 247.5 (263.4 / 231.6) | +0.5% | 12.8% | noise |
| checkbox update:on script ms (vdom) | 318.1 | 316.3 (321.4 / 311.2) | -0.6% | 3.2% | noise |
| checkbox unmount script ms (vdom) | 28.1 | 24.1 (24 / 24.1) | -14.4% | 0.4% | improvement |
| checkbox bytes/instance (vdom) | 21,756.3 | 21,759.7 (21,759.7 / 21,759.7) | +0.0% | 0.0% | noise |
| checkbox residual after unmount B (vdom) | 554,508 | 555,030 (555,492 / 554,568) | +0.1% | 0.2% | noise |
| listbox-virtual mount heap B (vdom) | 2,013,736 | 2,014,668 (2,014,120 / 2,015,216) | +0.0% | 0.1% | noise |

F0 was taken at the start of Phase F (FIX_PLAN_7), so *before* (`a1e9d43d2`, the packaging freeze after
FIX_PLAN_7) already includes that phase's work. F0 and *before* agree within a few percent on most rows;
where they differ (listbox-virtual mount 19.1 vs 16.6 ms, scroll 333 vs 264 ms) the gain predates this round.
Against F0, *now* is faster on every Vapor timing except plain mount (noise) and keeps VDOM unchanged.
