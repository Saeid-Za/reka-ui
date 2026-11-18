<script setup lang="ts">
import { inject, markRaw, watchEffect } from 'vue'
import { Primitive, usePrimitiveElement } from '@/Primitive'
import { CURRENT_COLLECTION } from './Collection.vapor'
import { ITEM_DATA_ATTR } from './collectionCore'

defineOptions({
  name: 'CollectionItem',
  inheritAttrs: false,
})

const props = defineProps<{ value?: any }>()

const context = inject(CURRENT_COLLECTION)!
const { primitiveElement, currentElement } = usePrimitiveElement()

watchEffect((cleanupFn) => {
  if (currentElement.value) {
    const key = markRaw(currentElement.value)
    context.itemMap.value.set(key, { ref: currentElement.value!, value: props.value })
    cleanupFn(() => context.itemMap.value.delete(key))
  }
})

const itemAttr = { [ITEM_DATA_ATTR]: '' }
</script>

<template>
  <Primitive
    ref="primitiveElement"
    as-child
    v-bind="{ ...$attrs, ...itemAttr }"
  >
    <slot />
  </Primitive>
</template>
