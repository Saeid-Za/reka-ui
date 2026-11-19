<script setup vapor lang="ts">
import { DialogContent, DialogPortal, DialogRoot, DialogTrigger } from 'reka-ui'
import { ref } from 'vue'

const active = ref(true)
const open = ref(true)

defineExpose({ active, open })
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger id="trigger">
      Open
    </DialogTrigger>
    <DialogPortal>
      <KeepAlive>
        <DialogContent
          v-if="active"
          id="dialog-content"
        >
          Content
        </DialogContent>
      </KeepAlive>
    </DialogPortal>
  </DialogRoot>
</template>
