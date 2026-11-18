<script setup vapor lang="ts">
import { ProgressIndicator, ProgressRoot } from 'reka-ui'
</script>

<template>
  <ProgressRoot
    id="progress"
    :model-value="40"
  >
    <ProgressIndicator />
  </ProgressRoot>
</template>
