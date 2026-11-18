// Runs the family suite in all four modes and writes a per-component table.
// Usage: node scripts/coverage.mjs [out.md]
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const runs = [
  { mode: 'vdom', config: 'vitest.vdom.config.ts', file: 'test-vdom/families-vdom.test.ts' },
  { mode: 'vdom-app+interop', config: 'vitest.config.ts', file: 'test/families-interop.test.ts' },
  { mode: 'vapor-app+interop', config: 'vitest.config.ts', file: 'test/families-interop.test.ts' },
  { mode: 'vapor-only', config: 'vitest.native.config.ts', file: 'test-native/families-vapor-only.test.ts' },
]
const dir = join(tmpdir(), 'reka-vapor-coverage')
mkdirSync(dir, { recursive: true })

const results = new Map() // component -> { mode: status }
const cache = new Map()
for (const run of runs) {
  const out = join(dir, `${run.config}.json`)
  if (!cache.has(out)) {
    try {
      execFileSync('npx', ['vitest', 'run', '-c', run.config, run.file, '--reporter=json', `--outputFile=${out}`], { stdio: 'ignore' })
    }
    catch {}
    cache.set(out, JSON.parse(readFileSync(out, 'utf8')))
  }
  for (const file of cache.get(out).testResults) {
    for (const t of file.assertionResults) {
      const describe = t.ancestorTitles.join(' ')
      if (!describe.includes(`(${run.mode})`))
        continue
      // A passing `it.fails` (title ends with "[known gap]") reproduces a known gap.
      const gap = t.title.endsWith(' [known gap]')
      const title = t.title.replace(' [known gap]', '')
      const row = results.get(title) ?? {}
      row[run.mode] = gap ? (t.status === 'passed' ? 'known gap' : 'gap fixed?') : (t.status === 'passed' ? 'pass' : t.status)
      results.set(title, row)
    }
  }
}

const names = [...results.keys()].sort()
const icon = s => s === 'pass' ? 'pass' : s ?? 'n/a'
let md = `| Component | VDOM (baseline) | VDOM app + interop | Vapor app + interop | Pure Vapor |\n|---|---|---|---|---|\n`
for (const name of names) {
  const r = results.get(name)
  md += `| ${name} | ${runs.map(run => icon(r[run.mode])).join(' | ')} |\n`
}
const total = mode => names.filter(n => results.get(n)[mode] === 'pass').length
md += `| **Total passing** | ${runs.map(r => `${total(r.mode)}/${names.length}`).join(' | ')} |\n`
const target = process.argv[2]
if (target)
  writeFileSync(target, md)
process.stdout.write(md)
