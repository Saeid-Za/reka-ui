<script setup lang="ts">
// Deliberately NOT `vapor`: VDOM component using reka-ui's useForwardExpose on a DOM ref.
import { useForwardExpose } from '@/shared'

defineProps<{ checked: boolean }>()
const { forwardRef } = useForwardExpose()
</script>

<template>
  <button
    :ref="forwardRef"
    class="plain-expose"
    type="button"
    :aria-pressed="checked"
  >
    x
  </button>
</template>
