/**
 * Which render mode the current test run uses.
 *
 * `false` in Reka's normal (VDOM) run. The pure-Vapor full-suite run
 * (`packages/vapor`, `pnpm test:full-suite`) sets `globalThis.__REKA_VAPOR_SUITE__`
 * in its setup file, before any test file is imported.
 *
 * Use it only where VDOM and Vapor *legitimately* differ: a test either gets a Vapor
 * variant that asserts the equivalent Vapor behaviour, or, when no Vapor equivalent
 * exists, `it.skipIf(isVapor)` with a comment giving the reason. See
 * vapor-proposal/OPEN_QUESTIONS.md, QS6.
 */
export const isVapor: boolean = !!(globalThis as { __REKA_VAPOR_SUITE__?: boolean }).__REKA_VAPOR_SUITE__

/**
 * Markup with what differs between render modes, but not in meaning, taken out: comment
 * nodes (VDOM's `<!--[-->` fragment markers and `<!--v-if-->`, Vapor's anchors), the
 * order of attributes, and how a `style` attribute is spelled. Use it to compare a
 * Vapor render with the markup a VDOM test expects.
 */
export function normalizeMarkup(html: string): string {
  const template = document.createElement('template')
  template.innerHTML = html
  const visit = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.COMMENT_NODE) {
        child.remove()
        continue
      }
      if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as HTMLElement
        const attributes = Array.from(element.attributes, ({ name, value }) =>
          [name, name === 'style' ? element.style.cssText : value] as const)
          .sort(([a], [b]) => a.localeCompare(b))
        for (const [name] of attributes)
          element.removeAttribute(name)
        for (const [name, value] of attributes)
          element.setAttribute(name, value)
        visit(element)
      }
    }
  }
  visit(template.content)
  template.content.normalize()
  return template.innerHTML
}
