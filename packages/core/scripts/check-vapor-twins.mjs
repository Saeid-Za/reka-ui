// Twin drift check for the Vapor build.
//
// Every `*.vapor.vue` / `*.vapor.ts` file under src/ replaces or complements a
// VDOM module. Each twin must name that module and the sha256 prefix of the
// content it was last reviewed against:
//
//   // @vapor-twin-of Presence.ts 1a2b3c4d5e6f
//
// When the original changes, this check fails until someone ports the change to
// the twin (or confirms none is needed) and refreshes the hash with `--update`.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const src = resolve(dirname(fileURLToPath(import.meta.url)), '../src')
const update = process.argv.includes('--update')
const TWIN_RE = /\.vapor\.(?:vue|ts)$/
const TAG_RE = /@vapor-twin-of\s+(\S+)\s+([0-9a-f]{12})/

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

function hash(path) {
  return createHash('sha256').update(readFileSync(path, 'utf8').replace(/\r\n/g, '\n')).digest('hex').slice(0, 12)
}

const problems = []
let checked = 0
for (const twin of walk(src).filter(p => TWIN_RE.test(p))) {
  const rel = relative(src, twin)
  const code = readFileSync(twin, 'utf8')
  const match = code.match(TAG_RE)
  if (!match) {
    problems.push(`${rel}: missing "@vapor-twin-of <original> <sha12>" annotation`)
    continue
  }
  const original = join(dirname(twin), match[1])
  let actual
  try {
    actual = hash(original)
  }
  catch {
    problems.push(`${rel}: original ${match[1]} not found`)
    continue
  }
  checked++
  if (actual === match[2])
    continue
  if (update) {
    writeFileSync(twin, code.replace(TAG_RE, `@vapor-twin-of ${match[1]} ${actual}`))
    console.warn(`updated ${rel} (${match[1]} ${match[2]} -> ${actual})`)
    continue
  }
  problems.push(`${rel}: ${match[1]} changed since the twin was reviewed (${match[2]} -> ${actual}). Port the change to the twin, then run with --update.`)
}

if (problems.length) {
  console.error(`Vapor twin check failed:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.warn(`Vapor twins in sync (${checked} checked).`)
