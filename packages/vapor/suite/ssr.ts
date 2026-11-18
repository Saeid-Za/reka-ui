import * as serverRenderer from 'vapor-suite:real-server-renderer'
/**
 * Vapor SSR for the full-suite run: `createSSRApp` + `renderToString` + `mount`,
 * the way Vue 3.6 renders and hydrates Vapor components (see ssrTwins.ts):
 *
 * - `renderToString(app)` renders the *server-compiled* twin of the app's component
 *   tree with the real `@vue/server-renderer` (runtime-core `createSSRApp`, which is
 *   how vuejs/core's own Vapor hydration tests render the server side).
 * - `app.mount(container)` hydrates with `createVaporSSRApp` (runtime-vapor). No
 *   interop plugin, no VDOM on the client.
 *
 * A component's server twin:
 * - a Reka SFC (`__file`) → the same SFC compiled with `ssr: true` (`vssr:` graph);
 * - a test component with a literal `template:` → its inline `__ssrRender`
 *   (inlineTemplates.ts compiles both);
 * - an `h()` render-function component → none. Vapor has no VNode tree to render
 *   on the server or to hydrate on the client, so this is reported as unsupported,
 *   and the test needs a template variant (FULL_SUITE.md, "Vapor SSR").
 */
import { createSSRApp as createServerApp, createVaporApp, createVaporSSRApp } from 'vue'
import { compileRuntimeSSRTemplate } from './runtimeTemplate'
import { VaporSuiteUnsupported } from './shared'
import { toVaporComponent } from './vaporH'

const SSR_APP = Symbol('vapor-suite-ssr-app')
const twins = new WeakMap<object, Promise<any>>()

async function serverTwin(comp: any): Promise<any> {
  if (!comp || typeof comp !== 'object')
    return comp
  let twin = twins.get(comp)
  if (!twin) {
    twin = createTwin(comp)
    twins.set(comp, twin)
  }
  return twin
}

async function createTwin(comp: any): Promise<any> {
  if (comp.__file && !comp.__ssrRender && !comp.__template && typeof comp.template !== 'string') {
    const mod = await import(/* @vite-ignore */ `vssr:${comp.__file}`)
    return mod.default
  }
  const template = comp.__template ?? comp.template
  const ssrRender = comp.__ssrRender ?? (typeof template === 'string' ? compileRuntimeSSRTemplate(template, serverRenderer) : undefined)
  if (ssrRender) {
    const twin: any = { ...comp, __vapor: true, ssrRender }
    delete twin.__template
    delete twin.template
    delete twin.render
    delete twin.__ssrRender
    if (comp.components) {
      const entries = await Promise.all(Object.entries(comp.components).map(async ([k, v]) => [k, await serverTwin(v)]))
      twin.components = Object.fromEntries(entries)
    }
    return twin
  }
  if (comp.__vapor && !comp.setup && !comp.render)
    return comp
  throw new VaporSuiteUnsupported(`SSR of a render-function (h()) component${comp.name ? ` (${comp.name})` : ''}: Vapor SSR needs compiled templates on both sides`)
}

export interface SuiteSSRApp {
  [SSR_APP]: true
  component: any
  props: Record<string, any> | null | undefined
  setups: Array<(app: any) => void>
  use: (plugin: any, ...options: any[]) => SuiteSSRApp
  provide: (key: any, value: any) => SuiteSSRApp
  component_?: never
  config: Record<string, any>
  mount: (container: Element | string) => any
  unmount: () => void
  _app?: any
}

export function createSSRApp(component: any, props?: Record<string, any> | null): SuiteSSRApp {
  const app: SuiteSSRApp = {
    [SSR_APP]: true,
    component,
    props,
    setups: [],
    config: {},
    use(plugin, ...options) {
      app.setups.push(a => a.use(plugin, ...options))
      return app
    },
    provide(key, value) {
      app.setups.push(a => a.provide(key, value))
      return app
    },
    mount(container) {
      const client = createVaporSSRApp(toVaporComponent(component), props)
      for (const setup of app.setups) setup(client)
      Object.assign(client.config, app.config)
      app._app = client
      return client.mount(container as any)
    },
    unmount() {
      app._app?.unmount()
    },
  }
  return app
}

export const isSuiteSSRApp = (value: any): value is SuiteSSRApp => !!value && value[SSR_APP] === true

export async function renderToString(input: any, context?: any): Promise<string> {
  if (!isSuiteSSRApp(input))
    return serverRenderer.renderToString(input, context)
  const server = createServerApp(await serverTwin(input.component), input.props)
  for (const setup of input.setups) setup(server)
  Object.assign(server.config, input.config)
  return serverRenderer.renderToString(server, context)
}

/** `createApp` for test files: a client-only Vapor app (no interop plugin). */
export function createApp(component: any, props?: Record<string, any> | null) {
  return createVaporApp(toVaporComponent(component), props)
}
