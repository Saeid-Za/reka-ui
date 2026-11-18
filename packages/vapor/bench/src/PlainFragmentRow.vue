<script setup lang="ts">
// Deliberately NOT `vapor`: plain VDOM component with a fragment root (button + v-if),
// no reka-ui code. Bisection control for the interop memory finding.
defineProps<{ checked: boolean }>()
</script>

<template>
  <button
    class="plain-fragment"
    type="button"
    :aria-pressed="checked"
  >
    x
  </button>
  <input
    v-if="checked"
    type="hidden"
  >
</template>
