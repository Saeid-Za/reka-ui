// Summarise a vitest JSON report of the full-suite run, per test file.
//   node suite/report.mjs <report.json> [--md] [--errors]
/* eslint-disable no-console */
import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import process from 'node:process'

const [file, ...flags] = process.argv.slice(2)
const report = JSON.parse(readFileSync(file, 'utf8'))
const rows = []
const errors = new Map()
for (const r of report.testResults) {
  const name = relative(new URL('../../core/src/', import.meta.url).pathname, r.name)
  const c = { file: name, pass: 0, fail: 0, skip: 0, loadError: '' }
  for (const a of r.assertionResults) {
    if (a.status === 'passed') {
      c.pass++
    }
    else if (a.status === 'failed') {
      c.fail++
      const msg = (a.failureMessages[0] ?? '').split('\n')[0].slice(0, 160)
      const key = msg.replace(/\d+/g, 'N')
      const e = errors.get(key) ?? { msg, count: 0, files: new Set() }
      e.count++
      e.files.add(name)
      errors.set(key, e)
    }
    else {
      c.skip++
    }
  }
  if (!r.assertionResults.length && r.status === 'failed')
    c.loadError = (r.message ?? '').split('\n')[0].slice(0, 160)
  rows.push(c)
}
rows.sort((a, b) => a.file.localeCompare(b.file))
const total = rows.reduce((t, r) => ({ pass: t.pass + r.pass, fail: t.fail + r.fail, skip: t.skip + r.skip }), { pass: 0, fail: 0, skip: 0 })
const loadErrors = rows.filter(r => r.loadError).length
if (flags.includes('--md')) {
  console.log('| File | Pass | Fail | Skip | Note |\n|---|---:|---:|---:|---|')
  for (const r of rows)
    console.log(`| ${r.file} | ${r.pass} | ${r.fail} | ${r.skip} | ${r.loadError ? `load error: ${r.loadError.replace(/\|/g, '\\|')}` : ''} |`)
}
else {
  for (const r of rows)
    console.log(`${r.file.padEnd(56)} ${String(r.pass).padStart(4)} ${String(r.fail).padStart(4)} ${String(r.skip).padStart(4)} ${r.loadError}`)
}
console.log(`\nTOTAL files=${rows.length} pass=${total.pass} fail=${total.fail} skip=${total.skip} files-failed-to-load=${loadErrors}`)
if (flags.includes('--errors')) {
  console.log('\nTop failure messages:')
  for (const e of [...errors.values()].sort((a, b) => b.count - a.count).slice(0, 60))
    console.log(`${String(e.count).padStart(4)} [${e.files.size} files] ${e.msg}`)
}
