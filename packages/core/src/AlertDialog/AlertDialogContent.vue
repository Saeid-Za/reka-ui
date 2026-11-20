<script lang="ts">
import type {
  DialogContentEmits,
  DialogContentProps,
} from '@/Dialog'
import { createContext, useEmitAsProps, useForwardExpose } from '@/shared'

interface AlertDialogContentContext {
  onCancelElementChange: (el: HTMLElement | undefined, owner?: symbol) => void
}

export const [injectAlertDialogContentContext, provideAlertDialogContentContext]
  = createContext<AlertDialogContentContext>('AlertDialogContent')

export type AlertDialogContentEmits = DialogContentEmits
export interface AlertDialogContentProps extends DialogContentProps {}
</script>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { DialogContent } from '@/Dialog'

const props = withDefaults(defineProps<AlertDialogContentProps>(), {
  // Keep `undefined` (instead of Vue's boolean coercion to `false`) so
  // DialogContent can preserve the modal default while still honoring an
  // explicit `:disable-outside-pointer-events="false"`.
  disableOutsidePointerEvents: undefined,
})
const emits = defineEmits<AlertDialogContentEmits>()

const emitsAsProps = useEmitAsProps(emits)
useForwardExpose()

const cancelElement = ref<HTMLElement | undefined>()
const cancelByOwner = new Map<symbol, HTMLElement>()
let activeCancelOwner: symbol | undefined

function applyActiveCancelRegistration() {
  if (activeCancelOwner) {
    const el = cancelByOwner.get(activeCancelOwner)
    if (el?.isConnected) {
      cancelElement.value = el
      return
    }
  }
  for (const [owner, el] of cancelByOwner) {
    if (el.isConnected) {
      activeCancelOwner = owner
      cancelElement.value = el
      return
    }
  }
  activeCancelOwner = undefined
  cancelElement.value = undefined
}

provideAlertDialogContentContext({
  onCancelElementChange: (el, owner) => {
    if (owner) {
      if (el) {
        cancelByOwner.set(owner, el)
        activeCancelOwner = owner
        cancelElement.value = el
        return
      }
      cancelByOwner.delete(owner)
      if (activeCancelOwner === owner)
        applyActiveCancelRegistration()
      return
    }
    // Fallback when no owner is passed: only release once the node has left the document.
    if (!el && cancelElement.value?.isConnected)
      return
    cancelElement.value = el
  },
})
</script>

<template>
  <DialogContent
    v-bind="{ ...props, ...emitsAsProps }"
    role="alertdialog"
    @pointer-down-outside.prevent
    @interact-outside.prevent
    @open-auto-focus="
      () => {
        nextTick(() => {
          cancelElement?.focus({
            preventScroll: true,
          });
        });
      }
    "
  >
    <slot />
  </DialogContent>
</template>
