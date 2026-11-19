<script setup>
import { Presence, Primitive } from 'reka-ui'
import { ref } from 'vue'

const open = ref(false)
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
