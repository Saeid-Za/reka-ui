# PR 1 of 3 — branch `vapor-pr/1-vdom-safe` → `unovue/reka-ui:v2`

**Title:** refactor: read the component instance through one seam (Vapor prep, no behaviour change)

<!-- pr-template -->
### 🔗 Linked issue

RFC: #RFC (answers #2721).

### ❓ Type of change

- [ ] 📖 Documentation (updates to the documentation, readme or JSdoc annotations)
- [x] 🐞 Bug fix (a non-breaking change that fixes an issue)
- [x] 👌 Enhancement (improving an existing functionality like performance)
- [ ] ✨ New feature (a non-breaking change that adds functionality)
- [ ] 🧹 Chore (updates to the build process or auxiliary tools and libraries)
- [ ] ⚠️ Breaking change (fix or feature that would cause existing functionality to change)

### 📚 Description

## Summary

First, VDOM-only step of Vapor support (#2721, RFC: #RFC). It changes
nothing for current users and can be merged on its own.

- `shared/instance.ts`: `getInstance()` plus small accessors (assigned props, component name,
  scope id, root node) over `getCurrentInstance()`. `useForwardProps`, `useEmitAsProps`,
  `useForwardRef`, `useForwardScopeId`, `useForwardExpose`, `resolveElement` and the roots
  that read the instance (`AutocompleteRoot`, `ComboboxRoot`, `FormRoot`, `TagGroupRoot`) go
  through it instead of reading `vnode` internals. A later, opt-in entry can register a
  resolver for Vapor instances; until then the code path is the same as today.
- Fixes found while running the suite in other render modes, all VDOM-safe:
  - `useFormControl` reads `closest('form')` again once mounted (the computed is not reactive
    to DOM insertion).
  - `SelectContentImpl` ignores a comment anchor as the content element (as-child content that
    renders nothing made `hasAttribute` / floating-ui throw).
  - `ComboboxContentImpl` derives `display` from `present`, so closed persistent content is
    hidden without relying on `v-show` on a component. Consumer styles still apply.
- Template-only refactors: virtualizers render the window with `v-for` + `Primitive as-child`
  instead of cloning slot vnodes in a computed; `PopoverTrigger` uses `v-if`/`v-else` instead of
  `<component :is>`; `StepperRoot` renders the live announcement only when set.
- `test/mode.ts`: an `isVapor` flag (always `false` in this repo's run) for the mode-aware
  tests in the follow-up PRs.

6 commits, 31 files, +1282 / −251.

## Test evidence (local, 2026-11-20)

| Check | Base (`a9873a029`) | This branch |
|---|---|---|
| `pnpm --filter reka-ui build` (vue-tsc + tsdown) | pass | pass |
| `eslint .` | pass | pass |
| `vitest run` (jsdom) | 3533 passed, 35 skipped | **3548 passed, 35 skipped** |

New tests: `shared/instance.test.ts`, Combobox persistent-content display and object-model
search term, `useRenderedContentId` comment-anchor cases, virtualizer item rendering.

## Performance

No runtime change intended for VDOM users. The benchmark harness lives in PR 3's package, so there is no
direct upstream-`v2` comparison; across the last round of this work (Chrome 155, 4× CPU throttle, 2 passes
in reversed order) every VDOM timing (checkbox, collapsible, tabs, virtual listbox mount / scroll / update
/ unmount) stayed within noise and the VDOM bench bundle changed by +139 B gzip (+0.2 %). Full table in
the RFC (#RFC).

## Known issues

None in VDOM. The branch was cut from `a9873a029`; `v2` has moved since (see the notes on
rebasing in the stack description).

## Breaking changes

None. `shared/instance.ts` is internal (not exported from the package entry).

### 📝 Checklist

- [x] I have linked an issue or discussion.
- [ ] I have updated the documentation accordingly. (No user-facing change in this PR.)
