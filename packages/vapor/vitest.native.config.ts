import vue from '@vitejs/plugin-vue'
import { createConfig } from './config.shared.ts'
import { rekaVaporSwap } from './rekaVapor.ts'

// Pure Vapor: every SFC (the fixtures' and reka-ui's own) is compiled in Vapor
// mode, mounted with `createVaporApp` and no interop plugin.
export default createConfig({
  plugins: [rekaVaporSwap(), vue({ features: { vapor: true } })],
  include: ['test-native/**/*.test.ts'],
  optionsApi: false,
})
