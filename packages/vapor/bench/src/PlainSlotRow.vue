<script setup lang="ts">
// Deliberately NOT `vapor`: plain VDOM component with a default slot, no reka-ui code.
// Control for the interop memory measurements (Vapor slot content inside a VDOM component).
defineProps<{ checked: boolean }>()
</script>

<template>
  <button
    class="plain-slot"
    type="button"
    :aria-pressed="checked"
  >
    <slot />
  </button>
</template>
