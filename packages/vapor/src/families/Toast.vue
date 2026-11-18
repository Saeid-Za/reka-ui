<script setup vapor lang="ts">
import { ToastClose, ToastDescription, ToastProvider, ToastRoot, ToastViewport } from 'reka-ui'
import { ref } from 'vue'

const open = ref(true)
</script>

<template>
  <ToastProvider>
    <ToastRoot
      id="toast"
      v-model:open="open"
    >
      <ToastDescription>Saved</ToastDescription>
      <ToastClose id="toast-close">
        x
      </ToastClose>
    </ToastRoot>
    <ToastViewport id="toast-viewport" />
  </ToastProvider>
</template>
