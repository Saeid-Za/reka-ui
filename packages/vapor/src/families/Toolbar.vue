<script setup vapor lang="ts">
import { ToolbarButton, ToolbarRoot, ToolbarSeparator } from 'reka-ui'
</script>

<template>
  <ToolbarRoot
    id="toolbar"
    aria-label="tools"
  >
    <ToolbarButton id="tb-1">
      One
    </ToolbarButton>
    <ToolbarSeparator />
    <ToolbarButton id="tb-2">
      Two
    </ToolbarButton>
  </ToolbarRoot>
</template>
