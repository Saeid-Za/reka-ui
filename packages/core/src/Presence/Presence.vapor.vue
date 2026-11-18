<script setup lang="ts">
// Vapor implementation of `Presence`.
//
// The VDOM `Presence` (Presence.ts) inspects and re-renders its slot vnode to
// attach a ref to the child. Vapor has no vnodes, so this SFC renders the slot
// behind `v-if` and reads the element the slot rendered from its own block.
// It is swapped in for `Presence.ts` by the Vapor build (see packages/vapor).
import type { PresenceProps } from './Presence'
import { computed, onMounted, ref, toRefs, useAttrs, watch } from 'vue'
import { applyAsChildAttrs } from '@/Primitive/asChildAttrs'
import { findBlockElement, getInstance } from '@/shared/instance'
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
const shouldRender = computed(() => forceMount.value || present.value || isPresent.value)

function syncNode() {
  const el = instance && 'block' in instance ? findBlockElement(instance.block) : undefined
  if (!el || typeof el.hasAttribute === 'undefined') {
    node.value = undefined
    return
  }
  // special case to handle animation for PopperContent
  node.value = el.hasAttribute('data-reka-popper-content-wrapper')
    ? el.firstElementChild as HTMLElement
    : el
  if (Object.keys(attrs).length)
    applyAsChildAttrs(el, attrs)
}

onMounted(syncNode)
watch(shouldRender, syncNode, { flush: 'post' })
watch(() => ({ ...attrs }), () => node.value && syncNode(), { flush: 'post' })
</script>

<template>
  <slot
    v-if="shouldRender"
    :present="isPresent"
  />
</template>
