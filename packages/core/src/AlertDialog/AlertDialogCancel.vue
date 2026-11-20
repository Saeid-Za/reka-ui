<script lang="ts">
import type { DialogCloseProps } from '@/Dialog'
import { useForwardExpose } from '@/shared'

export interface AlertDialogCancelProps extends DialogCloseProps {}
</script>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { DialogClose } from '@/Dialog'
import { injectAlertDialogContentContext } from './AlertDialogContent.vue'

const props = withDefaults(defineProps<AlertDialogCancelProps>(), { as: 'button' })
const contentContext = injectAlertDialogContentContext()
const { forwardRef, currentElement } = useForwardExpose()
const registrationOwner = Symbol('AlertDialogCancel')

onMounted(() => {
  contentContext.onCancelElementChange(currentElement.value, registrationOwner)
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
