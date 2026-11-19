<script lang="ts">
import type { ComboboxContentImplEmits, ComboboxContentImplProps } from './ComboboxContentImpl.vue'

export type ComboboxContentEmits = ComboboxContentImplEmits
export interface ComboboxContentProps extends ComboboxContentImplProps {
  forceMount?: boolean
}
</script>

<script setup lang="ts">
import { Presence } from '@/Presence'
import { useForwardExpose, useForwardPropsEmits, useId } from '@/shared'
import ComboboxContentImpl from './ComboboxContentImpl.vue'
import { injectComboboxRootContext } from './ComboboxRoot.vue'

const props = defineProps<ComboboxContentProps>()
const emits = defineEmits<ComboboxContentEmits>()
const forwarded = useForwardPropsEmits(props, emits)
const { forwardRef } = useForwardExpose()

const rootContext = injectComboboxRootContext()

rootContext.contentId ||= useId(undefined, 'reka-combobox-content')

// Vapor: same boolean as ComboboxContent.vue v-show line 38.
function comboboxContentVshowStyle(present: boolean) {
  if (rootContext.unmountOnHide.value || present)
    return undefined
  return { display: 'none' }
}
</script>

<template>
  <Presence
    v-slot="{ present }"
    :present="forceMount || rootContext.open.value"
    :force-mount="forceMount || !rootContext.unmountOnHide.value"
  >
    <ComboboxContentImpl
      v-bind="{ ...forwarded, ...$attrs }"
      :ref="forwardRef"
      :style="comboboxContentVshowStyle(present)"
      :present="rootContext.unmountOnHide.value || present"
    >
      <slot />
    </ComboboxContentImpl>
  </Presence>
</template>
