<script setup lang="ts">
// Deliberately NOT `vapor`: VDOM component registering only an onUpdated hook. Leak bisection.
import { onUpdated } from 'vue'

defineProps<{ checked: boolean }>()
onUpdated(() => {})
</script>

<template>
  <button
    class="plain-onupdated"
    type="button"
    :aria-pressed="checked"
  >
    x
  </button>
</template>
