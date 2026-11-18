import vue from '@vitejs/plugin-vue'
import { createConfig } from './config.shared.ts'
import { stripVapor } from './rekaVapor.ts'

// Baseline: the same fixtures compiled as regular VDOM components (their
// `vapor` attribute is dropped) with reka-ui as it ships today. Tells a
// Vapor or interop gap apart from a fixture or jsdom problem.
export default createConfig({
  plugins: [stripVapor(), vue()],
  include: ['test-vdom/**/*.test.ts'],
})
