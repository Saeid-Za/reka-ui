/**
 * A pure-Vapor stand-in for `@vue/test-utils`, used only by the full-suite run
 * (vitest.suite.config.ts). It keeps VTU's public API so Reka's test files run
 * unchanged:
 *
 * - DOM-level methods (`find`, `findAll`, `trigger`, `setValue`, `attributes`,
 *   `classes`, `text`, `html`, `exists`, `isVisible`) are VTU's own
 *   `BaseWrapper`/`DOMWrapper`, which only touch the DOM.
 * - Component-level methods (`props`, `setProps`, `emitted`, `vm`,
 *   `findComponent`, `unmount`) are reimplemented on Vapor component instances
 *   and their blocks, because VTU reads VNodes for them.
 *
 * Mounting uses `createVaporApp` without `vaporInteropPlugin`. Anything that
 * needs a VNode (render functions, `h()`, stubs, shallow mount) throws a
 * `VaporSuiteUnsupported` error so it is classified instead of silently passing.
 */
import type { Component } from 'vue'
import {
  BaseWrapper,
  config,
  createWrapperError,
  DOMWrapper,
  flushPromises,
} from '@vue/test-utils/dist/vue-test-utils.esm-bundler.mjs'
import {
  createComponent,
  createTextNode,
  createVaporApp,
  defineVaporComponent,
  isFragment,
  isVaporComponent,
  nextTick,
  proxyRefs,
  setDevtoolsHook,
  shallowReactive,
  toRaw,
} from 'vue'
import { blockNodes, VaporSuiteUnsupported } from './shared'
import { h, reactiveBlock, toVaporComponent } from './vaporH'

export { blockNodes, config, createWrapperError, DOMWrapper, flushPromises, VaporSuiteUnsupported }

type AnyInstance = any

// Like VTU: component emits are recorded through Vue's devtools hook, which
// Vapor's `emit` reports to as well, so `emitted()` works for any instance.
const emittedByInstance = new WeakMap<object, Record<string, unknown[][]>>()
setDevtoolsHook({
  enabled: true,
  emit(event: string, ...args: any[]) {
    if (event !== 'component:emit')
      return
    const [, instance, name, params] = args
    const record = emittedByInstance.get(instance) ?? {}
    emittedByInstance.set(instance, record)
    ;(record[name] ??= []).push(params)
  },
  on() {},
  once() {},
  off() {},
  appRecords: [],
} as any, {})

const NEEDS_COMPILER_RE = /\{\{|<[A-Z]|\sv-|\s[:@#]/
const TRANSITION_STUB_RE = /^transition(?:-group)?$|^TransitionGroup$/i

/** Every Vapor component instance inside a block (depth first, document order). */
function blockInstances(block: any, out: AnyInstance[] = []): AnyInstance[] {
  if (!block || block instanceof Node)
    return out
  if (Array.isArray(block)) {
    for (const b of block) blockInstances(b, out)
    return out
  }
  if (isVaporComponent(block)) {
    out.push(block)
    blockInstances((block as AnyInstance).block, out)
    return out
  }
  if (isFragment(block))
    blockInstances((block as any).nodes, out)
  return out
}

function isComponentObject(value: any) {
  return value && typeof value === 'object' && ('setup' in value || 'render' in value || '__vapor' in value || '__name' in value || 'template' in value)
}

function assertVaporComponent(comp: any, where: string) {
  if (typeof comp === 'function' && !comp.__vapor)
    throw new VaporSuiteUnsupported(`${where}: functional/VDOM component`)
  if (comp && typeof comp === 'object' && !comp.__vapor) {
    if (comp.template)
      throw new VaporSuiteUnsupported(`${where}: runtime template string (not a literal the build can compile)`)
    if (comp.render || comp.setup)
      throw new VaporSuiteUnsupported(`${where}: VDOM component (render function / h())`)
  }
}

function matchesComponent(instance: AnyInstance, selector: any) {
  const type = instance.type
  if (typeof selector === 'string')
    return false
  if (selector && typeof selector === 'object' && 'name' in selector && !('setup' in selector) && !('__vapor' in selector))
    return type.name === selector.name || type.__name === selector.name
  return type === selector || toRaw(type) === toRaw(selector)
}

function htmlBlock(source: string) {
  if (!source.includes('<'))
    return createTextNode(source)
  if (NEEDS_COMPILER_RE.test(source))
    throw new VaporSuiteUnsupported(`slot template string needs runtime compilation: ${source.slice(0, 60)}`)
  const t = document.createElement('template')
  t.innerHTML = source
  return Array.from(t.content.childNodes)
}

function normalizeSlots(slots: Record<string, any> | undefined) {
  if (!slots)
    return undefined
  const out: Record<string, (props: any) => any> = {}
  for (const [name, slot] of Object.entries(slots)) {
    if (typeof slot === 'string')
      out[name] = () => htmlBlock(slot)
    else if (typeof slot === 'function' && !isComponentObject(slot))
      out[name] = (props: any) => reactiveBlock(() => slot(props))
    else if (isComponentObject(slot))
      out[name] = () => reactiveBlock(() => h(slot))
    else
      out[name] = () => reactiveBlock(() => slot)
  }
  return out
}

const mountedWrappers = new Set<VaporWrapper>()

export function enableAutoUnmount(hook: (fn: () => void) => void) {
  hook(() => {
    for (const wrapper of mountedWrappers)
      wrapper.unmount()
    mountedWrappers.clear()
  })
}

export function disableAutoUnmount() {}

export interface MountOptions {
  props?: Record<string, any>
  propsData?: Record<string, any>
  attrs?: Record<string, any>
  slots?: Record<string, any>
  attachTo?: Element | string
  shallow?: boolean
  global?: {
    plugins?: any[]
    provide?: Record<string | symbol, any>
    components?: Record<string, Component>
    directives?: Record<string, any>
    stubs?: Record<string, any> | string[]
    mocks?: Record<string, any>
    config?: Record<string, any>
  }
  data?: () => Record<string, any>
}

export function mount(component: any, options: MountOptions = {}): VaporWrapper {
  if (options.shallow)
    throw new VaporSuiteUnsupported('shallow mount')
  if (options.data)
    throw new VaporSuiteUnsupported('mount option `data` (Options API)')
  const stubs = options.global?.stubs
  if (stubs) {
    // VTU stubs <transition>/<transition-group> by default; `transition: false`
    // only turns that off. Reka renders no Vue <Transition>, so ignore those.
    const names = Array.isArray(stubs) ? stubs : Object.keys(stubs)
    const real = names.filter(n => !TRANSITION_STUB_RE.test(n))
    if (real.length)
      throw new VaporSuiteUnsupported(`global.stubs (${real.join(', ')}): Vapor resolves imported components at compile time`)
  }
  if (options.global?.mocks && Object.keys(options.global.mocks).length)
    throw new VaporSuiteUnsupported('global.mocks')
  component = toVaporComponent(typeof component === 'function' && !component.__vapor
    ? { name: component.name, props: component.props, emits: component.emits, setup: (p: any, ctx: any) => () => component(p, ctx) }
    : component)
  assertVaporComponent(component, 'mounted component')

  const state = shallowReactive<Record<string, any>>({ ...options.propsData, ...options.props, ...options.attrs })
  const rawProps = { $: [() => state] }
  const rawSlots = normalizeSlots(options.slots)

  let child: AnyInstance
  const Root = defineVaporComponent({
    name: 'VTU_ROOT',
    setup() {
      child = createComponent(component, rawProps as any, rawSlots as any, true)
      return child
    },
  })

  const app = createVaporApp(Root as any)
  const g = options.global ?? {}
  for (const plugin of g.plugins ?? []) {
    if (Array.isArray(plugin))
      app.use(plugin[0], ...plugin.slice(1))
    else
      app.use(plugin)
  }
  for (const [name, comp] of Object.entries(g.components ?? {})) app.component(name, comp)
  for (const [name, dir] of Object.entries(g.directives ?? {})) app.directive(name, dir)
  for (const key of Reflect.ownKeys(g.provide ?? {})) app.provide(key as any, (g.provide as any)[key])
  if (g.config)
    Object.assign(app.config, g.config)

  const container = document.createElement('div')
  if (options.attachTo) {
    const target = typeof options.attachTo === 'string' ? document.querySelector(options.attachTo) : options.attachTo
    if (!target)
      throw new Error(`Unable to find the element matching the selector ${options.attachTo} given as the \`attachTo\` option`)
    target.appendChild(container)
  }
  app.mount(container)

  const wrapper = new VaporWrapper(child!, { app, container, state, attached: !!options.attachTo })
  mountedWrappers.add(wrapper)
  return wrapper
}

export const shallowMount = (component: any, options: MountOptions = {}) => mount(component, { ...options, shallow: true })

export function renderToString(): never {
  throw new VaporSuiteUnsupported('VTU renderToString (SSR)')
}

export const RouterLinkStub = {}

interface RootContext {
  app: any
  container: HTMLElement
  state: Record<string, any>
  attached: boolean
}

export class VaporWrapper extends (BaseWrapper as any) {
  instance: AnyInstance
  root?: RootContext
  private _vm?: any

  constructor(instance: AnyInstance, root?: RootContext) {
    super(undefined)
    this.instance = instance
    this.root = root
  }

  getRootNodes(): Node[] {
    return blockNodes(this.instance.block)
  }

  get element(): any {
    const nodes = this.getRootNodes()
    const elements = nodes.filter(n => n.nodeType === 1)
    const significant = nodes.filter(n => n.nodeType === 1 || (n.nodeType === 3 && n.textContent!.trim()))
    if (elements.length === 1 && significant.length === 1)
      return elements[0]
    if (nodes.length === 1)
      return nodes[0]
    return nodes[0]?.parentElement ?? this.root?.container
  }

  get parentElement() {
    return this.element?.parentElement
  }

  getCurrentComponent() {
    return { refs: this.instance.refs ?? {} }
  }

  findAll(selector: any): any[] {
    if (typeof selector !== 'string')
      return []
    return (this as any).findAllDOMElements(selector).map((el: Element) => new DOMWrapper(el))
  }

  findComponent(selector: any): any {
    if (selector && typeof selector === 'object' && 'ref' in selector && Object.keys(selector).length === 1) {
      let result = this.instance.refs?.[selector.ref]
      if (Array.isArray(result))
        result = result[0]
      if (result && isVaporComponent(result))
        return new VaporWrapper(result)
      return createWrapperError('VueWrapper')
    }
    if (typeof selector === 'string')
      throw new VaporSuiteUnsupported('findComponent(css selector)')
    const [found] = this.findAllComponents(selector)
    return found ?? createWrapperError('VueWrapper')
  }

  findAllComponents(selector: any): any[] {
    if (typeof selector === 'string')
      throw new VaporSuiteUnsupported('findAllComponents(css selector)')
    const all = blockInstances(this.instance.block)
    return all.filter(i => matchesComponent(i, selector)).map(i => new VaporWrapper(i))
  }

  exists() {
    return !this.instance.isUnmounted
  }

  props(key?: string) {
    const props = this.instance.props
    return key ? props[key] : { ...props }
  }

  emitted(event?: string): any {
    const emitted = emittedByInstance.get(this.instance) ?? {}
    return event ? emitted[event] : emitted
  }

  async setProps(props: Record<string, any>) {
    if (!this.root)
      throw new VaporSuiteUnsupported('setProps() on a nested component wrapper')
    Object.assign(this.root.state, props)
    await nextTick()
  }

  async setValue(value: any, prop = 'modelValue') {
    if (!this.root)
      return (DOMWrapper.prototype as any).setValue.call(this, value)
    this.instance.emit(`update:${prop}`, value)
    await this.setProps({ [prop]: value })
  }

  get vm(): any {
    if (this._vm)
      return this._vm
    const instance = this.instance
    const exposed = instance.exposed ? proxyRefs(instance.exposed) : {}
    const setupState = instance.setupState ?? {}
    this._vm = new Proxy({}, {
      get: (_, key) => {
        if (key === '$el')
          return this.element
        if (key === '$props')
          return instance.props
        if (key === '$attrs')
          return instance.attrs
        if (key === '$emit')
          return instance.emit
        if (key === '$nextTick')
          return nextTick
        if (key === '$')
          return instance
        if (key in exposed)
          return (exposed as any)[key]
        if (key in setupState)
          return setupState[key]
        if (instance.props && key in instance.props)
          return instance.props[key]
        return undefined
      },
      has: (_, key) => key in exposed || key in setupState || (instance.props && key in instance.props),
      set: (_, key, value) => {
        if (key in exposed) {
          (exposed as any)[key] = value
          return true
        }
        setupState[key as any] = value
        return true
      },
    })
    return this._vm
  }

  unmount() {
    if (!this.root)
      throw new Error('wrapper.unmount() can only be called on the root wrapper')
    if (this.instance.isUnmounted && !this.root.app._container)
      return
    this.root.app.unmount()
    if (this.root.attached)
      this.root.container.remove()
    mountedWrappers.delete(this)
  }
}

/** Type-compatible aliases so `import type { VueWrapper } from '@vue/test-utils'` keeps working. */
export const VueWrapper = VaporWrapper
