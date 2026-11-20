# Related upstream issues (packaging freeze + Vue rc.16 recheck)

Updated 2026-11-20 after FIX_PLAN_8: `packages/vapor` **adopted 3.6.0-rc.16** (includes
[vuejs/core#16340](https://github.com/vuejs/core/pull/16340)). Gate **3550 / 2 / 35** (post-audit).
Do not post drafts unless the owner opens them.

## Vue (`vuejs/core`)

| Gap / our QS | Upstream | Status | Fit |
|---|---|---|---|
| Interop SSR: `cloneVNode` attrs on vapor slot content | [#16269](https://github.com/vuejs/core/issues/16269) → [#16340](https://github.com/vuejs/core/pull/16340) | **Closed** (merged; in rc.16) | Same Reka `Slot` / Nuxt UI story. **Not** the same path as pure-Vapor Tabs SSR (QS7). |
| Client interop as-child fallthrough | [#15989](https://github.com/vuejs/core/pull/15989) | Merged (rc.15+) | Why vapor package needed ≥ rc.15 |
| Historical as-child crash | [#14771](https://github.com/vuejs/core/issues/14771) | Fixed | — |
| `getCurrentInstance()` null / library facts | [#16305](https://github.com/vuejs/core/issues/16305) | **Open** (feature request) | Same root cause as Reka `useForwardProps*`; Vase UI. Author may close after migrating away. |
| `v-show` VDOM→Vapor child | [#14354](https://github.com/vuejs/core/issues/14354) → [#14355](https://github.com/vuejs/core/pull/14355) | Closed | Interop directives; **not** QS14 Combobox twin/`display:flex` |
| `v-show` multi-root | [#13765](https://github.com/vuejs/core/issues/13765) | Closed | — |
| Style / fallthrough layers | [#15642](https://github.com/vuejs/core/pull/15642), [#15310](https://github.com/vuejs/core/pull/15310), [#15148](https://github.com/vuejs/core/issues/15148) | Merged / closed | Same *family* as style merge; no open issue matching QS14 |
| Template ref undefined (interop) | [#14242](https://github.com/vuejs/core/issues/14242) | Closed | Different from QS9 “expose nothing → no `$el`” |
| Transition + KeepAlive | [#13153](https://github.com/vuejs/core/issues/13153), vapor Transition [#12962](https://github.com/vuejs/core/pull/12962), KeepAlive [#13186](https://github.com/vuejs/core/issues/13186) | Adjacent | QS12 is mostly our test bridge |

## Reka (`unovue/reka-ui`)

| Topic | Upstream | Notes |
|---|---|---|
| “Open a dedicated Vapor issue” | [#2721](https://github.com/unovue/reka-ui/issues/2721) | Our `ISSUE.md` / `reka-discussion.md` answer that ask; **not posted** |
| Combobox in Dialog focus | [#2749](https://github.com/unovue/reka-ui/issues/2749) | QS15 |
| `useId` namespace import | [#3018](https://github.com/unovue/reka-ui/issues/3018) | Separate from this branch |

## No matching open Vue issue (ours / draft only)

| Item | Draft / owner |
|---|---|
| **QS7** pure-Vapor Tabs SSR first paint (attrs still missing on rc.16) | `vue-vapor-ssr-as-child.md` — distinct from #16269 |
| **QS9** `$el` on empty expose proxy | `vue-expose-proxy-el.md` |
| **QS14** Combobox closed `display:flex` | Reka twin / style order (or new Vue repro if proven) |
| **QS16**, **9.2**, **9.3** | Reka |
| **9.4**, **QS12** | Harness |
| **QS17** Dialog warn flake | Needs Vue lifecycle repro before filing |

## QS7 + rc.16 adoption (FIX_PLAN_8, 2026-11-20)

- Suite filter: Tabs SSR → **still FAIL** on rc.16 (pure-Vapor path ≠ #16269).
- First raw rc.16 suite was **3538 / 14 / 35** (Checkbox stuck-checked via story `v-bind="props"`).
- **U1** fixed Checkbox story; **U3** fixed TagGroup; pin **kept on rc.16**.
- Current gate: **3550 / 2 / 35**. Keep QS7 leave-red; do **not** close pure-Vapor draft against #16269.
