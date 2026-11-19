# Draft: Vue — `$el` on component ref / expose proxy under Vapor (QS9)

Minimal repro: `packages/vapor/test-native/forward-expose-heuristic.test.ts` (“exposes nothing” case).
Vapor children must `defineExpose({ $el })` for `useForwardExpose` consumers.