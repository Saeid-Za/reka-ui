<script lang="ts">
// @vapor-twin-of DialogContent.vue 0da614fd19ef
import type {
  DialogContentImplEmits,
  DialogContentImplProps,
} from './DialogContentImpl.vue'

export type DialogContentEmits = DialogContentImplEmits

export interface DialogContentProps extends Omit<DialogContentImplProps, 'trapFocus'> {
  forceMount?: boolean
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { Presence } from '@/Presence'
import { useEmitAsProps, useForwardExpose } from '@/shared'
import DialogContentModal from './DialogContentModal.vue'
import DialogContentNonModal from './DialogContentNonModal.vue'
import { injectDialogRootContext } from './DialogRoot.vue'

const props = withDefaults(defineProps<DialogContentProps>(), {
  disableOutsidePointerEvents: undefined,
})
const emits = defineEmits<DialogContentEmits>()

const rootContext = injectDialogRootContext()

const emitsAsProps = useEmitAsProps(emits)
const { forwardRef } = useForwardExpose()

const staysMounted = computed(
  () => props.forceMount || !rootContext.unmountOnHide.value,
)

// Vapor: same boolean as DialogContent.vue v-show on lines 59 and 68.
function dialogContentVshowStyle(present: boolean) {
  if (props.forceMount || rootContext.unmountOnHide.value || present)
    return undefined
  return { display: 'none' }
}
</script>

<template>
  <Presence
    v-slot="{ present }"
    :present="rootContext.open.value"
    :force-mount="staysMounted"
  >
    <DialogContentModal
      v-if="rootContext.modal.value"
      :ref="forwardRef"
      :style="dialogContentVshowStyle(present)"
      :present="staysMounted ? present : true"
      v-bind="{ ...props, ...emitsAsProps, ...$attrs }"
    >
      <slot />
    </DialogContentModal>
    <DialogContentNonModal
      v-else
      :ref="forwardRef"
      :style="dialogContentVshowStyle(present)"
      :present="staysMounted ? present : true"
      v-bind="{ ...props, ...emitsAsProps, ...$attrs }"
    >
      <slot />
    </DialogContentNonModal>
  </Presence>
</template>
