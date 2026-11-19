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

const open = ref(false)
defineExpose({ open })
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger>Open</DialogTrigger>
    <DialogContent
      force-mount
      data-testid="content"
    >
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Desc</DialogDescription>
      <DialogClose>Close</DialogClose>
    </DialogContent>
  </DialogRoot>
</template>
