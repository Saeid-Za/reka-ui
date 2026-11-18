// Heap snapshot summary per constructor for one scenario: snapshot(N mounted) − snapshot(empty).
//   node bench/heap.mjs --mode vapor --scenario checkbox --count 1000 [--dir vapor-unminified]
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright-core'

const { values: args } = parseArgs({
  options: {
    mode: { type: 'string', default: 'vapor' },
    dir: { type: 'string', default: '' },
    scenario: { type: 'string', default: 'checkbox' },
    count: { type: 'string', default: '1000' },
    top: { type: 'string', default: '25' },
    // Aggregate closures by source location (script:line:col) instead of constructor name.
    locations: { type: 'boolean', default: false },
    chrome: { type: 'string', default: process.env.CHROME_PATH ?? '/usr/bin/google-chrome' },
  },
})
const log = message => process.stdout.write(`${message}\n`)
const dist = join(new URL('..', import.meta.url).pathname, 'bench/dist')

async function snapshot(cdp) {
  await cdp.send('HeapProfiler.collectGarbage')
  await cdp.send('HeapProfiler.collectGarbage')
  let data = ''
  const onChunk = (e) => { data += e.chunk }
  cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk)
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false })
  cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk)
  const snap = JSON.parse(data)
  const { node_fields: fields, node_types: [types] } = snap.snapshot.meta
  const F = fields.length
  const iType = fields.indexOf('type')
  const iName = fields.indexOf('name')
  const iSize = fields.indexOf('self_size')
  const agg = new Map()
  const loc = new Map()
  if (args.locations) {
    const L = snap.snapshot.meta.location_fields.length
    for (let i = 0; i < snap.locations.length; i += L)
      loc.set(snap.locations[i], `${snap.locations[i + 2] + 1}:${snap.locations[i + 3] + 1}`)
  }
  for (let i = 0; i < snap.nodes.length; i += F) {
    const type = types[snap.nodes[i + iType]]
    if (args.locations && type !== 'closure')
      continue
    const name = args.locations
      ? `${snap.strings[snap.nodes[i + iName]] || '(anon)'} @${loc.get(i) ?? '?'}`
      : type === 'object' || type === 'closure' ? `${type}:${snap.strings[snap.nodes[i + iName]]}` : `(${type})`
    const e = agg.get(name) ?? [0, 0]
    e[0] += snap.nodes[i + iSize]
    e[1]++
    agg.set(name, e)
  }
  return agg
}

async function main() {
  const server = createServer((req, res) => {
    const path = join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname))
    const file = existsSync(path) && statSync(path).isDirectory() ? join(path, 'index.html') : path
    if (!existsSync(file))
      return res.writeHead(404).end()
    res.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript' }[extname(file)] ?? 'application/octet-stream' })
    createReadStream(file).pipe(res)
  }).listen(0)
  const browser = await chromium.launch({ executablePath: args.chrome, headless: true })
  const page = await browser.newPage()
  const cdp = await page.context().newCDPSession(page)
  await page.goto(`http://localhost:${server.address().port}/${args.dir || args.mode}/`)
  await page.waitForFunction(() => window.bench)
  const set = (s, n) => page.evaluate(([s, n]) => window.bench.set({ scenario: s, count: n }), [s, n])
  await set(args.scenario, 10)
  await set('none', 0)
  const before = await snapshot(cdp)
  await set(args.scenario, +args.count)
  const after = await snapshot(cdp)
  const n = +args.count
  const rows = Array.from(after, ([k, [size, count]]) => [k, (size - (before.get(k)?.[0] ?? 0)) / n, (count - (before.get(k)?.[1] ?? 0)) / n])
  const total = rows.reduce((a, r) => a + r[1], 0)
  log(`# ${args.dir || args.mode} ${args.scenario}×${n}: ${total.toFixed(0)} bytes/instance (snapshot self sizes)`)
  for (const [k, b, c] of rows.sort((a, b) => b[1] - a[1]).slice(0, +args.top))
    log(`${b.toFixed(0).padStart(7)} B  ${c.toFixed(1).padStart(6)} objs  ${k}`)
  await browser.close()
  server.close()
}
main()
