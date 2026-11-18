import * as Reka from 'reka-ui'
import { expect, it } from 'vitest'

// Every component reka-ui exports, compiled from source in Vapor mode.
const components = Object.entries(Reka).filter(([name, value]) =>
  /^[A-Z]/.test(name) && value && typeof value === 'object' && ('setup' in value || '__name' in value || 'render' in value))

it('exports a non-trivial number of components', () => {
  expect(components.length).toBeGreaterThan(300)
})

it('every exported component is a Vapor component in the Vapor build', () => {
  const notVapor = components.filter(([, value]) => (value as any).__vapor !== true).map(([name]) => name)
  expect(notVapor).toEqual([])
})
