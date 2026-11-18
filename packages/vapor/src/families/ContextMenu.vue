<script setup vapor lang="ts">
import { ContextMenuContent, ContextMenuItem, ContextMenuPortal, ContextMenuRoot, ContextMenuTrigger } from 'reka-ui'
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger id="cm-trigger">
      Right click
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent id="cm-content">
        <ContextMenuItem>Copy</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
