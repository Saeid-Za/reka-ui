<script setup vapor lang="ts">
import { HoverCardContent, HoverCardPortal, HoverCardRoot, HoverCardTrigger } from 'reka-ui'
</script>

<template>
  <HoverCardRoot :default-open="true">
    <HoverCardTrigger
      id="hc-trigger"
      href="#"
    >
      @me
    </HoverCardTrigger>
    <HoverCardPortal>
      <HoverCardContent id="hc-content">
        Card
      </HoverCardContent>
    </HoverCardPortal>
  </HoverCardRoot>
</template>
