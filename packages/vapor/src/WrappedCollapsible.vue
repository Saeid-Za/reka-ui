<script setup vapor lang="ts">
// The shadcn-vue style wrapper pattern: a (Vapor) component forwarding its
// props and emits to a reka-ui root with `useForwardPropsEmits`.
import type { CollapsibleRootEmits, CollapsibleRootProps } from 'reka-ui'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger, useForwardPropsEmits } from 'reka-ui'

const props = defineProps<CollapsibleRootProps>()
const emits = defineEmits<CollapsibleRootEmits>()
const forwarded = useForwardPropsEmits(props, emits)

defineExpose({ forwarded })
</script>

<template>
  <CollapsibleRoot v-bind="forwarded">
    <CollapsibleTrigger id="wrapped-trigger">
      toggle
    </CollapsibleTrigger>
    <CollapsibleContent id="wrapped-content">
      wrapped
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
