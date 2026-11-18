<script setup vapor lang="ts">
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'
</script>

<template>
  <SplitterGroup
    id="sg"
    direction="horizontal"
    style="width: 400px"
  >
    <SplitterPanel
      id="sp-a"
      :default-size="30"
    >
      A
    </SplitterPanel>
    <SplitterResizeHandle id="sp-handle" />
    <SplitterPanel
      id="sp-b"
      :default-size="70"
    >
      B
    </SplitterPanel>
  </SplitterGroup>
</template>
