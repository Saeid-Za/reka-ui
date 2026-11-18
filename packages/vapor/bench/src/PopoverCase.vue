<script setup vapor lang="ts">
import { PopoverClose, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'

defineProps<{ open: boolean }>()
</script>

<template>
  <PopoverRoot :open="open">
    <PopoverTrigger>Open</PopoverTrigger>
    <PopoverPortal>
      <PopoverContent class="popover-content">
        Popover
        <PopoverClose>Close</PopoverClose>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
