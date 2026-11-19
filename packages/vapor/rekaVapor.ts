import type { Plugin } from 'vite'
import { fileURLToPath } from 'node:url'

const rekaSrc = fileURLToPath(new URL('../core/src', import.meta.url))

/**
 * Swap reka-ui's VDOM-only render-function components for their Vapor SFC
 * counterparts when reka-ui source is compiled in Vapor mode.
 *
 * Only these modules use vnode APIs (`h`, `cloneVNode`, slot vnode
 * inspection); every other reka-ui SFC compiles to Vapor unchanged.
 * A `reka-ui/vapor` build would use the same mapping.
 */
export const SWAPS: Record<string, string> = {
  [`${rekaSrc}/Primitive/Primitive.ts`]: `export { default as Primitive } from '${rekaSrc}/Primitive/Primitive.vapor.vue'\n`,
  [`${rekaSrc}/Primitive/Slot.ts`]: `export { default as Slot } from '${rekaSrc}/Primitive/Slot.vapor.vue'\n`,
  [`${rekaSrc}/Presence/Presence.ts`]: `export { default } from '${rekaSrc}/Presence/Presence.vapor.vue'\n`,
  [`${rekaSrc}/Collection/Collection.ts`]: `export { useCollection } from '${rekaSrc}/Collection/Collection.vapor.ts'\n`,
}

/** File names (without extension) that may resolve to a swapped module. */
const SWAP_NAMES = ['Primitive', 'Slot', 'Presence', 'Collection']

const PREFIX = '\0reka-vapor-swap:'

/**
 * VueUse (v14 and v15) reads `getCurrentInstance()`, which is `null` in Vapor
 * components: `useMounted`/`useSupported` never turn true and
 * `tryOnMounted`/`tryOnBeforeMount` never run. Until VueUse is Vapor-aware,
 * the Vapor build hands VueUse a `vue` whose `getCurrentInstance` also returns
 * the Vapor instance (only lifecycle registration and `emit` are used on it).
 */
const VUEUSE_VUE = '\0reka-vapor-vueuse-vue'
const VUEUSE_RE = /[\\/]@vueuse[\\/]/
const VUEUSE_VUE_CODE = `export * from 'vue'
import { currentInstance, getCurrentInstance as vdomGetCurrentInstance } from 'vue'
const proxyCache = new WeakMap()
function findEl(block) {
  if (!block) return undefined
  if (typeof Element !== 'undefined' && block instanceof Element) return block
  if (Array.isArray(block)) {
    for (const b of block) {
      const el = findEl(b)
      if (el) return el
    }
    return undefined
  }
  if (typeof block === 'object') {
    if (block.vapor) return findEl(block.block)
    if ('nodes' in block) return findEl(block.nodes)
  }
  return undefined
}
export function getCurrentInstance() {
  if (currentInstance && currentInstance.vapor) {
    if (!('proxy' in currentInstance)) {
      Object.defineProperty(currentInstance, 'proxy', {
        configurable: true,
        get() {
          const inst = this
          let p = proxyCache.get(inst)
          if (!p) {
            p = inst.exposed || {
              get $el() {
                return inst.exposed?.$el ?? findEl(inst.block)
              }
            }
            proxyCache.set(inst, p)
          }
          return p
        }
      })
    }
    return currentInstance
  }
  return vdomGetCurrentInstance()
}
`

/**
 * `defineAsyncComponent` returns a VDOM wrapper; Vapor has its own
 * `defineVaporAsyncComponent` with the same options. reka-ui lazy-loads the
 * Popover/Tooltip/HoverCard content implementations this way.
 */
const ASYNC_IMPORT_RE = /import\s*\{\s*defineAsyncComponent\s*\}\s*from\s*['"]vue['"]/g
const ASYNC_IMPORT_VAPOR = `import { defineVaporAsyncComponent as defineAsyncComponent } from 'vue'`

/**
 * A Vapor component ref exposes only `defineExpose` values, while reka-ui reads
 * `$el` from component refs (`resolveElement`, `useForwardExpose`). Every
 * reka-ui SFC gets an `exposeRootElement()` call at the end of its setup.
 */
const SCRIPT_SETUP_RE = /(<script[^>]*\ssetup\b[^>]*>)([\s\S]*?)(<\/script>)/
export function injectExposeRoot(code: string) {
  return code.replace(SCRIPT_SETUP_RE, (_, open, body, close) =>
    `${open}${body}\nimport { exposeRootElement as __rekaExposeRoot } from '${rekaSrc}/shared/instance'\n__rekaExposeRoot()\n${close}`)
}

/** The source rewrites every reka-ui SFC gets in the Vapor client build. */
export function transformRekaSfc(code: string) {
  let out = injectExposeRoot(code)
  if (out.includes('defineAsyncComponent'))
    out = out.replace(ASYNC_IMPORT_RE, ASYNC_IMPORT_VAPOR)
  return out
}

export function rekaVaporSwap(): Plugin {
  return {
    name: 'reka-ui:vapor-swap',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if ((source === 'vue' || source.endsWith('/vue.runtime.esm-bundler.js')) && importer && VUEUSE_RE.test(importer))
        return VUEUSE_VUE
      if (source.startsWith(PREFIX) || !importer || importer.startsWith(PREFIX) || importer === VUEUSE_VUE)
        return null
      if (!SWAP_NAMES.some(name => source.includes(name)))
        return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      if (resolved && SWAPS[resolved.id])
        return PREFIX + resolved.id
      return null
    },
    transform(code, id) {
      if (!id.startsWith(rekaSrc) || !id.endsWith('.vue'))
        return null
      // `useForwardExpose()` and the `*.vapor.vue` twins define `$el` themselves.
      let out = code.includes('useForwardExpose(') || id.endsWith('.vapor.vue') ? code : injectExposeRoot(code)
      if (out.includes('defineAsyncComponent'))
        out = out.replace(ASYNC_IMPORT_RE, ASYNC_IMPORT_VAPOR)
      return out
      return transformRekaSfc(code)
    },
    load(id) {
      if (id === VUEUSE_VUE)
        return VUEUSE_VUE_CODE
      if (id.startsWith(PREFIX))
        return SWAPS[id.slice(PREFIX.length)]
      return null
    },
  }
}

/**
 * Compile `<script setup vapor>` SFCs (test fixtures and benchmark app) as
 * regular VDOM components, for the VDOM baseline runs.
 */
const SCRIPT_VAPOR_RE = /<script([^>]*)\svapor\b([^>]*)>/
export function stripVapor(): Plugin {
  const dirs = ['./src/', './bench/src/'].map(dir => fileURLToPath(new URL(dir, import.meta.url)))
  return {
    name: 'reka-ui:strip-vapor',
    enforce: 'pre',
    transform(code, id) {
      if (!dirs.some(dir => id.startsWith(dir)) || !id.endsWith('.vue'))
        return null
      return code.replace(SCRIPT_VAPOR_RE, '<script$1$2>')
    },
  }
}
