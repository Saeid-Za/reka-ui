<script lang="ts">
import { createContext, handleAndDispatchCustomEvent, useForwardExpose, useId } from '@/shared'
import { getInstance, isVaporInstance } from '@/shared/instance'

export interface ListboxItemProps<T = AcceptableValue> extends PrimitiveProps {
  /** The value given as data when submitted with a `name`. */
  value: T
  /** When `true`, prevents the user from interacting with the item. */
  disabled?: boolean
}
export type SelectEvent<T> = CustomEvent<{ originalEvent: PointerEvent, value?: T }>

export type ListboxItemEmits<T = AcceptableValue> = {
  /** Event handler called when the selecting item. <br> It can be prevented by calling `event.preventDefault`. */
  select: [event: SelectEvent<T>]
}

const LISTBOX_SELECT = 'listbox.select'

interface ListboxItemContext {
  isSelected: Ref<boolean>
}

export const [injectListboxItemContext, provideListboxItemContext]
  = createContext<ListboxItemContext>('ListboxItem')
</script>

<script setup lang="ts"  generic="T extends AcceptableValue = AcceptableValue">
import type { Ref } from 'vue'
import type { PrimitiveProps } from '..'
import type { AcceptableValue } from '@/shared/types'
import { computed, onBeforeUnmount, onMounted, onUpdated, useAttrs, watch } from 'vue'
import { useCollection } from '@/Collection'
import { createAsChildApplier } from '@/Primitive/asChildAttrs'
import { Primitive } from '..'
import { injectListboxRootContext } from './ListboxRoot.vue'
import { valueComparator } from './utils'

const props = withDefaults(defineProps<ListboxItemProps<T>>(), {
  as: 'div',
})
const emits = defineEmits<ListboxItemEmits<T>>()

defineSlots<{
  default?: (props: {
    /** Whether the item is currently selected */
    selected: boolean
  }) => any
}>()

const id = useId(undefined, 'reka-listbox-item')
const { CollectionItem } = useCollection()
const { forwardRef, currentElement } = useForwardExpose()
const rootContext = injectListboxRootContext()

const isHighlighted = computed(() => currentElement.value != null && currentElement.value === rootContext.highlightedElement.value)
const isSelected = computed(() => valueComparator(rootContext.modelValue.value, props.value, rootContext.by))

const disabled = computed(() => rootContext.disabled.value || props.disabled)

// Vapor: ignored `v-memo` on the VDOM SFC would invalidate when fallthrough attrs
// change; patch them onto the option element when the parent updates attrs in place.
const attrs = useAttrs()
const declaredProps = new Set(['value', 'disabled', 'as', 'asChild'])
const syncFallthroughAttrs = createAsChildApplier({ override: true })
let previousFallthroughKeys = new Set<string>()
function currentFallthroughAttrs(): Record<string, unknown> {
  const inst = getInstance()
  if (!inst || !isVaporInstance(inst))
    return { ...attrs }
  const merged: Record<string, unknown> = {}
  const raw = inst.rawProps
  for (const key in raw) {
    if (key === '$' || declaredProps.has(key))
      continue
    merged[key] = (raw as Record<string, unknown>)[key]
  }
  for (const source of raw.$ ?? []) {
    const resolved = typeof source === 'function' ? source() : source
    for (const [key, value] of Object.entries(resolved ?? {})) {
      if (!declaredProps.has(key))
        merged[key] = value
    }
  }
  return merged
}
function syncAttrsToOption() {
  const el = currentElement.value
  if (!el)
    return
  const next = currentFallthroughAttrs()
  syncFallthroughAttrs(el, next)
  const currentKeys = new Set(Object.keys(next))
  for (const key of previousFallthroughKeys) {
    if (!currentKeys.has(key)) {
      const name = key.startsWith('aria') || key.startsWith('data') ? key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`) : key
      el.removeAttribute(name)
    }
  }
  previousFallthroughKeys = currentKeys
}
function parentFallthroughSignature() {
  const inst = getInstance()
  if (!inst || !isVaporInstance(inst))
    return Object.entries(attrs).flat()
  const parts: unknown[] = []
  const raw = inst.rawProps
  for (const key in raw) {
    if (key === '$')
      continue
    if (!declaredProps.has(key))
      parts.push(key, (raw as Record<string, unknown>)[key])
  }
  for (const source of raw.$ ?? []) {
    const resolved = typeof source === 'function' ? source() : source
    for (const [key, value] of Object.entries(resolved ?? {})) {
      if (!declaredProps.has(key))
        parts.push(key, value)
    }
  }
  return parts
}
watch(parentFallthroughSignature, syncAttrsToOption, { flush: 'post' })
onMounted(syncAttrsToOption)
onUpdated(syncAttrsToOption)

// `aria-activedescendant` names the highlighted item. An item that leaves the document releases the highlight.
// A virtualized list unmounts rows as it scrolls, so `ListboxVirtualizer` owns the highlight there.
onBeforeUnmount(() => {
  if (!rootContext.isVirtual.value && rootContext.highlightedElement.value === currentElement.value)
    rootContext.highlightedElement.value = null
})

async function handleSelect(ev: SelectEvent<T>) {
  emits('select', ev)
  if (ev?.defaultPrevented)
    return

  if (!disabled.value && ev) {
    rootContext.onValueChange(props.value)
    rootContext.changeHighlight(currentElement.value)
  }
}

function handleSelectCustomEvent(ev: PointerEvent) {
  const eventDetail = { originalEvent: ev, value: props.value as T }
  handleAndDispatchCustomEvent(LISTBOX_SELECT, handleSelect, eventDetail)
}

provideListboxItemContext({
  isSelected,
})
</script>

<template>
  <CollectionItem :value="value">
    <Primitive
      :id="id"
      v-bind="$attrs"
      :ref="forwardRef"
      role="option"
      :tabindex="rootContext.focusable.value ? isHighlighted ? '0' : '-1' : -1"
      :aria-selected="isSelected"
      :as="as"
      :as-child="asChild"
      :disabled="disabled ? '' : undefined"
      :data-disabled="disabled ? '' : undefined"
      :data-highlighted="isHighlighted ? '' : undefined"
      :data-state="isSelected ? 'checked' : 'unchecked'"
      @click="handleSelectCustomEvent"
      @keydown.space.prevent="handleSelectCustomEvent"
      @pointermove="() => {
        if (rootContext.highlightedElement.value === currentElement)
          return

        if (rootContext.highlightOnHover.value)
          rootContext.changeHighlight(currentElement, false, false)
      }"
    >
      <slot :selected="isSelected" />
    </Primitive>
  </CollectionItem>
</template>
