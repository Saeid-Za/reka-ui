export { createApp, createSSRApp } from './ssr'
export { cloneVNode, createVNode, defineComponent, h, isVNode } from './vaporH'
/**
 * The `vue` that Reka's *test files* see in the full-suite run (Reka source and
 * SFCs still import the real `vue`). Everything is the real Vue 3.6 except the
 * VNode-creating APIs, which go through the render-function bridge.
 */
export * from 'vue'
