import type { Plugin } from 'vite'

// See stubs.ts (ADR-S12).
const STUBS_MODULE = new URL('./stubs.ts', import.meta.url).pathname
const CREATE_RE = /\b(createComponent|createComponentWithFallback|createDynamicComponent) as (_\w+)/g

/**
 * Post-transform for compiled Vapor SFCs (and templates compiled into test files): route `createComponent`,
 * `createComponentWithFallback` and `createDynamicComponent` through `stubbed()`.
 */
export function stubbableComponents(): Plugin {
  return {
    name: 'reka-ui:vapor-suite-stubs',
    enforce: 'post',
    transform(code, id) {
      const file = id.split('?')[0]
      if (!(file.endsWith('.vue') || file.endsWith('.test.ts')) || id.includes('type=style'))
        return null
      const locals: [string, string][] = []
      const out = code.replace(CREATE_RE, (_, name: string, local: string) => {
        locals.push([name, local])
        return `${name} as __vaporSuiteReal${local}`
      })
      if (!locals.length)
        return null
      const wrapperOf = (name: string) => `stubbable${name[0].toUpperCase()}${name.slice(1)}`
      const imports = `import { ${locals.map(([name, local]) => `${wrapperOf(name)} as ${local}`).join(', ')} } from ${JSON.stringify(STUBS_MODULE)};\n`
      return { code: imports + out, map: null }
    },
  }
}
