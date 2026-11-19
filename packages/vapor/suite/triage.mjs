/* eslint-disable no-console */
// Sorts the failures of a full-suite JSON report (vitest --reporter=json) into the
// FULL_SUITE.md buckets by root cause. Each rule was set by reading the error and the
// test; anything no rule matches is `undiagnosed`.
//   node suite/triage.mjs report.json [out.json]
import fs from 'node:fs'
import process from 'node:process'

const SSR = /SSR renderToString/
const OPTIONS_RENDER = /Options-API render/
const STUBS = /global\.stubs/
const SET_DATA = /setData/
const SSR_HYDRATION = /ssr hydration/
const READ_EL = /reading 'el'/
const VDOM_NAME = /VDOM/
const SNAPSHOT = /Snapshot `/
const ANCHOR = /<!--slot-->/
const FIND_CSS = /findComponent\(css selector\)/
const EMPTY_WRAPPER = /on an empty VueWrapper/
const VM_ACCESS = /reading '(?:field|form|probe|sidebar|emitted|exposed)'|'set' on proxy/
const REAL_VNODE = /a real VNode reached/
const READ_DOLLAR_EL = /reading '\$el'/
const VIRTUALIZED = /virtualized/
const CONSUMER_LISTENERS = /consumer event listeners/
const IN_FORM = /in a form|labelled forms/
const NOT_CALLED = /called 1 times, but got 0|called with arguments/
const ID_CHANGE = /id changes|follows an id the consumer/
const KEEP_ALIVE = /KeepAlive/
const AS_CHILD_CONTENT = /as-child content/
const ELEMENT_FILES = /^(?:Primitive\/|shared\/useForwardExpose)/
const DISPLAY_NONE = /to be 'none'/

// [bucket, cause, (file, testName, firstMessageLine) => boolean], first match wins
const RULES = [
  // Vapor SSR (FULL_SUITE.md, "The 3 SSR failures left")
  ['fail:harness', 'S1 Vapor SSR: vi.mock() does not reach the server-compiled copy of a module (Dialog.ssr, useBodyScrollLock)', f => f === 'Dialog/Dialog.ssr.test.ts'],
  ['fail:harness', 'S2 Vapor SSR: vi.resetModules() reloads the inlined vue, stack overflow (Popover.ssr, suspected)', f => f === 'Popover/Popover.ssr.test.ts'],
  ['fail:reka', 'S3 Vapor SSR: as-child attrs are applied on the client only, missing from server markup (QS7)', (f, n) => f === 'Tabs/Tabs.test.ts' && SSR_HYDRATION.test(n)],
  // C1–C6 no longer occur since r5 (harness support / isVapor variants); kept to classify old reports
  ['cannot-run', 'C1 SSR renderToString (Vapor SSR out of scope, Q11)', (f, n, m) => SSR.test(m)],
  ['cannot-run', 'C2 Options-API render() using `this` (VDOM-only API)', (f, n, m) => OPTIONS_RENDER.test(m)],
  ['cannot-run', 'C3 VTU global.stubs (Vapor resolves imported components at compile time)', (f, n, m) => STUBS.test(m)],
  ['cannot-run', 'C4 VTU Options-API wrapper.setData', (f, n, m) => SET_DATA.test(m)],
  ['cannot-run', 'C5 VNode introspection (vm.$.subTree.el)', (f, n, m) => f.startsWith('Toast/') && READ_EL.test(m)],
  ['cannot-run', 'C6 test asserts VDOM-instance behaviour of a helper', (f, n) => f === 'shared/instance.test.ts' && VDOM_NAME.test(n)],
  ['markup-only', 'M1 html()/snapshot differs only by Vapor anchor comments (<!--slot-->, <!--if-->, <!--dynamic-component-->) and attribute order', (f, n, m) => SNAPSHOT.test(m) || ANCHOR.test(m) || f.startsWith('Label/')],
  ['fail:harness', 'H1 findComponent(css selector) not implemented', (f, n, m) => FIND_CSS.test(m)],
  ['fail:harness', 'H2 findComponent(Component) finds nothing (empty VueWrapper)', (f, n, m) => EMPTY_WRAPPER.test(m)],
  ['fail:harness', 'H3 vm / exposed access through the shim (`vm.field`, `vm.form`, refs, proxy set)', (f, n, m) => VM_ACCESS.test(m)],
  ['fail:harness', 'H4 real VNode reached the render-function bridge', (f, n, m) => REAL_VNODE.test(m)],
  ['fail:reka', 'R1 virtualizer item refs ($el of undefined) — known gap ADR-017', (f, n, m) => READ_DOLLAR_EL.test(m) || (f.startsWith('ScrollArea/') && VIRTUALIZED.test(n))],
  ['fail:reka', 'R2 consumer listeners run after the component\'s own handlers (preventDefault opt-out ignored)', (f, n) => CONSUMER_LISTENERS.test(n)],
  ['fail:reka', 'R3 form-control detection: closest(\'form\') read before the element is inserted into <form>', (f, n, m) => IN_FORM.test(n) || (f.startsWith('Form/') && NOT_CALLED.test(m))],
  ['fail:reka', 'R4 consumer id / trigger id change not propagated (remaining after ADR-S06)', (f, n) => ID_CHANGE.test(n)],
  ['fail:harness', 'H5 useRenderedContentId: KeepAlive dynamic fragment in bridge (was U1)', (f, n) => KEEP_ALIVE.test(n)],
  ['undiagnosed', 'U2 useRenderedContentId: as-child content with no element', (f, n) => AS_CHILD_CONTENT.test(n)],
  ['fail:reka', 'R5 as-child / element resolution (Primitive, usePrimitiveElement, useForwardExpose)', f => ELEMENT_FILES.test(f)],
  ['fail:reka', 'R6 scope-id forwarding (useForwardScopeId)', f => f === 'shared/useForwardScopeId.test.ts'],
  ['fail:reka', 'R7 unmountOnHide=false content not hidden (v-show/display on persistent content)', (f, n, m) => DISPLAY_NONE.test(m)],
]
const OTHER = ['undiagnosed', 'U9 other (to investigate one by one)']

const report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const out = []
for (const file of report.testResults) {
  const f = file.name.split('/core/src/')[1]
  for (const t of file.assertionResults) {
    if (t.status !== 'failed')
      continue
    const m = (t.failureMessages[0] || '').split('\n')[0]
    const [bucket, cause] = RULES.find(([, , match]) => match(f, t.fullName, m)) || OTHER
    out.push({ file: f, test: t.fullName, message: m.slice(0, 160), bucket, cause })
  }
}
if (process.argv[3])
  fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1))

function count(key) {
  const counts = {}
  for (const o of out)
    counts[key(o)] = (counts[key(o)] || 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
}
console.log('failed', out.length)
for (const [k, v] of count(o => o.bucket))
  console.log(v, k)
for (const [k, v] of count(o => `${o.bucket} | ${o.cause}`))
  console.log(v, k)
for (const o of out.filter(o => o.cause === OTHER[1]))
  console.log('U9', o.file, '|', o.test, '|', o.message)
