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
  scrollListbox: async () => {
    await settle()
    const start = performance.now()
    const el = document.querySelector('.listbox-virtual-content') as HTMLElement | null
    const readIndex = () => document.querySelector('[data-index]')?.getAttribute('data-index')
    if (el) {
      let index = readIndex()
      for (let step = 0; step < 12; step++) {
        el.scrollTop += 8000
        await nextTick()
        await settle()
        for (let wait = 0; wait < 30; wait++) {
          const next = readIndex()
          if (next != null && next !== index) {
            index = next
            break
          }
          await settle()
        }
      }
    }
    await nextTick()
    const script = performance.now() - start
    await settle()
    return { script, frame: performance.now() - start }
  },
}
