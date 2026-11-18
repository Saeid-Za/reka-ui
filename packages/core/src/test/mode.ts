import { readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { expect } from 'vitest'

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
export function normalizeMarkup(html: string, options: { ignoreFormatting?: boolean } = {}): string {
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
        // A comment node inside <style> serialises as raw text (a Vapor slot
        // anchor ends up there); CSS ignores it, so does the comparison.
        if (element.tagName === 'STYLE')
          element.textContent = element.textContent!.replace(/<\s*!--[\s\S]*?-->/g, '')
        visit(element)
      }
    }
  }
  visit(template.content)
  template.content.normalize()
  if (options.ignoreFormatting) {
    // Pretty-printed markup (VTU's `html()`, DOM snapshots) indents text.
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT)
    const texts: Text[] = []
    while (walker.nextNode())
      texts.push(walker.currentNode as Text)
    for (const text of texts) {
      const value = text.data.replace(/\s+/g, ' ').trim()
      if (value)
        text.data = value
      else
        text.remove()
    }
  }
  return template.innerHTML
}

/**
 * `html` as a VDOM test compares it: unchanged under VDOM, `normalizeMarkup(html)`
 * under Vapor (anchor comments, attribute order and indentation taken out: the
 * whitespace VTU's pretty-printer puts around Vapor's anchors).
 */
export function modeMarkup(html: string): string {
  return isVapor ? normalizeMarkup(html, { ignoreFormatting: true }) : html
}

const QUOTED_RE = /^"([\s\S]*)"$/
const snapshotCounts = new Map<string, number>()
const snapshotFiles = new Map<string, Record<string, string>>()

function storedSnapshot(testPath: string, name: string): string | undefined {
  const file = join(dirname(testPath), '__snapshots__', `${basename(testPath)}.snap`)
  let entries = snapshotFiles.get(file)
  if (!entries) {
    entries = {}
    try {
      // A .snap file is a CommonJS module assigning `exports[name] = \`...\``.
      // eslint-disable-next-line no-new-func
      new Function('exports', readFileSync(file, 'utf8'))(entries)
    }
    catch {}
    snapshotFiles.set(file, entries)
  }
  return entries[name]
}

/**
 * `expect(markup).toMatchSnapshot()` that also holds under Vapor.
 *
 * VDOM: exactly `toMatchSnapshot()`. Vapor: the stored (VDOM) snapshot stays the
 * reference and is never rewritten; the Vapor markup must equal it once both
 * are passed through `normalizeMarkup(..., { ignoreFormatting: true })`, so only
 * anchor comments, attribute order, style spelling and indentation may differ.
 * Use it for every snapshot of a test, so the snapshot counter stays in step.
 */
export function expectMarkupSnapshot(received: string | Element) {
  if (!isVapor) {
    expect(received).toMatchSnapshot()
    return
  }
  const { testPath, currentTestName } = expect.getState()
  const count = (snapshotCounts.get(`${testPath}:${currentTestName}`) ?? 0) + 1
  snapshotCounts.set(`${testPath}:${currentTestName}`, count)
  const name = `${currentTestName} ${count}`
  const stored = storedSnapshot(testPath!, name)
  if (stored === undefined)
    throw new Error(`No stored VDOM snapshot \`${name}\` to compare the Vapor markup with`)
  // String snapshots are stored quoted; DOM-element snapshots are not.
  const reference = stored.trim().replace(QUOTED_RE, '$1')
  const markup = typeof received === 'string' ? received : received.outerHTML
  expect(normalizeMarkup(markup, { ignoreFormatting: true })).toBe(normalizeMarkup(reference, { ignoreFormatting: true }))
}
