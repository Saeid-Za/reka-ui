<script setup vapor lang="ts">
import { shallowRef } from 'vue'
import ForwardExposeWrapper from './ForwardExposeWrapper.vue'

const wrapper = shallowRef<any>()
defineExpose({ wrapper })
</script>

<template>
  <ForwardExposeWrapper
    id="fwd"
    ref="wrapper"
    label="forwarded"
  >
    text
  </ForwardExposeWrapper>
</template>
