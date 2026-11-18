import { camelize, normalizeClass, normalizeStyle } from 'vue'

const HYPHENATE_RE = /\B([A-Z])/g
const hyphenate = (str: string) => str.replace(HYPHENATE_RE, '-$1').toLowerCase()

type Attrs = Record<string, unknown>

interface AppliedState {
  /** Attribute / DOM property names the child rendered itself; the child wins for those. */
  childOwned: Set<string>
  /** Own attribute values replaced in `override` mode, restored on removal. */
  originals: Map<string, string>
  classes: Set<string>
  styles: Set<string>
  attrs: Set<string>
  props: Set<string>
  listeners: Map<string, { invoker: EventListener, value: unknown, options: AddEventListenerOptions }>
}

// State per (applier, element): nested as-child layers (e.g. CollectionItem >
// RovingFocusItem > TabsTrigger) all apply to the same element and must not
// undo each other's attrs.
const defaultStates = new WeakMap<Element, AppliedState>()

const WHITESPACE_RE = /\s+/
const EVENT_OPTION_RE = /(?:Once|Passive|Capture)$/

function parseEventName(key: string): [string, AddEventListenerOptions] {
  let name = key.slice(2)
  const options: AddEventListenerOptions = {}
  let match: RegExpMatchArray | null
  // eslint-disable-next-line no-cond-assign
  while ((match = name.match(EVENT_OPTION_RE))) {
    name = name.slice(0, name.length - match[0].length)
    ;(options as Record<string, boolean>)[match[0].toLowerCase()] = true
  }
  return [name[0] === ':' ? name.slice(1) : hyphenate(name), options]
}

function isListenerKey(key: string) {
  return key.length > 2 && key.startsWith('on') && key.charCodeAt(2) > 64 && key.charCodeAt(2) < 91
}

function callHandlers(value: unknown, event: Event) {
  if (Array.isArray(value))
    value.forEach(fn => typeof fn === 'function' && fn(event))
  else if (typeof value === 'function')
    value(event)
}

function shouldSetAsProp(el: Element, key: string, value: unknown) {
  // Same spirit as runtime-dom's `shouldSetAsProp`: boolean-ish DOM properties
  // (`disabled`, `checked`, `hidden`, …) and `value` are set as properties.
  if (key === 'value' && 'value' in el)
    return true
  return key in el && typeof (el as any)[key] === 'boolean' && (typeof value === 'boolean' || value === '' || value == null)
}

/**
 * Vapor counterpart of reka-ui's VDOM `Slot` merge: apply a `Primitive`'s
 * attrs to the element its `as-child` slot rendered.
 *
 * Mirrors `mergeProps(attrs, child.props)` semantics: classes and styles are
 * merged, listeners are chained, and for any other attribute the child's own
 * value wins. Re-running it diffs against what it applied last time.
 *
 * Limitation: pure Vapor has no public API to inherit fallthrough attrs on a
 * slot's root, so this works on the DOM element; a child that rewrites its own
 * `class` attribute wholesale can drop the merged classes until the next run.
 */
export function applyAsChildAttrs(el: Element, attrs: Attrs, states: WeakMap<Element, AppliedState> = defaultStates, override = false) {
  let state = states.get(el)
  if (!state) {
    const own = Array.from(el.attributes, attr => attr.name).filter(name => name !== 'class' && name !== 'style')
    state = {
      childOwned: new Set(override ? [] : own),
      originals: new Map(override ? own.map(name => [name, el.getAttribute(name)!]) : []),
      classes: new Set(),
      styles: new Set(),
      attrs: new Set(),
      props: new Set(),
      listeners: new Map(),
    }
    states.set(el, state)
  }

  const nextClasses = new Set(normalizeClass(attrs.class).split(WHITESPACE_RE).filter(Boolean))
  for (const token of state.classes) {
    if (!nextClasses.has(token))
      el.classList.remove(token)
  }
  for (const token of nextClasses) {
    if (!state.classes.has(token))
      el.classList.add(token)
  }
  state.classes = nextClasses

  const style = (el as HTMLElement).style
  const nextStyle = (normalizeStyle(attrs.style) ?? {}) as Record<string, string | number>
  const styleObject = typeof nextStyle === 'string' ? parseStyleString(nextStyle) : nextStyle
  const nextStyles = new Set<string>()
  for (const key in styleObject) {
    const prop = key.startsWith('--') ? key : hyphenate(key)
    nextStyles.add(prop)
    style?.setProperty(prop, styleObject[key] == null ? '' : String(styleObject[key]))
  }
  for (const prop of state.styles) {
    if (!nextStyles.has(prop))
      style?.removeProperty(prop)
  }
  state.styles = nextStyles

  const seenListeners = new Set<string>()
  const seenAttrs = new Set<string>()
  const seenProps = new Set<string>()
  for (const key in attrs) {
    if (key === 'class' || key === 'style' || key === 'ref' || key === 'key')
      continue
    const value = attrs[key]
    if (isListenerKey(key)) {
      seenListeners.add(key)
      const existing = state.listeners.get(key)
      if (existing) {
        existing.value = value
        continue
      }
      const [name, options] = parseEventName(key)
      const entry = { value, options, invoker: ((event: Event) => callHandlers(entry.value, event)) as EventListener }
      el.addEventListener(name, entry.invoker, options)
      state.listeners.set(key, entry)
      continue
    }
    const name = key.startsWith('aria') || key.startsWith('data') ? hyphenate(key) : key
    if (state.childOwned.has(name) || state.childOwned.has(name.toLowerCase()))
      continue
    if (shouldSetAsProp(el, camelize(name), value)) {
      seenProps.add(name)
      ;(el as any)[camelize(name)] = name === 'value' ? (value ?? '') : (value === '' ? true : !!value)
      continue
    }
    seenAttrs.add(name)
    if (value == null)
      el.removeAttribute(name)
    else
      el.setAttribute(name, String(value))
  }

  for (const [key, entry] of state.listeners) {
    if (!seenListeners.has(key)) {
      const [name] = parseEventName(key)
      el.removeEventListener(name, entry.invoker, entry.options)
      state.listeners.delete(key)
    }
  }
  for (const name of state.attrs) {
    if (seenAttrs.has(name))
      continue
    const original = state.originals.get(name)
    if (original == null)
      el.removeAttribute(name)
    else
      el.setAttribute(name, original)
  }
  for (const name of state.props) {
    if (!seenProps.has(name))
      (el as any)[camelize(name)] = name === 'value' ? '' : false
  }
  state.attrs = seenAttrs
  state.props = seenProps
}

/**
 * An `applyAsChildAttrs` bound to its own state, for one `Primitive` / `Presence`.
 *
 * @param options - Applier options.
 * @param options.override - Let the applied attrs win over the element's own
 * attributes (restored when the attr goes away). `Presence` uses this: in the
 * VDOM build its attrs reach the content through component fallthrough, where
 * the consumer's attrs win.
 */
export function createAsChildApplier(options: { override?: boolean } = {}) {
  const states = new WeakMap<Element, AppliedState>()
  return (el: Element, attrs: Attrs) => applyAsChildAttrs(el, attrs, states, options.override)
}

function parseStyleString(css: string) {
  const result: Record<string, string> = {}
  for (const decl of css.split(';')) {
    const index = decl.indexOf(':')
    if (index > 0)
      result[decl.slice(0, index).trim()] = decl.slice(index + 1).trim()
  }
  return result
}

/**
 * The element `as-child` attrs belong on.
 *
 * In the VDOM build attrs reach a child *component*, and `PopperContent`
 * (`inheritAttrs: false`) moves them from its positioning wrapper to the
 * content element inside. Vapor only sees the DOM, so mirror that here.
 */
export function resolveAsChildTarget(el: HTMLElement): HTMLElement {
  return el.hasAttribute('data-reka-popper-content-wrapper') && el.firstElementChild
    ? el.firstElementChild as HTMLElement
    : el
}
