<script setup lang="ts">
// @vapor-twin-of Slot.ts a66cddceb3a6
// Vapor implementation of the public `Slot` (Slot.ts clones slot vnodes).
import Primitive from './Primitive.vapor.vue'

defineOptions({
  name: 'PrimitiveSlot',
  inheritAttrs: false,
})
</script>

<template>
  <Primitive
    as-child
    v-bind="$attrs"
  >
    <slot />
  </Primitive>
</template>
