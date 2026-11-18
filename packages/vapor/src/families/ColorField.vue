<script setup vapor lang="ts">
import { ColorFieldInput, ColorFieldRoot } from 'reka-ui'
</script>

<template>
  <ColorFieldRoot
    id="cf"
    default-value="#7f007f"
  >
    <ColorFieldInput id="cf-input" />
  </ColorFieldRoot>
</template>
