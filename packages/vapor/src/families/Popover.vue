<script setup vapor lang="ts">
import { PopoverClose, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger id="pop-trigger">
      Open
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent id="pop-content">
        Hi
        <PopoverClose id="pop-close">
          x
        </PopoverClose>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
