import { createApp, createVaporApp, vaporInteropPlugin } from 'vue'
import Bench from './Bench.vue'

declare const __BENCH_MODE__: 'vdom' | 'interop' | 'vapor'

// vdom:    Bench + reka-ui compiled as VDOM, `createApp`.
// interop: Bench compiled as Vapor, reka-ui as VDOM, `createVaporApp` + interop.
// vapor:   everything compiled as Vapor, `createVaporApp`, no interop plugin.
const app = __BENCH_MODE__ === 'vdom'
  ? createApp(Bench)
  : __BENCH_MODE__ === 'interop'
    ? createVaporApp(Bench as any).use(vaporInteropPlugin)
    : createVaporApp(Bench as any)
app.mount('#app')
performance.mark('app-mounted')
;(window as any).benchMode = __BENCH_MODE__
