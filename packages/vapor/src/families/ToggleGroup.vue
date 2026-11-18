<script setup vapor lang="ts">
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'
</script>

<template>
  <ToggleGroupRoot
    type="single"
    default-value="l"
  >
    <ToggleGroupItem
      id="tg-l"
      value="l"
    >
      L
    </ToggleGroupItem>
    <ToggleGroupItem
      id="tg-r"
      value="r"
    >
      R
    </ToggleGroupItem>
  </ToggleGroupRoot>
</template>
