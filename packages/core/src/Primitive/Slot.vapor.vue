<script setup lang="ts">
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
