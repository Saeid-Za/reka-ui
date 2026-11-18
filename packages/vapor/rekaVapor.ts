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
const SWAPS: Record<string, string> = {
  [`${rekaSrc}/Primitive/Primitive.ts`]: `export { default as Primitive } from '${rekaSrc}/Primitive/Primitive.vapor.vue'\n`,
  [`${rekaSrc}/Presence/Presence.ts`]: `export { default } from '${rekaSrc}/Presence/Presence.vapor.vue'\n`,
}

const PREFIX = '\0reka-vapor-swap:'

export function rekaVaporSwap(): Plugin {
  return {
    name: 'reka-ui:vapor-swap',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (source.startsWith(PREFIX) || !importer || importer.startsWith(PREFIX))
        return null
      if (!source.includes('Primitive') && !source.includes('Presence'))
        return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      if (resolved && SWAPS[resolved.id])
        return PREFIX + resolved.id
      return null
    },
    load(id) {
      if (id.startsWith(PREFIX))
        return SWAPS[id.slice(PREFIX.length)]
      return null
    },
  }
}
