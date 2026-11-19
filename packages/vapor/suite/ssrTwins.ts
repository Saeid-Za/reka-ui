import type { Plugin } from 'vite'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { transformWithOxc } from 'vite'
import { compileScript, parse } from 'vue/compiler-sfc'

/**
 * Vapor SSR, the way Vue 3.6 defines it: the *same* Vapor SFC is compiled once for
 * the client (`compileScript({ vapor: true })`, Vapor render) and once for the
 * server (`compileScript({ vapor: true, templateOptions: { ssr: true } })`, an
 * `ssrRender` marked `__vapor: true`), rendered by `@vue/server-renderer`, then
 * hydrated on the client with `createVaporSSRApp` (see vuejs/core
 * packages/runtime-vapor/__tests__/hydration/_helpers.ts, `testHydration`).
 *
 * A jsdom test file only gets the client build of Reka. This plugin serves a second,
 * server-compiled copy of Reka's source graph under the virtual prefix
 * `\0vssr:` (`import('vssr:/abs/path/Foo.vue')`): every module of
 * `packages/core/src` imported from a server module is served server-compiled as
 * well, and everything outside (vue, @vueuse, …) is shared. The harness's
 * `renderToString` maps each client component to its server twin by `__file`.
 *
 * Server modules get the client's source rewrites except one: `defineAsyncComponent`
 * stays the runtime-core one on the server. Vue's own Vapor hydration tests render an
 * async component with `defineAsyncComponent` on the server and hydrate it with
 * `defineVaporAsyncComponent` (runtime-vapor/__tests__/hydration/asyncComponent.spec.ts).
 */
const coreSrc = fileURLToPath(new URL('../../core/src/', import.meta.url))

/**
 * Composables that must not get a `\0vssr:` server twin even if they import an SFC.
 * They stay shared with the client graph so `vi.mock()` in SSR tests applies to both
 * renders (Dialog.ssr S1: `@/shared/useBodyScrollLock` must match the test mock).
 */
const NO_SSR_TWIN_TS = new Set([
  `${coreSrc}shared/useBodyScrollLock.ts`,
])
const PREFIX = '\0vssr:'
const PUBLIC = 'vssr:'
const SWAP_PREFIX = '\0reka-vapor-swap:'
// Served ids end in `.js` so no other plugin (plugin-vue, oxc) claims them.
const SUFFIX = '.vssr.js'
const VUE_RE = /\.vue$/
const IMPORT_RE = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g
const TS_RE = /\.[cm]?tsx?$/

export const ssrTwinId = (file: string) => PUBLIC + file

function realPath(id: string) {
  return id.slice(PREFIX.length, -SUFFIX.length)
}

export function vaporSsrTwins(transformSfc: (code: string) => string, swaps: Record<string, string>): Plugin {
  // Whether a `.ts` module of Reka reaches an SFC through its imports (barrels, swaps).
  // Only those need a server copy: a plain composable compiles the same for the server
  // and the client, so it is shared, as it is in Reka's VDOM SSR tests. That keeps its
  // module state and the test file's `vi.mock()`s the same for both renders.
  const reachesSfc = new Map<string, boolean>()
  async function needsTwin(ctx: any, file: string, stack = new Set<string>()): Promise<boolean> {
    if (NO_SSR_TWIN_TS.has(file))
      return false
    if (VUE_RE.test(file) || swaps[file])
      return true
    const known = reachesSfc.get(file)
    if (known !== undefined)
      return known
    if (stack.has(file)) // an import cycle: decided by the module that started it
      return false
    stack.add(file)
    let result = false
    const code = await readFile(file, 'utf8')
    for (const match of code.matchAll(IMPORT_RE)) {
      const resolved = await ctx.resolve(match[1] ?? match[2], file, { skipSelf: true })
      if (!resolved || resolved.external)
        continue
      const id = resolved.id.startsWith(SWAP_PREFIX) ? resolved.id.slice(SWAP_PREFIX.length) : resolved.id
      if (id.startsWith(coreSrc) && !id.includes('?') && (VUE_RE.test(id) || TS_RE.test(id)) && await needsTwin(ctx, id, stack)) {
        result = true
        break
      }
    }
    stack.delete(file)
    // a result reached through a cycle may be incomplete: only cache from the top
    if (result || stack.size === 0)
      reachesSfc.set(file, result)
    return result
  }

  return {
    name: 'reka-ui:vapor-suite-ssr-twins',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (source.startsWith(PUBLIC)) {
        // `vssr:/abs/file.vue`, or `vssr:@/index.ts` through the aliases
        let file = source.slice(PUBLIC.length)
        if (!file.startsWith('/'))
          file = (await this.resolve(file, importer, { skipSelf: true }))?.id ?? file
        return PREFIX + file + SUFFIX
      }
      if (!importer?.startsWith(PREFIX))
        return null
      const resolved = await this.resolve(source, realPath(importer), { ...options, skipSelf: true })
      if (!resolved || resolved.external)
        return resolved
      // Reka's own modules (also the Vapor swaps, which resolve to `\0reka-vapor-swap:`
      // ids) are served server-compiled; their swap target is a `.vue` file under core.
      const id = resolved.id.startsWith(SWAP_PREFIX) ? resolved.id.slice(SWAP_PREFIX.length) : resolved.id
      if (id.startsWith(coreSrc) && !id.includes('?') && (VUE_RE.test(id) || TS_RE.test(id)) && await needsTwin(this, id))
        return PREFIX + id + SUFFIX
      return resolved
    },
    async load(id) {
      if (!id.startsWith(PREFIX))
        return null
      const file = realPath(id)
      // a swapped module (Primitive.ts → Primitive.vapor.vue, …) is served as its
      // Vapor replacement, exactly as on the client
      if (swaps[file])
        return swaps[file]
      let code = await readFile(file, 'utf8')
      if (VUE_RE.test(file)) {
        code = transformSfc(code)
        const { descriptor, errors } = parse(code, { filename: file })
        if (errors.length)
          this.error(`[vapor-suite] cannot parse ${file}: ${errors.join('; ')}`)
        const scopeId = createHash('sha256').update(file).digest('hex').slice(0, 8)
        const script = compileScript(descriptor, {
          id: scopeId,
          isProd: false,
          inlineTemplate: true,
          genDefaultAs: '__sfc__',
          vapor: true,
          templateOptions: { ssr: true, ssrCssVars: descriptor.cssVars },
        })
        code = `${script.content}\n__sfc__.__file = ${JSON.stringify(file)}\nexport default __sfc__\n`
        const lang = descriptor.scriptSetup?.lang || descriptor.script?.lang
        if (lang === 'ts' || lang === 'tsx')
          code = (await transformWithOxc(code, `${file}.ts`, { lang: 'ts' })).code
        return code
      }
      return (await transformWithOxc(code, file, { lang: 'ts' })).code
    },
  }
}
