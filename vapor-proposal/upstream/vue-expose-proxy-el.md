# Draft: Vue — `$el` on component ref / expose proxy under Vapor (QS9)

**Do not post until the owner confirms.** No matching open `vuejs/core` issue found (2026-11-20).
Related but different: [#14242](https://github.com/vuejs/core/issues/14242) (interop template ref
undefined — **closed**); library `getCurrentInstance` facts: [#16305](https://github.com/vuejs/core/issues/16305)
(**open** FR, not `$el`-specific).

Minimal repro: `packages/vapor/test-native/forward-expose-heuristic.test.ts` (“exposes nothing” case).
Vapor children must `defineExpose({ $el })` for `useForwardExpose` consumers.
