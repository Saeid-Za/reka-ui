import { nextTick, reactive } from 'vue'

export type Scenario = 'none' | 'checkbox' | 'collapsible' | 'tabs' | 'dialog' | 'popover' | 'listbox-virtual' | 'plain' | 'plain-slot' | 'plain-fragment' | 'plain-vmodel' | 'plain-expose' | 'plain-expose-original' | 'plain-onupdated' | 'plain-fnref' | `probe:${string}`

export const state = reactive({
  scenario: 'none' as Scenario,
  count: 0,
  /** Drives the update op: checked / open / selected tab. */
  on: false,
})

const settle = () => new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)))

/**
 * Time `fn` the way Vue core's benchmark does (`script`: until the scheduler
 * flushed, via `nextTick`), plus `frame`: until the next animation frame has
 * run, which includes style/layout and work reka-ui defers to `nextTick`/rAF.
 */
async function measure(fn: () => void) {
  await settle()
  const start = performance.now()
  fn()
  await nextTick()
  const script = performance.now() - start
  await settle()
  const frame = performance.now() - start
  return { script, frame }
}

;(window as any).bench = {
  mount: (scenario: Scenario, count: number) => measure(() => {
    state.on = false
    state.scenario = scenario
    state.count = count
  }),
  update: (on: boolean) => measure(() => {
    state.on = on
  }),
  unmount: () => measure(() => {
    state.count = 0
    state.scenario = 'none'
  }),
  /** Set state without timing (memory runs, resets). */
  set: async (patch: Partial<typeof state>) => {
    Object.assign(state, patch)
    await nextTick()
    await settle()
  },
  count: (selector: string) => document.querySelectorAll(selector).length,
  maxListboxDataIndex() {
    let max = -1
    for (const node of document.querySelectorAll('[data-index]')) {
      const value = Number(node.getAttribute('data-index'))
      if (!Number.isNaN(value) && value > max)
        max = value
    }
    return max >= 0 ? max : null
  },
  async scrollListboxDiagnose() {
    const el = document.querySelector('.listbox-virtual-content') as HTMLElement | null
    if (!el)
      throw new Error('scrollListboxDiagnose: missing .listbox-virtual-content')
    const style = getComputedStyle(el)
    const firstIndex = document.querySelector('[data-index]')?.getAttribute('data-index') ?? null
    const maxBefore = (window as any).bench.maxListboxDataIndex()
    const before = {
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      overflowY: style.overflowY,
      scrollTop: el.scrollTop,
      firstDataIndex: firstIndex,
      maxDataIndex: maxBefore,
    }
    el.scrollTop += 8000
    await nextTick()
    await settle()
    return {
      ...before,
      scrollTopAfter: el.scrollTop,
      maxDataIndexAfter: (window as any).bench.maxListboxDataIndex(),
    }
  },
  scrollListbox: async () => {
    await settle()
    const start = performance.now()
    const el = document.querySelector('.listbox-virtual-content') as HTMLElement | null
    if (!el)
      throw new Error('scrollListbox: missing .listbox-virtual-content')
    const stepTimes: number[] = []
    let index = (window as any).bench.maxListboxDataIndex()
    const steps = 12
    const maxWaits = 30
    for (let step = 0; step < steps; step++) {
      const stepStart = performance.now()
      el.scrollTop += 8000
      await nextTick()
      await settle()
      let progressed = false
      for (let wait = 0; wait < maxWaits; wait++) {
        const next = (window as any).bench.maxListboxDataIndex()
        if (next != null && next !== index) {
          index = next
          progressed = true
          break
        }
        await settle()
      }
      if (!progressed)
        throw new Error(`scrollListbox: step ${step} timed out (max data-index stayed ${index})`)
      stepTimes.push(performance.now() - stepStart)
    }
    await nextTick()
    const script = performance.now() - start
    await settle()
    return {
      script,
      frame: performance.now() - start,
      steps,
      timeouts: 0,
      stepTimes,
    }
  },
}
