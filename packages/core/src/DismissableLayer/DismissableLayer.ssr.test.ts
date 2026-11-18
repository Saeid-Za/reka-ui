// @vitest-environment node
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { DialogContent, DialogRoot, DialogTitle } from '@/Dialog'
import { PopoverContent, PopoverRoot, PopoverTrigger } from '@/Popover'
import { isVapor } from '@/test'

// Vapor SSR renders compiled templates, not render functions: in Vapor each fixture is
// the template of the same tree.
const fixtures = {
  openDialog: isVapor
    ? { components: { DialogContent, DialogRoot, DialogTitle }, template: '<DialogRoot default-open><DialogContent :aria-describedby="undefined"><DialogTitle>Title</DialogTitle></DialogContent></DialogRoot>' }
    : { render: () => h(DialogRoot, { defaultOpen: true }, () => h(DialogContent, { 'aria-describedby': undefined }, () => h(DialogTitle, () => 'Title'))) },
  forceMountedDialog: isVapor
    ? { components: { DialogContent, DialogRoot, DialogTitle }, template: '<DialogRoot><DialogContent force-mount :aria-describedby="undefined"><DialogTitle>Title</DialogTitle></DialogContent></DialogRoot>' }
    : { render: () => h(DialogRoot, () => h(DialogContent, { 'forceMount': true, 'aria-describedby': undefined }, () => h(DialogTitle, () => 'Title'))) },
  openPopover: isVapor
    ? { components: { PopoverContent, PopoverRoot, PopoverTrigger }, template: '<PopoverRoot default-open><PopoverTrigger>Open</PopoverTrigger><PopoverContent>Content</PopoverContent></PopoverRoot>' }
    : { render: () => h(PopoverRoot, { defaultOpen: true }, () => [h(PopoverTrigger, () => 'Open'), h(PopoverContent, () => 'Content')]) },
}

// Runs without jsdom: on a real server there is no `document` or `window`, which
// the jsdom-based SSR tests cannot show.
describe('given a DismissableLayer rendered on the server', () => {
  it('has no DOM globals', () => {
    expect(typeof document).toBe('undefined')
    expect(typeof window).toBe('undefined')
  })

  it('renders an open Dialog outside a portal', async () => {
    const html = await renderToString(createSSRApp(fixtures.openDialog))

    expect(html).toContain('role="dialog"')
  })

  it('renders a closed Dialog with force-mounted content', async () => {
    const html = await renderToString(createSSRApp(fixtures.forceMountedDialog))

    expect(html).toContain('role="dialog"')
  })

  it('renders an open Popover', async () => {
    const html = await renderToString(createSSRApp(fixtures.openPopover))

    expect(html).toContain('Content')
  })
})
