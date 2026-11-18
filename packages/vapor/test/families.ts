import type { Component } from 'vue'
import { expect } from 'vitest'
import CheckboxDemo from '../src/CheckboxDemo.vue'
import CollapsibleDemo from '../src/CollapsibleDemo.vue'
import DialogDemo from '../src/DialogDemo.vue'
import Accordion from '../src/families/Accordion.vue'
import AlertDialog from '../src/families/AlertDialog.vue'
import AspectRatio from '../src/families/AspectRatio.vue'
import Avatar from '../src/families/Avatar.vue'
import Calendar from '../src/families/Calendar.vue'
import ColorField from '../src/families/ColorField.vue'
import ColorSlider from '../src/families/ColorSlider.vue'
import Combobox from '../src/families/Combobox.vue'
import ContextMenu from '../src/families/ContextMenu.vue'
import DateField from '../src/families/DateField.vue'
import DropdownMenu from '../src/families/DropdownMenu.vue'
import Editable from '../src/families/Editable.vue'
import Form from '../src/families/Form.vue'
import HoverCard from '../src/families/HoverCard.vue'
import Label from '../src/families/Label.vue'
import Listbox from '../src/families/Listbox.vue'
import ListboxVirtualizer from '../src/families/ListboxVirtualizer.vue'
import Menubar from '../src/families/Menubar.vue'
import NavigationMenu from '../src/families/NavigationMenu.vue'
import NumberField from '../src/families/NumberField.vue'
import Pagination from '../src/families/Pagination.vue'
import PinInput from '../src/families/PinInput.vue'
import Popover from '../src/families/Popover.vue'
import Progress from '../src/families/Progress.vue'
import RadioGroup from '../src/families/RadioGroup.vue'
import RangeCalendar from '../src/families/RangeCalendar.vue'
import Rating from '../src/families/Rating.vue'
import ScrollArea from '../src/families/ScrollArea.vue'
import Select from '../src/families/Select.vue'
import Separator from '../src/families/Separator.vue'
import Slider from '../src/families/Slider.vue'
import Splitter from '../src/families/Splitter.vue'
import Stepper from '../src/families/Stepper.vue'
import Switch from '../src/families/Switch.vue'
import TagGroup from '../src/families/TagGroup.vue'
import TagsInput from '../src/families/TagsInput.vue'
import TimeField from '../src/families/TimeField.vue'
import Toast from '../src/families/Toast.vue'
import Toggle from '../src/families/Toggle.vue'
import ToggleGroup from '../src/families/ToggleGroup.vue'
import Toolbar from '../src/families/Toolbar.vue'
import Tooltip from '../src/families/Tooltip.vue'
import Tree from '../src/families/Tree.vue'
import VisuallyHidden from '../src/families/VisuallyHidden.vue'
import TabsDemo from '../src/TabsDemo.vue'
import { flush } from './mount'

export interface FamilyCase {
  name: string
  component: Component
  /** Runs before mount; returns a teardown. */
  setup?: () => () => void
  /** Known pure-Vapor gap: the vapor-only run records it as an expected failure. */
  vaporOnlyGap?: string
  check: (host: HTMLElement) => Promise<void>
}

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T
const $$ = (sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll(sel)) as HTMLElement[]

/** Poll until `fn` returns truthy (async component chunks load on first use). */
async function waitFor<T>(fn: () => T, timeout = 2000): Promise<T> {
  const start = Date.now()
  for (;;) {
    await flush()
    const value = fn()
    if (value || Date.now() - start > timeout)
      return value
  }
}

function pointer(el: Element, type: string, init: PointerEventInit = {}) {
  const Ctor = (globalThis as any).PointerEvent ?? MouseEvent
  el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', ...init }))
}
function key(el: Element, k: string) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
}

/** One anatomy + one interaction per family. Identical checks run in every mode. */
export const families: FamilyCase[] = [
  { name: 'Accordion', component: Accordion, async check(host) {
    const t = $('#acc-a', host)
    expect(t.getAttribute('aria-expanded')).toBe('false')
    t.click()
    await flush()
    expect(t.getAttribute('aria-expanded')).toBe('true')
    expect($('#acc-a-content', host).textContent).toContain('Content A')
  } },
  { name: 'AlertDialog', component: AlertDialog, async check(host) {
    $('#ad-open', host).click()
    await flush()
    expect($('#ad-content').getAttribute('role')).toBe('alertdialog')
    $('#ad-cancel').click()
    await flush()
    expect($('#ad-content')).toBeNull()
  } },
  { name: 'AspectRatio', component: AspectRatio, async check(host) {
    const img = $('#ar-img', host)
    expect(img.parentElement!.style.position).toBe('absolute')
  } },
  { name: 'Avatar', component: Avatar, async check(host) {
    await flush()
    expect($('#avatar', host)).toBeTruthy()
    expect($('#avatar-fallback', host)?.textContent?.trim()).toBe('SC')
  } },
  { name: 'Calendar', component: Calendar, async check(host) {
    const heading = $('#cal-heading', host).textContent
    expect($$('.cal-day', host).length).toBeGreaterThan(27)
    $('#cal-next', host).click()
    await flush()
    expect($('#cal-heading', host).textContent).not.toBe(heading)
  } },
  { name: 'Checkbox', component: CheckboxDemo, async check(host) {
    $('#cb', host).click()
    await flush()
    expect($('#cb', host).getAttribute('aria-checked')).toBe('true')
    expect($('#indicator', host)).toBeTruthy()
  } },
  { name: 'Collapsible', component: CollapsibleDemo, async check(host) {
    $('#trigger', host).click()
    await flush()
    expect($('#content', host).textContent?.trim()).toBe('secret')
  } },
  { name: 'Combobox', component: Combobox, async check(host) {
    $('#cbx-trigger', host).click()
    await flush()
    expect($('#cbx-input', host).getAttribute('aria-expanded')).toBe('true')
    expect($$('[role="option"]').length).toBe(2)
  } },
  { name: 'ContextMenu', component: ContextMenu, async check(host) {
    $('#cm-trigger', host).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }))
    await flush()
    expect($('#cm-content')?.getAttribute('role')).toBe('menu')
  } },
  { name: 'Dialog', component: DialogDemo, async check(host) {
    $('#open', host).click()
    await flush()
    const dialog = $('#dialog')
    expect(dialog.getAttribute('role')).toBe('dialog')
    expect(dialog.contains(document.activeElement)).toBe(true)
    key(dialog, 'Escape')
    await flush()
    expect($('#dialog')).toBeNull()
  } },
  { name: 'DropdownMenu', component: DropdownMenu, async check(host) {
    $('#dd-trigger', host).click()
    await flush()
    expect($('#dd-trigger', host).getAttribute('aria-expanded')).toBe('true')
    expect($$('[role="menuitem"]').length).toBe(2)
  } },
  { name: 'Editable', component: Editable, async check(host) {
    expect($('#ed-preview', host).textContent?.trim()).toBe('hello')
    $('#ed-edit', host).click()
    await flush()
    expect(($('#ed-input', host) as HTMLInputElement).value).toBe('hello')
    expect($('#ed-input', host).hasAttribute('hidden')).toBe(false)
  } },
  { name: 'HoverCard', component: HoverCard, async check() {
    expect((await waitFor(() => $('#hc-content')))?.textContent).toContain('Card')
  } },
  { name: 'Label', component: Label, async check(host) {
    expect($('#lbl', host).tagName).toBe('LABEL')
    expect($('#lbl', host).getAttribute('for')).toBe('x')
  } },
  { name: 'Listbox', component: Listbox, async check(host) {
    expect($('[role="listbox"]', host)).toBeTruthy()
    pointer($('#lb-b', host), 'pointerdown')
    $('#lb-b', host).click()
    await flush()
    expect($('#lb-b', host).getAttribute('aria-selected')).toBe('true')
    expect($('#lb-value', host).textContent?.trim()).toBe('b')
  } },
  { name: 'NumberField', component: NumberField, async check(host) {
    expect(($('#nf-input', host) as HTMLInputElement).value).toBe('5')
    key($('#nf-input', host), 'ArrowUp')
    await flush()
    expect(($('#nf-input', host) as HTMLInputElement).value).toBe('6')
  } },
  { name: 'Pagination', component: Pagination, async check(host) {
    expect($$('.pg-item', host).length).toBeGreaterThan(1)
    $('#pg-next', host).click()
    await flush()
    expect($('[data-selected]', host)?.textContent?.trim()).toBe('2')
  } },
  { name: 'PinInput', component: PinInput, async check(host) {
    expect($$('.pin-cell', host).length).toBe(4)
  } },
  { name: 'Popover', component: Popover, async check(host) {
    $('#pop-trigger', host).click()
    expect(await waitFor(() => $('#pop-content'))).toBeTruthy()
    $('#pop-close').click()
    await flush()
    expect($('#pop-content')).toBeNull()
  } },
  { name: 'Progress', component: Progress, async check(host) {
    expect($('#progress', host).getAttribute('role')).toBe('progressbar')
    expect($('#progress', host).getAttribute('aria-valuenow')).toBe('40')
  } },
  { name: 'RadioGroup', component: RadioGroup, async check(host) {
    $('#rg-b', host).click()
    await flush()
    expect($('#rg-b', host).getAttribute('aria-checked')).toBe('true')
    expect($('#rg-value', host).textContent?.trim()).toBe('b')
  } },
  { name: 'ScrollArea', component: ScrollArea, async check(host) {
    expect($('#sa-viewport', host)).toBeTruthy()
    expect($('#sa-viewport', host).textContent).toContain('Row 20')
  } },
  { name: 'Select', component: Select, async check(host) {
    pointer($('#sel-trigger', host), 'pointerdown')
    await flush()
    expect($('#sel-trigger', host).getAttribute('aria-expanded')).toBe('true')
    expect($$('[role="option"]').length).toBe(2)
  } },
  { name: 'Separator', component: Separator, async check(host) {
    expect($('#sep', host).getAttribute('data-orientation')).toBe('vertical')
  } },
  { name: 'Slider', component: Slider, async check(host) {
    const thumb = $('[role="slider"]', host)
    await flush()
    expect(thumb.getAttribute('aria-valuenow')).toBe('50')
    key(thumb, 'ArrowRight')
    await flush()
    expect(thumb.getAttribute('aria-valuenow')).toBe('51')
  } },
  { name: 'Stepper', component: Stepper, async check(host) {
    $('#step-2', host).click()
    pointer($('#step-2', host), 'mousedown')
    await flush()
    expect($('#step-1', host)).toBeTruthy()
  } },
  { name: 'Switch', component: Switch, async check(host) {
    $('#sw', host).click()
    await flush()
    expect($('#sw', host).getAttribute('aria-checked')).toBe('true')
  } },
  { name: 'Tabs', component: TabsDemo, async check(host) {
    $('#tab-b', host).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
    await flush()
    expect($('#tab-b', host).getAttribute('aria-selected')).toBe('true')
    expect($('#panel-b', host).textContent?.trim()).toBe('Panel B')
  } },
  { name: 'TagsInput', component: TagsInput, async check(host) {
    expect($$('.tag', host).length).toBe(2)
    $$('.tag-del', host)[0].click()
    await flush()
    expect($$('.tag', host).length).toBe(1)
  } },
  { name: 'Toggle', component: Toggle, async check(host) {
    $('#toggle', host).click()
    await flush()
    expect($('#toggle', host).getAttribute('aria-pressed')).toBe('true')
  } },
  { name: 'ToggleGroup', component: ToggleGroup, async check(host) {
    $('#tg-r', host).click()
    await flush()
    expect($('#tg-r', host).getAttribute('data-state')).toBe('on')
    expect($('#tg-l', host).getAttribute('data-state')).toBe('off')
  } },
  { name: 'Toolbar', component: Toolbar, async check(host) {
    expect($('#toolbar', host).getAttribute('role')).toBe('toolbar')
    expect($('#tb-1', host).hasAttribute('data-reka-collection-item')).toBe(true)
  } },
  { name: 'Tooltip', component: Tooltip, async check() {
    expect((await waitFor(() => $('[role="tooltip"]')))?.textContent).toContain('Help')
  } },
  { name: 'Tree', component: Tree, async check(host) {
    expect($$('.tree-item', host).map(e => e.textContent?.trim())).toEqual(['a', 'a1', 'b'])
    expect($('[role="tree"]', host)).toBeTruthy()
  } },
  { name: 'VisuallyHidden', component: VisuallyHidden, async check(host) {
    expect($('#vh', host).style.position).toBe('absolute')
  } },
  { name: 'ColorField', component: ColorField, async check(host) {
    const input = $<HTMLInputElement>('#cf-input', host)
    expect(input.value.toLowerCase()).toBe('#7f007f')
    key(input, 'ArrowUp')
    await flush()
    expect(input.value.toLowerCase()).not.toBe('#7f007f')
  } },
  { name: 'ColorSlider', component: ColorSlider, async check(host) {
    await flush()
    const thumb = $('[role="slider"]', host)
    expect(thumb.getAttribute('aria-valuenow')).toBe('120')
    key(thumb, 'ArrowRight')
    await flush()
    expect(thumb.getAttribute('aria-valuenow')).toBe('121')
  } },
  { name: 'DateField', component: DateField, async check(host) {
    const day = $('[data-part="day"]', host)
    expect(day.textContent?.trim()).toBe('15')
    day.focus()
    key(day, 'ArrowUp')
    await flush()
    expect($('[data-part="day"]', host).textContent?.trim()).toBe('16')
  } },
  { name: 'Form', component: Form, async check(host) {
    expect($('#form', host).tagName).toBe('FORM')
    expect($('#form', host).hasAttribute('novalidate')).toBe(true)
    expect($('#form-error', host)?.textContent).toContain('Taken')
  } },
  { name: 'ListboxVirtualizer', component: ListboxVirtualizer, vaporOnlyGap: 'virtualizers clone slot vnodes (cloneVNode); Vapor port is phase 2', setup() {
    // jsdom has no layout; give the virtualizer a 200px viewport (as Listbox.test.ts does).
    const original = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = () => ({ width: 200, height: 200, top: 0, left: 0, right: 200, bottom: 200, x: 0, y: 0, toJSON() {} }) as DOMRect
    return () => { HTMLElement.prototype.getBoundingClientRect = original }
  }, async check(host) {
    await waitFor(() => $$('.lbv-item', host).length)
    const items = $$('.lbv-item', host)
    expect(items.length).toBeGreaterThan(0)
    expect(items.length).toBeLessThan(100)
    expect(items[0].getAttribute('role')).toBe('option')
  } },
  { name: 'Menubar', component: Menubar, async check(host) {
    expect($('#mb', host).getAttribute('role')).toBe('menubar')
    pointer($('#mb-file', host), 'pointerdown')
    await flush()
    expect($('#mb-file', host).getAttribute('aria-expanded')).toBe('true')
    expect($$('[role="menuitem"]', $('#mb-content')).length).toBe(2)
  } },
  { name: 'NavigationMenu', component: NavigationMenu, async check(host) {
    expect($('#nm-trigger', host).getAttribute('aria-expanded')).toBe('false')
    $('#nm-trigger', host).click()
    await flush()
    expect($('#nm-trigger', host).getAttribute('aria-expanded')).toBe('true')
  } },
  { name: 'RangeCalendar', component: RangeCalendar, async check(host) {
    const heading = $('#rc-heading', host).textContent
    expect(heading).toContain('March')
    expect($$('.rc-day', host).length).toBeGreaterThan(27)
    $('#rc-next', host).click()
    await flush()
    expect($('#rc-heading', host).textContent).toContain('April')
  } },
  { name: 'Rating', component: Rating, async check(host) {
    const radios = $$('[role="radio"]', host)
    expect(radios.length).toBe(5)
    expect(radios[1].getAttribute('data-state')).toBe('active')
    radios[3].click()
    await flush()
    expect($('#rating-value', host).textContent?.trim()).toBe('4')
  } },
  { name: 'Splitter', component: Splitter, async check(host) {
    await flush()
    expect($('#sp-handle', host).getAttribute('role')).toBe('separator')
    expect($('#sp-a', host).style.flexGrow).toBe('30')
    expect($('#sp-b', host).style.flexGrow).toBe('70')
  } },
  { name: 'TagGroup', component: TagGroup, async check(host) {
    expect($$('.tg-item', host).length).toBe(2)
    $$('.tg-del', host)[0].click()
    await flush()
    expect($$('.tg-item', host).length).toBe(1)
  } },
  { name: 'TimeField', component: TimeField, async check(host) {
    const hour = $('[data-part="hour"]', host)
    expect(hour.textContent?.trim()).toBe('9')
    hour.focus()
    key(hour, 'ArrowUp')
    await flush()
    expect($('[data-part="hour"]', host).textContent?.trim()).toBe('10')
  } },
  { name: 'Toast', component: Toast, async check() {
    await flush()
    expect($('#toast')?.textContent).toContain('Saved')
    $('#toast-close').click()
    expect(await waitFor(() => !$('#toast'))).toBe(true)
  } },
]
