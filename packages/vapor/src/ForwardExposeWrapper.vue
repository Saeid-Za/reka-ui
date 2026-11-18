<script setup vapor lang="ts">
// An app's own Vapor component built on reka-ui's public `useForwardExpose`.
import { Primitive, useForwardExpose } from 'reka-ui'

defineProps<{ label: string }>()
const { forwardRef } = useForwardExpose()
</script>

<template>
  <Primitive
    :ref="forwardRef"
    as="article"
    :aria-label="label"
  >
    <slot />
  </Primitive>
</template>
