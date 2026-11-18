/**
 * Opt-in Vue Vapor support (Vue >= 3.6).
 *
 * `import 'reka-ui/vapor'` once (e.g. in `main.ts`) lets reka-ui composables
 * that need the current component instance (`useForwardProps`,
 * `useEmitAsProps`, `useForwardPropsEmits`, `useForwardExpose`, ...) work when
 * they are called from `<script setup vapor>` components, where
 * `getCurrentInstance()` returns `null` by design.
 *
 * It is a separate entry so the default build never references Vue 3.6-only
 * exports and keeps supporting Vue 3.4/3.5 and tree-shaking.
 */
import './shared/instance.vapor'

export {}
