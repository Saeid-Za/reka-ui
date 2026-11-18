// @vitest-environment node
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { describe, expect, it } from 'vitest'

// `reka-ui/vapor` works purely through a side effect (registering the Vapor
// instance resolver). This builds a consumer against the *published* dist
// output and checks the package's `sideEffects` list keeps that registration.
const coreDist = fileURLToPath(new URL('../../core/dist', import.meta.url))
// Vue 3.6 from this package; core/dist would otherwise resolve the monorepo's 3.5.
const vue36 = fileURLToPath(new URL('../node_modules/vue/dist/vue.runtime.esm-bundler.js', import.meta.url))
const hasDist = existsSync(join(coreDist, 'vapor.js'))

async function buildConsumer(source: string) {
  const dir = mkdtempSync(join(tmpdir(), 'reka-vapor-consumer-'))
  try {
    const entry = join(dir, 'main.js')
    writeFileSync(entry, source)
    const output = await build({
      configFile: false,
      logLevel: 'silent',
      root: dir,
      resolve: {
        alias: [
          { find: /^reka-ui\/vapor$/, replacement: join(coreDist, 'vapor.js') },
          { find: /^reka-ui$/, replacement: join(coreDist, 'index.js') },
          { find: /^vue$/, replacement: vue36 },
        ],
      },
      build: {
        write: false,
        minify: false,
        lib: { entry, formats: ['es'], fileName: 'out' },
      },
    })
    const chunks = (Array.isArray(output) ? output : [output]).flatMap(o => 'output' in o ? o.output : [])
    return chunks.map(c => ('code' in c ? c.code : '')).join('\n')
  }
  finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe.skipIf(!hasDist)('reka-ui/vapor in a consumer production build', () => {
  it('keeps the Vapor instance resolver and useForwardExpose registrations', async () => {
    const code = await buildConsumer(`import 'reka-ui/vapor'\nimport { ComboboxRoot, useForwardExpose } from 'reka-ui'\nconsole.log(ComboboxRoot, useForwardExpose)\n`)
    expect(code).toContain('setVaporInstanceResolver(() => currentInstance)')
    // Bundlers drop the registration when nothing calls useForwardExpose, so
    // the consumer imports it.
    expect(code).toMatch(/setVaporForwardExpose\(useVaporForwardExpose\)/)
    expect(code).toContain('new Proxy(ret')
  }, 60_000)

  it('leaves the Vapor half of useForwardExpose out without reka-ui/vapor', async () => {
    const code = await buildConsumer(`import { useForwardExpose } from 'reka-ui'\nconsole.log(useForwardExpose)\n`)
    expect(code).toContain('function useForwardExpose')
    expect(code).not.toContain('useVaporForwardExpose')
    expect(code).not.toContain('new Proxy(ret')
  }, 60_000)
})
