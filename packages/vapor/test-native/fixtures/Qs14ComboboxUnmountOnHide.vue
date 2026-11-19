<script setup>
import {
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
} from 'reka-ui'
import { ref } from 'vue'

const open = ref(true)
defineExpose({ open })
</script>

<template>
  <ComboboxRoot
    v-model:open="open"
    :unmount-on-hide="false"
  >
    <ComboboxTrigger data-testid="trigger">
      Open
    </ComboboxTrigger>
    <ComboboxPortal>
      <ComboboxContent data-testid="content">
        <ComboboxInput />
        <ComboboxViewport>
          <ComboboxItem value="a">
            A
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
