<script lang="ts">
import type { DialogCloseProps } from '@/Dialog'
import { useForwardExpose } from '@/shared'

export interface AlertDialogCancelProps extends DialogCloseProps {}
</script>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { DialogClose } from '@/Dialog'
import { injectAlertDialogContentContext } from './AlertDialogContent.vue'

const props = withDefaults(defineProps<AlertDialogCancelProps>(), { as: 'button' })
const contentContext = injectAlertDialogContentContext()
const { forwardRef, currentElement } = useForwardExpose()
// Stable for this setup; Vapor may replace the DOM node without remounting the component.
const registrationOwner = Symbol('AlertDialogCancel')

watch(
  currentElement,
  (el) => {
    if (el)
      contentContext.onCancelElementChange(el, registrationOwner)
  },
  { flush: 'post' },
)

onMounted(() => {
  const el = currentElement.value
  if (el)
    contentContext.onCancelElementChange(el, registrationOwner)
})
// `AlertDialogContent` stays mounted while closed, so it must not keep this element.
onUnmounted(() => {
  contentContext.onCancelElementChange(undefined, registrationOwner)
})
</script>

<template>
  <DialogClose
    v-bind="props"
    :ref="forwardRef"
  >
    <slot />
  </DialogClose>
</template>
