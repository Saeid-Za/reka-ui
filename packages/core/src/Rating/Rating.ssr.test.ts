import type vueuse from '@vueuse/core'
import { renderToString } from '@vue/server-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h, nextTick, shallowRef } from 'vue'
import { isVapor } from '@/test'
import { RatingItem, RatingItemIndicator, RatingRoot } from '.'

let isServer = false

// On the server `useActiveElement` has no document to read, so it stays `undefined`.
vi.mock('@vueuse/core', async (importOriginal) => {
  const mod: typeof vueuse = await importOriginal()

  return {
    ...mod,
    useActiveElement: ((...args) => isServer ? shallowRef(undefined) : mod.useActiveElement(...args)) as typeof mod.useActiveElement,
  }
})

const VdomRatingHydrationFixture = defineComponent({
  setup() {
    return () =>
      h(RatingRoot, { modelValue: 3, step: 0.5, readonly: true }, {
        default: ({ items }: { items: number[] }) => items.map(item =>
          h(RatingItem, { key: item, item }, {
            default: ({ steps }: { steps: number[] }) => steps.map(step =>
              h(RatingItemIndicator, { 'key': step, step, 'data-step': step }, () => '★')),
          })),
      })
  },
})

/**
 * Vapor variant: Vapor SSR renders and hydrates compiled templates, not render
 * functions. Same tree as the render function above.
 */
const VaporRatingHydrationFixture = defineComponent({
  components: { RatingItem, RatingItemIndicator, RatingRoot },
  template: '<RatingRoot :model-value="3" :step="0.5" readonly v-slot="{ items }"><RatingItem v-for="item in items" :key="item" :item="item" v-slot="{ steps }"><RatingItemIndicator v-for="step in steps" :key="step" :step="step" :data-step="step">★</RatingItemIndicator></RatingItem></RatingRoot>',
})

const RatingHydrationFixture = isVapor ? VaporRatingHydrationFixture : VdomRatingHydrationFixture

afterEach(() => {
  isServer = false
  vi.restoreAllMocks()
})

describe('given a Rating with half steps', () => {
  it('should hydrate the step opacity without mismatches', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    isServer = true
    const container = document.createElement('div')
    container.innerHTML = await renderToString(createSSRApp(RatingHydrationFixture))
    isServer = false
    document.body.innerHTML = ''
    document.body.append(container)

    const opacity = (step: number) => (container.querySelector(`[data-step="${step}"]`) as HTMLElement).style.getPropertyValue('--reka-rating-item-step-opacity')
    expect(opacity(0.5)).toBe('0')
    expect(opacity(2.5)).toBe('0')
    expect(opacity(1)).toBe('1')
    expect(opacity(3)).toBe('1')

    createSSRApp(RatingHydrationFixture).mount(container)
    await nextTick()

    expect(warn.mock.calls.flat().join('\n')).not.toContain('Hydration style mismatch')
    expect(error.mock.calls.flat().join('\n')).not.toContain('Hydration completed but contains mismatches')
  })
})
