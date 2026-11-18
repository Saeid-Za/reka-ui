/**
 * Render-function bridge for the full-suite run (test scaffolding only).
 *
 * About a fifth of Reka's tests build their scaffolding with `h()` render
 * functions instead of SFCs: `defineComponent({ setup: () => () => h(DialogRoot,
 * ...) })`. `h()` creates VNodes, and pure Vapor has no VNode renderer. To still
 * exercise the *Reka components* those tests mount, test files get a `vue` whose
 * `h()` returns plain descriptors and whose `defineComponent()` turns a
 * render-function component into a Vapor component. The descriptors are mounted
 * with Vapor's own primitives: `createComponent` for components (Reka's,
 * compiled as Vapor), plain DOM for elements, `setDynamicProps` for element
 * props/listeners. A re-render diffs the new descriptors against the mounted
 * ones by position (and `key`), so component instances and their state survive
 * re-renders exactly as with the VDOM.
 *
 * Only the test's own wrapper components run through this bridge. Every Reka
 * component underneath is a real Vapor component, created and updated through
 * Vapor's public runtime API. Results of tests that need the bridge are
 * reported separately in FULL_SUITE.md (they depend on this file being right).
 *
 * Options-API `render()` with `this` gets a small stand-in for the public
 * instance (setup state, props, `$attrs`/`$slots`/`$emit`/`$props`), see
 * `optionsApiThis` (ADR-S11).
 *
 * Not supported (throws VaporSuiteUnsupported): `cloneVNode`, inspecting VNode fields, directives via `withDirectives`.
 */
import type { EffectScope } from 'vue'
import {
  createComponent,
  createTemplateRefSetter,
  currentInstance,
  effectScope,
  Fragment,
  getCurrentScope,
  insert,
  isFragment,
  isRef,
  isVaporComponent,
  KeepAlive,
  proxyRefs,
  reactive,
  remove,
  restoreCurrentInstance,
  setCurrentInstance,
  setDynamicProps,
  shallowReactive,
  shallowRef,
  Teleport,
  Transition,
  TransitionGroup,
  VaporKeepAlive,
  VaporTeleport,
  VaporTransition,
  VaporTransitionGroup,
  watch,
} from 'vue'
import { compileRuntimeTemplate } from './runtimeTemplate'
import { blockNodes, VaporSuiteUnsupported } from './shared'

const VD = Symbol('vapor-suite-descriptor')
const SLOT = Symbol('vapor-suite-slot-call')

interface Desc {
  [VD]: true
  type: any
  props: Record<string, any> | null
  children: any
  key: any
}

interface SlotCall {
  [SLOT]: true
  name: string
  fn: (props: any) => any
  props: Record<string, any>
}

export const isDesc = (v: any): v is Desc => !!v && v[VD] === true
const isSlotCall = (v: any): v is SlotCall => !!v && v[SLOT] === true

const BUILTINS = new Map<any, any>([
  [Teleport, VaporTeleport],
  [KeepAlive, VaporKeepAlive],
  [Transition, VaporTransition],
  [TransitionGroup, VaporTransitionGroup],
])

export function h(type: any, a?: any, b?: any, ...rest: any[]): Desc {
  let props: Record<string, any> | null = null
  let children: any
  if (arguments.length === 2) {
    if (a && typeof a === 'object' && !Array.isArray(a) && !isDesc(a) && !isSlotCall(a) && !(a instanceof Node))
      props = a
    else
      children = a
  }
  else if (arguments.length > 2) {
    props = a ?? null
    children = rest.length ? [b, ...rest] : b
  }
  return { [VD]: true, type: BUILTINS.get(type) ?? type, props, children, key: props?.key }
}

export const createVNode = (type: any, props?: any, children?: any) => h(type, props ?? null, children)

export function cloneVNode(): never {
  throw new VaporSuiteUnsupported('cloneVNode()')
}

export function isVNode(value: any) {
  return isDesc(value)
}

// ---------------------------------------------------------------------------
// Components

const converted = new WeakMap<object, any>()

/** `defineComponent()` for test files: render-function components become Vapor components. */
export function defineComponent(options: any, extra?: any): any {
  if (typeof options === 'function')
    return toVaporComponent({ ...extra, setup: options, name: extra?.name ?? options.name })
  return toVaporComponent(options)
}

export function toVaporComponent(options: any): any {
  if (!options || typeof options !== 'object')
    return options
  if ((options.data || options.methods) && !converted.has(options)) {
    const comp = toVaporComponent(withOptionsApiState(options))
    converted.set(options, comp)
    return comp
  }
  if (options.__vapor)
    return options
  if (BUILTINS.has(options))
    return BUILTINS.get(options)
  const cached = converted.get(options)
  if (cached)
    return cached
  let comp: any
  if (typeof options.template === 'string') {
    comp = { ...options, __vapor: true, render: compileRuntimeTemplate(options.template), __template: options.template }
    delete comp.template
  }
  else if (options.setup || options.render) {
    const { setup, render } = options
    comp = {
      ...options,
      __vapor: true,
      setup(props: any, ctx: any) {
        const vdomCtx = { ...ctx, attrs: ctx.attrs, emit: ctx.emit, expose: ctx.expose, slots: wrapSlots(ctx.slots) }
        const result = setup ? setup(props, vdomCtx) : undefined
        if (result && typeof result.then === 'function')
          throw new VaporSuiteUnsupported('async setup() in a render-function component')
        let renderFn: () => any
        if (typeof result === 'function') {
          renderFn = result
        }
        else if (render) {
          const state = proxyRefs(result ?? {})
          // Options-API `render()` reads `this`: give it the public-instance
          // view VDOM would (setup state, then props, then a few `$` fields).
          const self = optionsApiThis(state, props, ctx)
          if (currentInstance)
            (currentInstance as any).setupState = state
          renderFn = () => render.call(self, self, props)
        }
        else {
          return result
        }
        return reactiveBlock(renderFn)
      },
    }
    delete comp.render
  }
  else {
    comp = { ...options, __vapor: true, setup: () => [] }
  }
  if (options.components) {
    comp.components = Object.fromEntries(Object.entries(options.components).map(([k, v]) => [k, toVaporComponent(v)]))
  }
  converted.set(options, comp)
  return comp
}

/**
 * Options-API `data()` and `methods` on a test component (ADR-S11): folded into
 * `setup()` as one reactive state object, which is what the component's
 * template reads and what `this` is inside `data()` and the methods. Vapor
 * components have no Options API, so this only exists for test scaffolding.
 */
function withOptionsApiState(options: any) {
  const { data, methods, setup, ...rest } = options
  return {
    ...rest,
    setup(props: any, ctx: any) {
      const base = setup ? setup(props, ctx) : undefined
      if (base !== undefined && (typeof base !== 'object' || Array.isArray(base) || isFragment(base) || base instanceof Node))
        throw new VaporSuiteUnsupported('Options-API data()/methods with a setup() that returns a render function or block')
      const state: Record<string, any> = reactive({ ...base })
      if (data)
        Object.assign(state, data.call(state, state))
      for (const [key, fn] of Object.entries(methods ?? {}))
        state[key] = (fn as (...args: any[]) => any).bind(state)
      return state
    },
  }
}

/**
 * The `this` of an Options-API `render()`: reads go to setup state, then props,
 * then `$attrs`/`$slots`/`$emit`/`$props`; writes go to setup state (refs are
 * set through `proxyRefs`). Reads are reactive because `render()` runs inside
 * the block's effect. Mirrors what VDOM's public instance proxy offers for these
 * keys; `data()` and `methods` are folded into setup state by
 * `withOptionsApiState`, `computed`/`watch` options are not emulated.
 */
function optionsApiThis(state: any, props: any, ctx: any) {
  return new Proxy({}, {
    get(_, key) {
      if (key in state)
        return state[key]
      if (props && key in props)
        return props[key]
      switch (key) {
        case '$props': return props
        case '$attrs': return ctx.attrs
        case '$slots': return wrapSlots(ctx.slots)
        case '$emit': return ctx.emit
      }
      return undefined
    },
    set(_, key, value) {
      state[key] = value
      return true
    },
    has: (_, key) => key in state || (props && key in props),
  })
}

function wrapSlots(slots: any) {
  return new Proxy(slots, {
    get(target, key) {
      const fn = target[key]
      if (typeof key !== 'string' || typeof fn !== 'function')
        return fn
      return (props: any = {}) => ({ [SLOT]: true, name: key, fn, props }) satisfies SlotCall
    },
  })
}

// ---------------------------------------------------------------------------
// Mounting and patching

type M
  = | { kind: 'text', node: Text }
    | { kind: 'el', type: string, el: Element, children: M[], props: any, ref?: any }
    | { kind: 'comp', type: any, inst: any, scope: EffectScope, propsRef: any, slotsRef: any, ref?: any, key: any }
    | { kind: 'slot', fn: any, block: any, scope: EffectScope, props: Record<string, any> }
    | { kind: 'block', block: any }

type Child = string | Desc | SlotCall | { kind: 'raw', block: any }

function normalize(value: any, out: Child[] = []): Child[] {
  if (value == null || typeof value === 'boolean')
    return out
  if (Array.isArray(value)) {
    for (const v of value) normalize(v, out)
    return out
  }
  if (typeof value === 'string' || typeof value === 'number') {
    out.push(String(value))
    return out
  }
  if (isSlotCall(value)) {
    out.push(value)
    return out
  }
  if (isDesc(value)) {
    if (value.type === Fragment)
      return normalize(value.children, out)
    if (typeof value.type === 'function' && !value.type.__vapor && !isVaporComponent(value.type)) {
      // Functional component: expand inline on every render.
      return normalize(value.type(value.props ?? {}, { slots: descSlots(value.children), attrs: value.props ?? {}, emit: () => {} }), out)
    }
    out.push(value)
    return out
  }
  if (value instanceof Node || isVaporComponent(value) || isFragment(value)) {
    out.push({ kind: 'raw', block: value })
    return out
  }
  if (value.__v_isVNode)
    throw new VaporSuiteUnsupported('a real VNode reached the render-function bridge')
  out.push(String(value))
  return out
}

function descSlots(children: any): Record<string, (p?: any) => any> {
  if (children == null)
    return {}
  if (typeof children === 'function')
    return { default: children }
  if (typeof children === 'object' && !Array.isArray(children) && !isDesc(children) && !isSlotCall(children))
    return children
  return { default: () => children }
}

function splitProps(props: Record<string, any> | null) {
  if (!props)
    return { rest: {}, ref: undefined }
  const { key: _key, ref, ...rest } = props
  return { rest, ref }
}

interface Ctx {
  owner: any
  scope: EffectScope | undefined
  setRef: ((el: any, ref: any) => void) | undefined
}

function inOwner<T>(ctx: Ctx, scope: EffectScope | undefined, fn: () => T): T {
  const prev = setCurrentInstance(ctx.owner, scope)
  try {
    return fn()
  }
  finally {
    restoreCurrentInstance(prev)
  }
}

function applyRef(ctx: Ctx, target: any, ref: any) {
  if (ref == null)
    return
  const value = isVaporComponent(target) ? (target.exposed ? proxyRefs(target.exposed) : target) : target
  if (typeof ref === 'function')
    ref(value)
  else if (isRef(ref))
    ref.value = value
  else if (ctx.setRef)
    inOwner(ctx, ctx.scope, () => ctx.setRef!(target, ref))
}

function sameType(m: M, c: Child) {
  if (typeof c === 'string')
    return m.kind === 'text'
  if (isSlotCall(c))
    return m.kind === 'slot' && m.fn === c.fn
  if ('kind' in c)
    return m.kind === 'block' && m.block === c.block
  if (m.kind === 'el')
    return m.type === c.type
  if (m.kind === 'comp')
    return m.type === c.type && m.key === c.key
  return false
}

function childScope(ctx: Ctx): EffectScope {
  return ctx.scope ? ctx.scope.run(() => effectScope())! : effectScope()
}

function mountChild(ctx: Ctx, c: Child, svg: boolean): M {
  if (typeof c === 'string')
    return { kind: 'text', node: document.createTextNode(c) }
  if (isSlotCall(c)) {
    const scope = childScope(ctx)
    const props = shallowReactive({ ...c.props })
    const block = inOwner(ctx, scope, () => c.fn(props))
    return { kind: 'slot', fn: c.fn, block, scope, props }
  }
  if ('kind' in c)
    return { kind: 'block', block: c.block }
  const { rest, ref } = splitProps(c.props)
  if (typeof c.type === 'string') {
    const isSvg = svg || c.type === 'svg'
    const el = isSvg ? document.createElementNS('http://www.w3.org/2000/svg', c.type) : document.createElement(c.type)
    setDynamicProps(el, [rest], undefined, isSvg)
    const children = mountList(ctx, normalize(childrenOfElement(c)), el, null, isSvg)
    const m: M = { kind: 'el', type: c.type, el, children, props: rest, ref }
    applyRef(ctx, el, ref)
    return m
  }
  const type = toVaporComponent(c.type)
  if (!type || (typeof type === 'object' && !type.__vapor && !isVaporComponent(type)))
    throw new VaporSuiteUnsupported(`render-function bridge: cannot render component ${String(type?.name ?? type)}`)
  const scope = childScope(ctx)
  const propsRef = shallowRef(rest)
  const slotsRef = shallowRef(descSlots(c.children))
  const rawSlots: Record<string, any> = {}
  for (const name of Object.keys(slotsRef.value)) {
    rawSlots[name] = (slotProps: any) => reactiveBlock(() => {
      const fn = slotsRef.value[name]
      return fn ? fn(slotProps) : null
    })
  }
  const inst = inOwner(ctx, scope, () => createComponent(type, { $: [() => propsRef.value] } as any, rawSlots as any))
  const m: M = { kind: 'comp', type: c.type, inst, scope, propsRef, slotsRef, ref, key: c.key }
  applyRef(ctx, inst, ref)
  return m
}

function childrenOfElement(c: Desc) {
  const ch = c.children
  if (typeof ch === 'function')
    return ch()
  if (ch && typeof ch === 'object' && !Array.isArray(ch) && !isDesc(ch) && !isSlotCall(ch) && !(ch instanceof Node))
    return ch.default?.()
  return ch
}

function patchChild(ctx: Ctx, m: M, c: Child, svg: boolean) {
  if (typeof c === 'string') {
    const t = m as Extract<M, { kind: 'text' }>
    if (t.node.data !== c)
      t.node.data = c
    return
  }
  if (isSlotCall(c)) {
    const s = m as Extract<M, { kind: 'slot' }>
    for (const key of Object.keys(s.props)) {
      if (!(key in c.props))
        delete s.props[key]
    }
    Object.assign(s.props, c.props)
    return
  }
  if ('kind' in c)
    return
  const { rest, ref } = splitProps(c.props)
  if (m.kind === 'el') {
    setDynamicProps(m.el, [rest], undefined, svg || m.type === 'svg')
    m.children = patchList(ctx, m.children, normalize(childrenOfElement(c)), m.el, null, svg || m.type === 'svg')
    if (ref !== m.ref) {
      m.ref = ref
      applyRef(ctx, m.el, ref)
    }
  }
  else if (m.kind === 'comp') {
    m.propsRef.value = rest
    m.slotsRef.value = descSlots(c.children)
  }
}

function unmountChild(m: M, parent: Node | null) {
  switch (m.kind) {
    case 'text':
      m.node.remove()
      break
    case 'el':
      for (const c of m.children) unmountChild(c, m.el)
      m.el.remove()
      if (typeof m.ref === 'function')
        m.ref(null)
      else if (isRef(m.ref))
        m.ref.value = null
      break
    case 'comp': {
      const nodes = blockNodes(m.inst)
      remove(m.inst, parent ?? nodes[0]?.parentNode ?? undefined)
      m.scope.stop()
      for (const n of nodes) (n as ChildNode).remove?.()
      break
    }
    case 'slot': {
      const nodes = blockNodes(m.block)
      m.scope.stop()
      remove(m.block, parent ?? nodes[0]?.parentNode ?? undefined)
      for (const n of nodes) (n as ChildNode).remove?.()
      break
    }
    case 'block':
      remove(m.block, parent ?? undefined)
  }
}

function entryOf(m: M): any {
  switch (m.kind) {
    case 'text': return m.node
    case 'el': return m.el
    case 'comp': return m.inst
    case 'slot': return m.block
    case 'block': return m.block
  }
}

function mountList(ctx: Ctx, children: Child[], parent: Node | null, anchor: Node | null, svg: boolean): M[] {
  const ms = children.map(c => mountChild(ctx, c, svg))
  if (parent) {
    for (const m of ms)
      insertBlock(entryOf(m), parent, anchor)
  }
  return ms
}

/** Vapor's `insert` also mounts components that are not mounted yet. */
function insertBlock(block: any, parent: Node, anchor: Node | null) {
  insert(block, parent as ParentNode, anchor)
}

function patchList(ctx: Ctx, old: M[], children: Child[], parent: Node, anchor: Node | null, svg: boolean): M[] {
  const keyed = children.some(c => isDesc(c) && c.key != null)
  const next: (M | undefined)[] = Array.from({ length: children.length })
  const used = new Set<M>()
  if (keyed) {
    const byKey = new Map<any, M>()
    for (const m of old) {
      if (m.kind === 'comp' && m.key != null)
        byKey.set(m.key, m)
    }
    children.forEach((c, i) => {
      const k = isDesc(c) ? c.key : undefined
      const m = k != null ? byKey.get(k) : old[i]
      if (m && !used.has(m) && sameType(m, c)) {
        used.add(m)
        next[i] = m
      }
    })
  }
  else {
    children.forEach((c, i) => {
      const m = old[i]
      if (m && sameType(m, c)) {
        used.add(m)
        next[i] = m
      }
    })
  }
  for (const m of old) {
    if (!used.has(m))
      unmountChild(m, parent)
  }
  const result: M[] = children.map((c, i) => {
    const m = next[i]
    if (m) {
      patchChild(ctx, m, c, svg)
      return m
    }
    return mountChild(ctx, c, svg)
  })
  // Put every child's nodes in order before `anchor`, moving only what is out of place.
  let ref: Node | null = anchor
  for (let i = result.length - 1; i >= 0; i--) {
    const m = result[i]
    const block = entryOf(m)
    if (!used.has(m)) {
      insertBlock(block, parent, ref)
    }
    else {
      const nodes = blockNodes(block)
      for (let j = nodes.length - 1; j >= 0; j--) {
        const n = nodes[j]
        if (n.parentNode !== parent || n.nextSibling !== ref)
          parent.insertBefore(n, ref)
        ref = n
      }
      continue
    }
    const nodes = blockNodes(block)
    if (nodes.length)
      ref = nodes[0]
  }
  return result
}

/**
 * A Vapor block whose content is `render()`'s descriptors, kept up to date: the
 * returned array is the block (Vapor inserts/removes it), mutated in place on
 * every re-render, with a trailing anchor comment marking its end.
 */
export function reactiveBlock(render: () => any): any[] {
  const ctx: Ctx = { owner: currentInstance, scope: getCurrentScope(), setRef: undefined }
  if (ctx.owner)
    ctx.setRef = createTemplateRefSetter()
  const anchor = document.createComment('')
  const block: any[] = []
  let initial: Child[] | undefined
  let mounted: M[] = []
  const sync = () => {
    block.length = 0
    for (const m of mounted) block.push(entryOf(m))
    block.push(anchor)
  }
  watch(
    () => {
      const children = normalize(render())
      initial ??= children
      return children
    },
    (children) => {
      const parent = anchor.parentNode
      if (!parent)
        return
      mounted = patchList(ctx, mounted, children, parent, anchor, false)
      sync()
    },
  )
  mounted = mountList(ctx, initial!, null, null, false)
  sync()
  return block
}
