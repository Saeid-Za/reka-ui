<script setup vapor lang="ts">
import { ColorSliderRoot, ColorSliderThumb, ColorSliderTrack } from 'reka-ui'
</script>

<template>
  <ColorSliderRoot
    id="cs"
    default-value="hsl(120, 100%, 50%)"
    channel="hue"
  >
    <ColorSliderTrack />
    <ColorSliderThumb id="cs-thumb" />
  </ColorSliderRoot>
</template>
