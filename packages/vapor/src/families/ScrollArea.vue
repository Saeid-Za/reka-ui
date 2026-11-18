<script setup vapor lang="ts">
import { ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from 'reka-ui'
</script>

<template>
  <ScrollAreaRoot
    id="sa"
    type="always"
    style="height: 100px"
  >
    <ScrollAreaViewport id="sa-viewport">
      <div
        v-for="i in 20"
        :key="i"
      >
        Row {{ i }}
      </div>
    </ScrollAreaViewport>
    <ScrollAreaScrollbar orientation="vertical">
      <ScrollAreaThumb />
    </ScrollAreaScrollbar>
  </ScrollAreaRoot>
</template>
