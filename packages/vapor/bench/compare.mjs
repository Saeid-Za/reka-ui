// Compare two bench/run.mjs result files for one mode (PERF_LOG.md tables).
//   node bench/compare.mjs before.json after.json [--mode vapor]
// A timing delta is marked as real only when it exceeds 5 % and the larger std.
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { parseArgs } from 'node:util'

const { values, positionals } = parseArgs({ allowPositionals: true, options: { mode: { type: 'string', default: 'vapor' } } })
const [a, b] = positionals.map(f => JSON.parse(readFileSync(f, 'utf8')))
const mode = values.mode
const out = []
const pct = (x, y) => `${y >= x ? '+' : ''}${((100 * (y - x)) / x).toFixed(1)}%`
out.push(`| Scenario/op (script ms) | before | after | delta | real? |`, `|---|---|---|---|---|`)
for (const [key, ops] of Object.entries(b.timing)) {
  if (!key.endsWith(`/${mode}`) || !a.timing[key])
    continue
  for (const [op, s] of Object.entries(ops)) {
    if (!op.endsWith('/script'))
      continue
    const p = a.timing[key][op]
    if (!p)
      continue
    const d = s.median - p.median
    const real = Math.abs(d) > Math.max(0.05 * p.median, p.std, s.std)
    out.push(`| ${key.replace(`/${mode}`, '')} ${op.replace('/script', '')} | ${p.median} (±${p.std}) | ${s.median} (±${s.std}) | ${pct(p.median, s.median)} | ${real ? (d < 0 ? 'better' : 'WORSE') : 'noise'} |`)
  }
}
out.push('', `| Memory (bytes/instance) | before | after | delta |`, `|---|---|---|---|`)
for (const [key, m] of Object.entries(b.memory ?? {})) {
  if (!key.endsWith(`/${mode}`) || !a.memory?.[key])
    continue
  const p = a.memory[key].bytesPerInstance.median
  const s = m.bytesPerInstance.median
  out.push(`| ${key.replace(`/${mode}`, '')} | ${p} | ${s} | ${pct(p, s)} |`)
}
if (a.bundle?.[mode] && b.bundle?.[mode]) {
  out.push('', `| Bundle (bytes) | before | after | delta |`, `|---|---|---|---|`)
  for (const k of ['min', 'gzip', 'brotli'])
    out.push(`| ${k} | ${a.bundle[mode][k]} | ${b.bundle[mode][k]} | ${b.bundle[mode][k] - a.bundle[mode][k]} |`)
}
if (a.startup?.[mode] && b.startup?.[mode])
  out.push('', `Startup median (ms): ${a.startup[mode].appMountedMs.median} → ${b.startup[mode].appMountedMs.median}`)
process.stdout.write(`${out.join('\n')}\n`)
