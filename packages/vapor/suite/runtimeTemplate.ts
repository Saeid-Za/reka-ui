import * as vue from 'vue'
import { compileTemplate } from 'vue/compiler-sfc'

const VUE_IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*['"]vue['"];?/g
const AS_RE = /\s+as\s+/g
const EXPORT_RENDER_RE = /export function render/
const cache = new Map<string, any>()
let counter = 0

/**
 * VTU compiles `template:` strings at runtime with the VDOM compiler. This is
 * the Vapor equivalent for templates the build-time transform could not see
 * (strings built at runtime): compile with the Vapor template compiler and
 * evaluate the module against the test's `vue`.
 */
export function compileRuntimeTemplate(source: string) {
  const cached = cache.get(source)
  if (cached)
    return cached
  const result = compileTemplate({ source, filename: 'runtime-template.vue', id: `rt-${counter++}`, vapor: true })
  if (result.errors.length)
    throw new Error(`[vapor-suite] cannot compile runtime template: ${result.errors.join('; ')}`)
  const body = result.code
    .replace(VUE_IMPORT_RE, (_, names: string) => `const {${names.replace(AS_RE, ': ')}} = __vue;`)
    .replace(EXPORT_RENDER_RE, 'function render')
  // eslint-disable-next-line no-new-func
  const render = new Function('__vue', `${body}\nreturn render`)(vue)
  cache.set(source, render)
  return render
}
