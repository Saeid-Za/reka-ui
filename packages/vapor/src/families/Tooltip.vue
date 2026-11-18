<script setup vapor lang="ts">
import { TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'reka-ui'
</script>

<template>
  <TooltipProvider>
    <TooltipRoot :default-open="true">
      <TooltipTrigger id="tt-trigger">
        ?
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent id="tt-content">
          Help
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
