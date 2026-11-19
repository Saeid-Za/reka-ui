// reka-ui VDOM vs Vapor benchmark: builds the bench app three ways and drives
// it in real Chrome (playwright-core). See vapor-proposal/BENCHMARKS.md.
//
//   node bench/run.mjs [--skip-build] [--runs 10] [--warmup 3] [--cpu 4] [--out file.json] [--only a,b] [--modes vapor]
import { execFileSync } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import os from 'node:os'
import { extname, join } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'
import { chromium } from 'playwright-core'

const { values: args } = parseArgs({
  options: {
    'skip-build': { type: 'boolean', default: false },
    'runs': { type: 'string', default: '10' },
    'warmup': { type: 'string', default: '3' },
    'cpu': { type: 'string', default: '4' },
    'chrome': { type: 'string', default: process.env.CHROME_PATH ?? '/usr/bin/google-chrome' },
    'out': { type: 'string', default: '' },
    // comma-separated subset, e.g. --only plain,checkbox
    'only': { type: 'string', default: '' },
    'skip-timing': { type: 'boolean', default: false },
    // comma-separated subset of vdom,interop,vapor (for quick perf iterations)
    'modes': { type: 'string', default: 'vdom,interop,vapor' },
  },
})
const RUNS = +args.runs
const WARMUP = +args.warmup
const CPU = +args.cpu
const MODES = args.modes.split(',')
const pkg = new URL('..', import.meta.url).pathname
const dist = join(pkg, 'bench/dist')

const log = message => process.stdout.write(`${message}\n`)

async function main() {
  // ---- build + bundle size -------------------------------------------------
  if (!args['skip-build']) {
    for (const mode of MODES) {
      log(`building ${mode}...`)
      execFileSync('npx', ['vite', 'build', '-c', 'bench/vite.config.ts'], { cwd: pkg, stdio: 'inherit', env: { ...process.env, BENCH_MODE: mode } })
    }
  }
  const bundle = {}
  for (const mode of MODES) {
    const dir = join(dist, mode, 'assets')
    const file = readdirSync(dir).find(f => f.endsWith('.js'))
    const code = readFileSync(join(dir, file))
    bundle[mode] = {
      min: code.length,
      gzip: gzipSync(code, { level: 9 }).length,
      brotli: brotliCompressSync(code, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
    }
  }

  // ---- static server -------------------------------------------------------
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' }
  const server = createServer((req, res) => {
    const path = join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname))
    const file = existsSync(path) && statSync(path).isDirectory() ? join(path, 'index.html') : path
    if (!existsSync(file)) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
    createReadStream(file).pipe(res)
  }).listen(0)
  const port = server.address().port

  // ---- browser -------------------------------------------------------------
  const browser = await chromium.launch({
    executablePath: args.chrome,
    headless: true,
    args: ['--js-flags=--expose-gc', '--enable-precise-memory-info', '--no-first-run', '--disable-extensions'],
  })

  async function openPage(mode) {
    const context = await browser.newContext()
    const page = await context.newPage()
    const cdp = await context.newCDPSession(page)
    await cdp.send('Performance.enable')
    await page.goto(`http://localhost:${port}/${mode}/`)
    await page.waitForFunction(() => window.bench && window.benchMode)
    if (CPU > 1)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
    return { page, cdp, close: () => context.close() }
  }

  async function heapUsed(cdp) {
    await cdp.send('HeapProfiler.collectGarbage')
    await cdp.send('HeapProfiler.collectGarbage')
    const { metrics } = await cdp.send('Performance.getMetrics')
    return metrics.find(m => m.name === 'JSHeapUsedSize').value
  }

  function stats(values) {
    const sorted = values.toSorted((a, b) => a - b)
    const n = values.length
    const mean = values.reduce((a, b) => a + b, 0) / n
    const std = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / n)
    const round = x => +x.toFixed(2)
    return { median: round(sorted[Math.floor(n / 2)]), mean: round(mean), std: round(std), min: round(sorted[0]), max: round(sorted[n - 1]), n }
  }

  // Each op is timed in the page (bench/src/state.ts); `script` and `frame`.
  const ALL_SCENARIOS = [
    // control: a plain VDOM <button> component with no reka-ui code (see PlainRow.vue)
    { name: 'plain', count: 1000, check: '.plain', ops: ['mount', 'update:on', 'update:off', 'unmount'] },
    // control: the same with Vapor slot content passed into the VDOM component
    { name: 'plain-slot', count: 1000, check: '.plain-slot', ops: ['mount', 'update:on', 'update:off', 'unmount'] },
    // control: plain VDOM component with a fragment root
    { name: 'plain-fragment', count: 1000, check: '.plain-fragment', ops: ['mount', 'update:on', 'update:off', 'unmount'], probe: true },
    { name: 'plain-vmodel', count: 1000, check: '.plain-vmodel', ops: ['mount', 'unmount'], probe: true },
    { name: 'plain-expose', count: 1000, check: '.plain-expose', ops: ['mount', 'unmount'], probe: true },
    { name: 'plain-expose-original', count: 1000, check: '.plain-expose-original', ops: ['mount', 'unmount'], probe: true },
    { name: 'plain-onupdated', count: 1000, check: '.plain-onupdated', ops: ['mount', 'unmount'], probe: true },
    { name: 'plain-fnref', count: 1000, check: '.plain-fnref', ops: ['mount', 'unmount'], probe: true },
    // leak bisection probes (memory only; see BENCHMARKS.md)
    ...['primitive', 'primitive-as-child', 'visually-hidden', 'checkbox-root'].map(p => ({ name: `probe:${p}`, count: 1000, check: '.probe', ops: ['mount', 'unmount'], probe: true })),
    { name: 'checkbox', count: 1000, check: '.cb', ops: ['mount', 'update:on', 'update:off', 'unmount'] },
    { name: 'collapsible', count: 500, check: '.col-trigger', ops: ['mount', 'update:on', 'update:off', 'unmount'] },
    { name: 'tabs', count: 200, check: '[role="tab"]', ops: ['mount', 'update:on', 'update:off', 'unmount'] },
    { name: 'dialog', count: 1, check: 'button', ops: ['mount', 'update:on', 'update:off', 'unmount'], openCheck: '.dialog-content' },
    { name: 'popover', count: 1, check: 'button', ops: ['mount', 'update:on', 'update:off', 'unmount'], openCheck: '.popover-content' },
    { name: 'listbox-virtual', count: 1, check: '[role=option]', ops: ['mount', 'scroll', 'unmount'] },
  ]
  const only = args.only ? args.only.split(',') : null
  // probes run only when asked for with --only
  const SCENARIOS = ALL_SCENARIOS.filter(s => only ? only.includes(s.name) : !s.probe)

  async function runOp(page, scenario, op) {
    if (op === 'mount')
      return page.evaluate(([s, n]) => window.bench.mount(s, n), [scenario.name, scenario.count])
    if (op === 'unmount')
      return page.evaluate(() => window.bench.unmount())
    if (op === 'scroll')
      return page.evaluate(() => window.bench.scrollListbox())
    return page.evaluate(on => window.bench.update(on), op === 'update:on')
  }

  const timing = {}
  const memory = {}
  const startup = {}
  const sanity = {}

  for (const [index, scenario] of (args['skip-timing'] ? [] : SCENARIOS).entries()) {
    // rotate mode order per scenario to spread drift across modes
    const order = MODES.map((_, i) => MODES[(i + index) % MODES.length])
    for (const mode of order) {
      const { page, close } = await openPage(mode)
      const samples = Object.fromEntries(scenario.ops.flatMap(op => [[`${op}/script`, []], [`${op}/frame`, []]]))
      for (let round = 0; round < WARMUP + RUNS; round++) {
        for (const op of scenario.ops) {
          const result = await runOp(page, scenario, op)
          if (op === 'mount' && round === 0) {
            const rendered = await page.evaluate(sel => window.bench.count(sel), scenario.check)
            sanity[`${scenario.name}/${mode}`] = { rendered }
          }
          if (op === 'update:on' && round === 0 && scenario.openCheck) {
            await page.waitForTimeout(50)
            sanity[`${scenario.name}/${mode}`].opened = await page.evaluate(sel => window.bench.count(sel), scenario.openCheck)
          }
          if (round >= WARMUP) {
            samples[`${op}/script`].push(result.script)
            samples[`${op}/frame`].push(result.frame)
          }
        }
      }
      timing[`${scenario.name}/${mode}`] = Object.fromEntries(Object.entries(samples).map(([k, v]) => [k, stats(v)]))
      timing[`${scenario.name}/${mode}`].raw = samples
      await close()
      log(`timed ${scenario.name} ${mode}`)
    }
  }

  // Retained JS heap per mounted instance (krausest-style "run memory"), after forced GC.
  for (const scenario of SCENARIOS.filter(s => s.count > 1)) {
    for (const mode of MODES) {
      const perInstance = []
      const residual = []
      const cycles = []
      for (let i = 0; i < 3; i++) {
        const { page, cdp, close } = await openPage(mode)
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
        // warm the code paths once so lazily compiled code isn't counted as instance cost
        await page.evaluate(([s, n]) => window.bench.set({ scenario: s, count: n }), [scenario.name, 10])
        await page.evaluate(() => window.bench.set({ scenario: 'none', count: 0 }))
        const base = await heapUsed(cdp)
        await page.evaluate(([s, n]) => window.bench.set({ scenario: s, count: n }), [scenario.name, scenario.count])
        const mounted = await heapUsed(cdp)
        await page.evaluate(() => window.bench.set({ scenario: 'none', count: 0 }))
        const after = await heapUsed(cdp)
        perInstance.push((mounted - base) / scenario.count)
        residual.push(after - base)
        // two more mount/unmount cycles: does the residual grow (a leak) or stay flat?
        const growth = []
        for (let c = 0; c < 2; c++) {
          await page.evaluate(([s, n]) => window.bench.set({ scenario: s, count: n }), [scenario.name, scenario.count])
          await page.evaluate(() => window.bench.set({ scenario: 'none', count: 0 }))
          growth.push(await heapUsed(cdp) - base)
        }
        cycles.push([after - base, ...growth])
        await close()
      }
      memory[`${scenario.name}/${mode}`] = { bytesPerInstance: stats(perInstance), residualBytesAfterUnmount: stats(residual), residualAfterCycles: cycles, count: scenario.count }
    }
    log(`memory ${scenario.name}`)
  }

  const listboxVirtual = SCENARIOS.find(s => s.name === 'listbox-virtual')
  if (listboxVirtual) {
    for (const mode of MODES) {
      const mountDelta = []
      const residual = []
      for (let i = 0; i < 3; i++) {
        const { page, cdp, close } = await openPage(mode)
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
        await cdp.send('HeapProfiler.collectGarbage')
        await cdp.send('HeapProfiler.collectGarbage')
        const base = await heapUsed(cdp)
        await page.evaluate(() => window.bench.mount('listbox-virtual', 1))
        const mounted = await heapUsed(cdp)
        await page.evaluate(() => window.bench.unmount())
        await cdp.send('HeapProfiler.collectGarbage')
        await cdp.send('HeapProfiler.collectGarbage')
        const after = await heapUsed(cdp)
        mountDelta.push(mounted - base)
        residual.push(after - base)
        await close()
      }
      memory[`listbox-virtual/${mode}`] = {
        mountHeapBytes: stats(mountDelta),
        residualBytesAfterUnmount: stats(residual),
        count: 1,
      }
    }
    log('memory listbox-virtual')
  }

  // Startup: navigation start -> app mounted (empty bench root), and ready heap.
  for (const mode of MODES) {
    const mounted = []
    const ready = []
    for (let i = 0; i < 10; i++) {
      const context = await browser.newContext()
      const page = await context.newPage()
      const cdp = await context.newCDPSession(page)
      await cdp.send('Performance.enable')
      if (CPU > 1)
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
      await page.goto(`http://localhost:${port}/${mode}/`)
      await page.waitForFunction(() => performance.getEntriesByName('app-mounted').length)
      mounted.push(await page.evaluate(() => performance.getEntriesByName('app-mounted')[0].startTime))
      ready.push(await heapUsed(cdp))
      await context.close()
    }
    startup[mode] = { appMountedMs: stats(mounted), readyHeapBytes: stats(ready) }
  }

  const result = {
    date: new Date().toISOString(),
    environment: {
      chrome: browser.version(),
      node: process.version,
      os: `${os.type()} ${os.release()}`,
      cpu: os.cpus()[0]?.model,
      cores: os.cpus().length,
      memoryGB: Math.round(os.totalmem() / 2 ** 30),
      cpuThrottling: CPU,
      runs: RUNS,
      warmup: WARMUP,
      vue: JSON.parse(readFileSync(join(pkg, 'node_modules/vue/package.json'), 'utf8')).version,
    },
    bundle,
    sanity,
    timing,
    memory,
    startup,
  }
  await browser.close()
  server.close()

  const out = args.out || join(pkg, 'bench/results', `${result.date.replace(/[:.]/g, '-')}.json`)
  mkdirSync(join(out, '..'), { recursive: true })
  writeFileSync(out, JSON.stringify(result, null, 2))
  log(`wrote ${out}`)
}

main()
