<script setup vapor lang="ts">
import { Presence, Primitive } from 'reka-ui'
import { ref } from 'vue'

const open = ref(true)
defineExpose({ open })
</script>

<template>
  <Presence
    :present="open"
    :force-mount="true"
  >
    <Primitive
      as="div"
      data-testid="body"
    >
      content
    </Primitive>
  </Presence>
</template>
