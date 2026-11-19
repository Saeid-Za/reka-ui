<script setup lang="ts">
// Vapor implementation of `Presence`.
//
// The VDOM `Presence` (Presence.ts) inspects and re-renders its slot vnode to
// attach a ref to the child. Vapor has no vnodes, so this SFC renders the slot
// behind `v-if` and reads the element the slot rendered from its own block.
// It is swapped in for `Presence.ts` by the Vapor build (see packages/vapor).
import type { PresenceProps } from './Presence'
import { computed, onBeforeUnmount, onMounted, onUpdated, ref, toRefs, useAttrs, watch } from 'vue'
import { createAsChildApplier, resolveAsChildTarget } from '@/Primitive/asChildAttrs'
import { findBlockElement, getInstance, onRootFragmentUpdate } from '@/shared/instance'
import { usePresence } from './usePresence'
import '@/shared/instance.vapor'

defineOptions({
  name: 'Presence',
  // The VDOM Presence passes its attrs through to the child it renders; Vapor
  // does not fall attrs through to a slot, so they are applied by hand below.
  inheritAttrs: false,
})

const props = defineProps<PresenceProps>()

defineSlots<{
  default: (opts: { present: boolean }) => any
}>()

const { present, forceMount } = toRefs(props)

const node = ref<HTMLElement>()
// Mount composables once to prevent duplicated eventListener
const { isPresent } = usePresence(present, node)

defineExpose({ present: isPresent })

const instance = getInstance()
const attrs = useAttrs()
const applyAsChildAttrs = createAsChildApplier({ override: true })
const shouldRender = computed(() => forceMount.value || present.value || isPresent.value)

// The slot may render its element later than Presence updates (an async
// component, e.g. Popover/Tooltip/HoverCard content). Until the element shows
// up, watch the DOM around Presence's block for it.
let observer: MutationObserver | undefined
function stopObserving() {
  observer?.disconnect()
  observer = undefined
}
function observeUntilRendered() {
  if (observer || typeof MutationObserver === 'undefined')
    return
  observer = new MutationObserver(() => {
    if (findBlockElement((instance as { block?: unknown } | null)?.block))
      syncNode()
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

function syncNode() {
  const el = instance && 'block' in instance ? findBlockElement(instance.block) : undefined
  if (!el || typeof el.hasAttribute === 'undefined') {
    node.value = undefined
    if (shouldRender.value)
      observeUntilRendered()
    return
  }
  stopObserving()
  // special case to handle animation for PopperContent; attrs go there too
  node.value = resolveAsChildTarget(el)
  if (Object.keys(attrs).length)
    applyAsChildAttrs(node.value, attrs)
}

function onRootUpdate() {
  syncNode()
  onRootFragmentUpdate(instance, onRootUpdate)
}

onMounted(() => {
  syncNode()
  onRootFragmentUpdate(instance, onRootUpdate)
})
onUpdated(() => {
  syncNode()
  onRootFragmentUpdate(instance, onRootUpdate)
})
onBeforeUnmount(stopObserving)
// One watcher for both sources: a render change always syncs; an attrs change
// only re-applies them while an element is rendered.
watch(() => {
  for (const key in attrs)
    void attrs[key]
  return [shouldRender.value]
}, ([render], [wasRendering]) => {
  if (render !== wasRendering || node.value)
    syncNode()
}, { flush: 'post' })
</script>

<template>
  <slot
    v-if="shouldRender"
    :present="isPresent"
  />
</template>
