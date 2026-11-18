// CPU-profile one scenario in one build, for PERF_LOG.md.
//   node bench/profile.mjs --mode vapor --scenario collapsible --ops mount,unmount [--rounds 5]
// Uses the unminified build (BENCH_MINIFY=false) so function names are readable.
import { createReadStream, existsSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright-core'

const { values: args } = parseArgs({
  options: {
    mode: { type: 'string', default: 'vapor' },
    scenario: { type: 'string', default: 'collapsible' },
    count: { type: 'string', default: '500' },
    ops: { type: 'string', default: 'mount,unmount' },
    rounds: { type: 'string', default: '5' },
    top: { type: 'string', default: '40' },
    out: { type: 'string', default: '' },
    chrome: { type: 'string', default: process.env.CHROME_PATH ?? '/usr/bin/google-chrome' },
  },
})
const META_FRAME_RE = /^\((?:root|program|idle|garbage collector)\)/
const log = message => process.stdout.write(`${message}\n`)
const dist = join(new URL('..', import.meta.url).pathname, 'bench/dist')

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
  await page.goto(`http://localhost:${server.address().port}/${args.mode}-unminified/`)
  await page.waitForFunction(() => window.bench)
  const ops = args.ops.split(',')
  const run = async () => {
    for (const op of ops) {
      if (op === 'mount')
        await page.evaluate(([s, n]) => window.bench.mount(s, n), [args.scenario, +args.count])
      else if (op === 'unmount')
        await page.evaluate(() => window.bench.unmount())
      else
        await page.evaluate(o => window.bench.update(o === 'update:on'), op)
    }
  }
  await run() // warm
  await cdp.send('Profiler.enable')
  await cdp.send('Profiler.setSamplingInterval', { interval: 50 })
  await cdp.send('Profiler.start')
  for (let i = 0; i < +args.rounds; i++)
    await run()
  const { profile } = await cdp.send('Profiler.stop')
  if (args.out)
    writeFileSync(args.out, JSON.stringify(profile))

  // self time per function, and inclusive time per function
  const byId = new Map(profile.nodes.map(n => [n.id, n]))
  const parent = new Map()
  for (const n of profile.nodes) {
    for (const c of n.children ?? []) parent.set(c, n.id)
  }
  const dt = new Map()
  profile.samples.forEach((id, i) => dt.set(id, (dt.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)))
  const key = n => `${n.callFrame.functionName || '(anon)'} :${n.callFrame.lineNumber + 1}`
  const self = new Map()
  const total = new Map()
  for (const [id, t] of dt) {
    const n = byId.get(id)
    self.set(key(n), (self.get(key(n)) ?? 0) + t)
    const seen = new Set()
    for (let cur = id; cur != null; cur = parent.get(cur)) {
      const k = key(byId.get(cur))
      if (!seen.has(k)) {
        seen.add(k)
        total.set(k, (total.get(k) ?? 0) + t)
      }
    }
  }
  const sum = [...dt.values()].reduce((a, b) => a + b, 0)
  const fmt = m => [...m].filter(([k]) => !META_FRAME_RE.test(k)).sort((a, b) => b[1] - a[1]).slice(0, +args.top).map(([k, t]) => `${(t / 1000).toFixed(1).padStart(8)} ms  ${(100 * t / sum).toFixed(1).padStart(5)}%  ${k}`).join('\n')
  log(`# ${args.mode} ${args.scenario}×${args.count} ${args.ops} ×${args.rounds}; sampled ${(sum / 1000).toFixed(1)} ms; gc ${((self.get('(garbage collector) :0') ?? 0) / 1000).toFixed(1)} ms`)
  log(`## self\n${fmt(self)}`)
  log(`## inclusive\n${fmt(total)}`)
  await browser.close()
  server.close()
}
main()
