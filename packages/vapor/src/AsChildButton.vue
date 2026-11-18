<script setup vapor lang="ts">
import { Primitive } from 'reka-ui'
import { ref } from 'vue'

const clicks = ref(0)
const childClicks = ref(0)
const active = ref(false)

defineExpose({ clicks, childClicks, active })
</script>

<template>
  <Primitive
    as-child
    data-from-parent="yes"
    title="from-primitive"
    class="from-primitive"
    :class="{ 'is-active': active }"
    :aria-pressed="active"
    @click="clicks++"
  >
    <button
      id="child"
      class="own"
      title="from-child"
      @click="childClicks++"
    >
      clicked {{ clicks }}
    </button>
  </Primitive>
</template>
