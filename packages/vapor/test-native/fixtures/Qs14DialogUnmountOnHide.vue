<script setup>
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from 'reka-ui'
import { ref } from 'vue'

const open = ref(true)
defineExpose({ open })
</script>

<template>
  <DialogRoot
    v-model:open="open"
    :unmount-on-hide="false"
  >
    <DialogTrigger>Open</DialogTrigger>
    <DialogContent data-testid="content">
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Desc</DialogDescription>
      <DialogClose>Close</DialogClose>
    </DialogContent>
  </DialogRoot>
</template>
