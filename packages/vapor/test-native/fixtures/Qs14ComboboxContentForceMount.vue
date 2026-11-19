<script setup>
import {
  ComboboxContent,
  ComboboxItem,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
} from 'reka-ui'
import { ref } from 'vue'

const open = ref(false)
defineExpose({ open })
</script>

<template>
  <ComboboxRoot v-model:open="open">
    <ComboboxTrigger>Open</ComboboxTrigger>
    <ComboboxPortal>
      <ComboboxContent
        force-mount
        data-testid="content"
      >
        <ComboboxViewport>
          <ComboboxItem value="a">
            A
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
