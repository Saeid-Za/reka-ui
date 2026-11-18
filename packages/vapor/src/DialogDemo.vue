<script setup vapor lang="ts">
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, DialogTrigger } from 'reka-ui'
import { ref } from 'vue'

const open = ref(false)
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger id="open">
      Open
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay id="overlay" />
      <DialogContent id="dialog">
        <DialogTitle>Title</DialogTitle>
        <DialogDescription>Description</DialogDescription>
        <DialogClose as-child>
          <button id="close">
            Close
          </button>
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
  <span id="dialog-state">{{ open ? 'open' : 'closed' }}</span>
</template>
