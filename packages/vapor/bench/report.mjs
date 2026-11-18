// Render a benchmark result JSON (bench/run.mjs) as markdown tables.
//   node bench/report.mjs results.json > tables.md
import { readFileSync } from 'node:fs'
import process from 'node:process'

const r = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const MODES = ['vdom', 'interop', 'vapor']
const LABEL = { vdom: 'VDOM', interop: 'Vapor app + interop', vapor: 'Pure Vapor' }
const kb = b => (b / 1024).toFixed(1)
const out = []

out.push('### Bundle (whole benchmark app, one JS chunk, production build)\n')
out.push('| Mode | min (KiB) | gzip -9 (KiB) | brotli q11 (KiB) |\n|---|---|---|---|')
for (const m of MODES)
  out.push(`| ${LABEL[m]} | ${kb(r.bundle[m].min)} | ${kb(r.bundle[m].gzip)} | ${kb(r.bundle[m].brotli)} |`)

const scenarios = [...new Set(Object.keys(r.timing).map(k => k.split('/')[0]))]
for (const kind of ['script', 'frame']) {
  out.push(`\n### Timings, \`${kind}\` (ms, median of ${r.environment.runs} runs after ${r.environment.warmup} warmup, ${r.environment.cpuThrottling}x CPU throttling)\n`)
  out.push(`| Scenario | Op | ${MODES.map(m => LABEL[m]).join(' | ')} | Pure Vapor vs VDOM |\n|---|---|---|---|---|---|`)
  for (const s of scenarios) {
    const ops = Object.keys(r.timing[`${s}/vdom`]).filter(k => k.endsWith(`/${kind}`)).map(k => k.split('/')[0])
    for (const op of ops) {
      const cells = MODES.map(m => r.timing[`${s}/${m}`][`${op}/${kind}`])
      const ratio = cells[2].median / cells[0].median
      out.push(`| ${s} | ${op} | ${cells.map(c => `${c.median} (±${c.std})`).join(' | ')} | ${ratio.toFixed(2)}x |`)
    }
  }
}

out.push('\n### Memory (JS heap after 2 forced GCs, median of 3 fresh pages, no throttling)\n')
out.push(`| Scenario (N) | ${MODES.map(m => `${LABEL[m]} bytes/instance`).join(' | ')} | ${MODES.map(m => `${LABEL[m]} residual after unmount, cycles 1/2/3 (KiB, first page)`).join(' | ')} |\n|---|---|---|---|---|---|---|`)
for (const s of [...new Set(Object.keys(r.memory).map(k => k.split('/')[0]))]) {
  const cells = MODES.map(m => r.memory[`${s}/${m}`])
  out.push(`| ${s} (${cells[0].count}) | ${cells.map(c => Math.round(c.bytesPerInstance.median)).join(' | ')} | ${cells.map(c => c.residualAfterCycles[0].map(kb).join(' / ')).join(' | ')} |`)
}

out.push(`\n### Startup (${r.environment.cpuThrottling}x CPU, 10 fresh pages each)\n`)
out.push('| Mode | navigation start → app mounted, median ms (min-max) | ready JS heap (KiB) |\n|---|---|---|')
for (const m of MODES)
  out.push(`| ${LABEL[m]} | ${r.startup[m].appMountedMs.median} (${r.startup[m].appMountedMs.min}-${r.startup[m].appMountedMs.max}) | ${kb(r.startup[m].readyHeapBytes.median)} |`)

out.push('\n### Sanity checks (elements rendered on first mount / content present after open)\n')
out.push('| Scenario/mode | rendered | opened |\n|---|---|---|')
for (const [k, v] of Object.entries(r.sanity))
  out.push(`| ${k} | ${v.rendered} | ${v.opened ?? '-'} |`)

process.stdout.write(`${out.join('\n')}\n`)
