<script setup lang="ts">
// Deliberately NOT `vapor`: a plain VDOM component with no reka-ui code.
// Control for the interop memory measurements (reka-ui vs Vue interop itself).
defineProps<{ checked: boolean }>()
</script>

<template>
  <button
    class="plain"
    type="button"
    :aria-pressed="checked"
  >
    x
  </button>
</template>
