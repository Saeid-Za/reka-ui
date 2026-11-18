<script setup vapor lang="ts">
import { CollapsibleRoot, Primitive } from 'reka-ui'
import { shallowRef } from 'vue'

const prim = shallowRef<any>()
const root = shallowRef<any>()

defineExpose({ prim, root })
</script>

<template>
  <Primitive
    id="prim"
    ref="prim"
    as="section"
  />
  <CollapsibleRoot
    id="croot"
    ref="root"
    :default-open="true"
  />
</template>
