/**
 * VTU `global.stubs` for pure Vapor (ADR-S12).
 *
 * VTU stubs a component by intercepting VNode creation. Vapor has no VNodes: a
 * compiled template calls `createComponent(Comp, ...)`,
 * `createDynamicComponent(() => Comp, ...)` or, for names resolved at runtime,
 * `createComponentWithFallback(resolveComponent('Name'), ...)`. The suite
 * transform (`stubbableComponents`) re-points those three calls in every SFC it
 * compiles to the wrappers below, and runtime `template:` strings get them too
 * (runtimeTemplate.ts). Each wrapper swaps the component for the stub registered
 * on the current app, matched like VTU does: by registered name or `__name`, in
 * PascalCase or kebab-case; `teleport` matches the built-in Teleport.
 *
 * Stubs are per app (`app._context`), so wrappers mounted side by side do not
 * see each other's stubs. A stub given as `true` renders `<name-stub>` with the
 * default slot, like VTU's `renderStubDefaultSlot`.
 */
import {
  createComponent,
  createComponentWithFallback,
  createDynamicComponent,
  currentInstance,
  Teleport,
  VaporTeleport,
} from 'vue'
import { toVaporComponent } from './vaporH'

export const STUBS = Symbol('vapor-suite-stubs')
const TRANSITION_STUB_RE = /^transition(?:-group)?$|^TransitionGroup$/i

function hyphenate(s: string) {
  return s.replace(/\B([A-Z])/g, '-$1').toLowerCase()
}

/** Normalises `global.stubs` (array or record) into kebab-case name → stub, minus VTU's default transition stubs. */
export function normalizeStubs(stubs: Record<string, any> | string[] | undefined): Map<string, any> | undefined {
  if (!stubs)
    return undefined
  const entries: [string, any][] = Array.isArray(stubs) ? stubs.map(n => [n, true]) : Object.entries(stubs)
  const map = new Map<string, any>()
  for (const [name, value] of entries) {
    if (TRANSITION_STUB_RE.test(name) || value === false)
      continue
    map.set(hyphenate(name), value)
  }
  return map.size ? map : undefined
}

const placeholders = new Map<string, any>()
function placeholder(name: string) {
  let stub = placeholders.get(name)
  if (!stub) {
    stub = toVaporComponent({ name: `${name}-stub`, inheritAttrs: true, template: `<${name}-stub><slot /></${name}-stub>` })
    placeholders.set(name, stub)
  }
  return stub
}

function nameOf(comp: any): string | undefined {
  if (typeof comp === 'string')
    return comp
  if (comp === VaporTeleport || comp === Teleport)
    return 'teleport'
  return comp?.name ?? comp?.__name
}

/** The stub for `comp` on the current app, or `comp` itself. */
export function stubbed(comp: any): any {
  const stubs: Map<string, any> | undefined = (currentInstance as any)?.appContext?.[STUBS]
  if (!stubs || !comp)
    return comp
  const name = nameOf(comp)
  if (!name)
    return comp
  const key = hyphenate(name)
  if (!stubs.has(key))
    return comp
  const stub = stubs.get(key)
  return stub === true ? placeholder(key) : toVaporComponent(stub)
}

export const stubbableCreateComponent: typeof createComponent = ((comp: any, ...rest: any[]) =>
  (createComponent as any)(stubbed(comp), ...rest)) as any
export const stubbableCreateComponentWithFallback: typeof createComponentWithFallback = ((comp: any, ...rest: any[]) =>
  (createComponentWithFallback as any)(stubbed(comp), ...rest)) as any
export const stubbableCreateDynamicComponent: typeof createDynamicComponent = ((getter: any, ...rest: any[]) =>
  (createDynamicComponent as any)(() => stubbed(getter()), ...rest)) as any
