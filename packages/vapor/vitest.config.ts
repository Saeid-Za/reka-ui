import vue from '@vitejs/plugin-vue'
import { createConfig } from './config.shared.ts'

// Interop: the test fixtures opt into Vapor per SFC (`<script setup vapor>`);
// reka-ui is compiled as it ships today (VDOM) and rendered through
// `vaporInteropPlugin`.
export default createConfig({
  plugins: [vue()],
  include: ['test/**/*.test.ts'],
})
