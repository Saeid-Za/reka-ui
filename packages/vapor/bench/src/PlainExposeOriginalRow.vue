<script setup lang="ts">
// Deliberately NOT `vapor`: VDOM component using reka-ui's useForwardExpose as of a9873a0 (before this branch) on a DOM ref.
import { useForwardExpose } from './useForwardExposeOriginal'

defineProps<{ checked: boolean }>()
const { forwardRef } = useForwardExpose()
</script>

<template>
  <button
    :ref="forwardRef"
    class="plain-expose-original"
    type="button"
    :aria-pressed="checked"
  >
    x
  </button>
</template>
