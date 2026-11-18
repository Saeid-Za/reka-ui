import type { Component } from 'vue'
import { createApp, createVaporApp, nextTick, vaporInteropPlugin } from 'vue'

/**
 * - `vapor-app+interop`: `createVaporApp` + `vaporInteropPlugin`: Vapor app code
 *   rendering reka-ui's regular (VDOM) components through Vue's interop layer.
 * - `vdom-app+interop`: classic `createApp` + `vaporInteropPlugin`: Vapor
 *   islands inside a VDOM app.
 * - `vapor-only`: `createVaporApp` without the interop plugin. Only valid when
 *   reka-ui itself is compiled in Vapor mode (vitest.native.config.ts).
 * - `vdom`: classic `createApp`, no interop. Only valid when the fixtures are
 *   compiled as VDOM (vitest.vdom.config.ts): the baseline.
 */
export type Mode = 'vapor-app+interop' | 'vdom-app+interop' | 'vapor-only' | 'vdom'

const mounted: Array<() => void> = []

export function mount(root: Component, mode: Mode) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = mode === 'vdom'
    ? createApp(root)
    : mode === 'vdom-app+interop'
      ? createApp(root).use(vaporInteropPlugin)
      : mode === 'vapor-app+interop'
        ? createVaporApp(root as any).use(vaporInteropPlugin)
        : createVaporApp(root as any)
  app.mount(host)
  const unmount = () => {
    app.unmount()
    host.remove()
  }
  mounted.push(unmount)
  return {
    host,
    /** The root component's `defineExpose` object (refs not unwrapped). */
    exposed: () => (app as any)._instance.exposed as Record<string, any>,
    unmount,
  }
}

export function cleanup() {
  while (mounted.length)
    mounted.pop()!()
}

export async function flush() {
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 0))
  await nextTick()
}
