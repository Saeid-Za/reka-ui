import { describe, expect, it } from 'vitest'

declare const __VUE_OPTIONS_API__: boolean

// The pure-Vapor suite runs with the Options API compiled out (as a Vapor-only
// app would ship it), so every scenario in test-native also proves reka-ui does
// not depend on it. See PERF_LOG F1.
describe('pure Vapor compile-time flags', () => {
  it('runs with __VUE_OPTIONS_API__ compiled out', () => {
    expect(__VUE_OPTIONS_API__).toBe(false)
  })
})
