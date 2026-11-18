<script setup vapor lang="ts">
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'
</script>

<template>
  <SliderRoot
    :default-value="[50]"
    :max="100"
    :step="1"
  >
    <SliderTrack><SliderRange /></SliderTrack>
    <SliderThumb
      id="slider-thumb"
      aria-label="vol"
    />
  </SliderRoot>
</template>
