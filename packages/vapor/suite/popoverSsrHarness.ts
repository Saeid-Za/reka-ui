import type { Plugin } from 'vite'
import { fileURLToPath } from 'node:url'

const coreSrc = fileURLToPath(new URL('../../core/src/', import.meta.url))
const OPEN_REF_RE = /open = ref\(true\)/
const CONTENT_DEFINE_RE = /const Content = defineComponent\(\{\s*\n\s*setup\(\) \{\s*\n\s*onMounted\(onContentMounted\)/
const FIXTURE_DEFINE_RE = /return defineComponent\(\{\s*\n\s*components: \{ ProbeContent: Content, PopoverContent, PopoverRoot, PopoverTrigger \},/

/**
 * Vapor SSR tests compile inline `template:` fixtures against `suiteVue()`. After
 * `vi.resetModules()`, Vitest reloads `vue` while those renders keep the first
 * runtime, which blows the stack on hydrate (S2 / 9.4). The VDOM suite still needs
 * `resetModules` so `vi.doMock` reaches a fresh `import('.')`; in pure Vapor the
 * singleton proxy plus `suiteVue()` fixtures make that reload unnecessary.
 */
export function popoverSsrHarness(): Plugin {
  return {
    name: 'reka-ui:vapor-suite-popover-ssr',
    enforce: 'pre',
    transform(code, id) {
      if (!id.startsWith(coreSrc) || !id.endsWith('Popover/Popover.ssr.test.ts'))
        return null

      let next = code
      if (!next.includes('vi.resetModules()'))
        return null

      next = next.replace(OPEN_REF_RE, 'open = suiteVue().ref(true)')
      next = next.replace(
        CONTENT_DEFINE_RE,
        'const Content = suiteVue().defineComponent({\n      setup() {\n        suiteVue().onMounted(onContentMounted)',
      )
      next = next.replace(
        FIXTURE_DEFINE_RE,
        'return suiteVue().defineComponent({\n      components: { ProbeContent: Content, PopoverContent, PopoverRoot, PopoverTrigger },',
      )
      next = next.replace('vi.resetModules()', 'if (!isVapor) vi.resetModules()')

      return next === code ? null : { code: next, map: null }
    },
  }
}
