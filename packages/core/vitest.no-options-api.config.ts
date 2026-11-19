import { defineConfig, mergeConfig } from 'vitest/config'
import base from './vite.config'

// Q18: parity check with Options API compiled out (pure-Vapor default).
export default mergeConfig(base, defineConfig({
  define: {
    __VUE_OPTIONS_API__: 'false',
  },
}))
