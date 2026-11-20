import type { Plugin } from 'vite'
import { fileURLToPath } from 'node:url'
import { babelParse, compileTemplate, MagicString } from 'vue/compiler-sfc'

const coreSrc = fileURLToPath(new URL('../../core/src/', import.meta.url))
const suiteDir = fileURLToPath(new URL('./', import.meta.url))
const NS = '__vaporSuiteVue'
const REAL_NS = '__vaporSuiteRealVue'
const SSR_NS = '__vaporSuiteServerRenderer'
const SSR_IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*['"]vue\/server-renderer['"];?/g
const EXPORT_SSR_RENDER_RE = /export function ssrRender/
const TEST_FILE_RE = /\.test\.ts$/
const VUE_IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*['"]vue['"];?/g
const AS_RE = /\s+as\s+/g
const EXPORT_RENDER_RE = /export function render/

/**
 * Reka's tests declare small inline components as
 * `defineComponent({ components, setup, template: '...' })`. VTU compiles those
 * strings at runtime with the VDOM compiler. In pure Vapor there is no runtime
 * compiler, so this transform compiles every *literal* `template:` string in a
 * test file with the Vapor template compiler at build time and replaces it with
 * `render` + `__vapor: true` (a Vapor component may pair `setup()` returning
 * bindings with a `render(ctx)` function). Templates built from expressions are
 * left alone and fail loudly at mount (VaporSuiteUnsupported).
 */
export function inlineVaporTemplates(): Plugin {
  let counter = 0
  return {
    name: 'reka-ui:vapor-suite-inline-templates',
    enforce: 'pre',
    transform(code, id) {
      if (!id.startsWith(coreSrc) || !TEST_FILE_RE.test(id) || !code.includes('template'))
        return null
      const ast = babelParse(code, { sourceType: 'module', plugins: ['typescript'] })
      const s = new MagicString(code)
      let changed = false
      const visit = (node: any) => {
        if (!node || typeof node.type !== 'string')
          return
        if (node.type === 'ObjectExpression') {
          for (const prop of node.properties) {
            if (prop.type !== 'ObjectProperty' || prop.computed)
              continue
            const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.value
            if (key !== 'template')
              continue
            const value = prop.value
            let source: string | undefined
            if (value.type === 'StringLiteral')
              source = value.value
            else if (value.type === 'TemplateLiteral' && value.expressions.length === 0)
              source = value.quasis[0].value.cooked
            if (source === undefined)
              continue
            const result = compileTemplate({ source, filename: id, id: `suite-${counter++}`, vapor: true })
            if (result.errors.length)
              this.error(`[vapor-suite] cannot compile inline template in ${id}: ${result.errors.join('; ')}`)
            const body = result.code
              .replace(VUE_IMPORT_RE, (_, names: string) =>
                `const {${names.replace(AS_RE, ': ')}} = suiteVue();`)
              .replace(EXPORT_RENDER_RE, 'function render')
            // the server build of the same template (Vapor SSR, see ssrTwins.ts)
            const server = compileTemplate({ source, filename: id, id: `suite-${counter++}`, vapor: true, ssr: true, ssrCssVars: [] })
            if (server.errors.length)
              this.error(`[vapor-suite] cannot compile inline template for SSR in ${id}: ${server.errors.join('; ')}`)
            const ssrBody = server.code
              .replace(SSR_IMPORT_RE, (_, names: string) =>
                `const {${names.replace(AS_RE, ': ')}} = ${SSR_NS};`)
              .replace(VUE_IMPORT_RE, (_, names: string) =>
                `const {${names.replace(AS_RE, ': ')}} = ${REAL_NS};`)
              .replace(EXPORT_SSR_RENDER_RE, 'function ssrRender')
            s.overwrite(prop.start, prop.end, `__vapor: true, render: (() => {\n${body}\nreturn render\n})(), __ssrRender: (() => {\n${ssrBody}\nreturn ssrRender\n})()`)
            changed = true
          }
        }
        for (const k of Object.keys(node)) {
          if (k === 'loc' || k === 'start' || k === 'end')
            continue
          const child = node[k]
          if (Array.isArray(child))
            child.forEach(visit)
          else if (child && typeof child === 'object')
            visit(child)
        }
      }
      visit(ast.program)
      if (!changed)
        return null
      s.prepend(`import { suiteVue } from '${suiteDir}vueSuiteProxy.ts'\nimport * as ${REAL_NS} from '${suiteDir}vue-real.ts'\nimport * as ${SSR_NS} from '${suiteDir}server-renderer.ts'\n`)
      return { code: s.toString(), map: s.generateMap({ hires: true }) }
    },
  }
}
