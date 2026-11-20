<script setup lang="ts">
// @vapor-twin-of Collection.ts b62fda701777
import { inject, onBeforeUnmount, watch } from 'vue'
import { Primitive, usePrimitiveElement } from '@/Primitive'
import { CURRENT_COLLECTION } from './Collection.vapor'

defineOptions({
  name: 'CollectionSlot',
  inheritAttrs: false,
})

const context = inject(CURRENT_COLLECTION)!
const { primitiveElement, currentElement } = usePrimitiveElement()
watch(currentElement, () => {
  context.collectionRef.value = currentElement.value
})
// Only clear our own registration (see Collection.ts).
onBeforeUnmount(() => {
  if (context.collectionRef.value === currentElement.value)
    context.collectionRef.value = undefined
})
</script>

<template>
  <Primitive
    ref="primitiveElement"
    as-child
    v-bind="$attrs"
  >
    <slot />
  </Primitive>
</template>
