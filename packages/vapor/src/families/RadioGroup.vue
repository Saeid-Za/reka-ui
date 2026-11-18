<script setup vapor lang="ts">
import { RadioGroupIndicator, RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { ref } from 'vue'

const value = ref('a')
</script>

<template>
  <RadioGroupRoot v-model="value">
    <RadioGroupItem
      id="rg-a"
      value="a"
    >
      <RadioGroupIndicator />
    </RadioGroupItem>
    <RadioGroupItem
      id="rg-b"
      value="b"
    >
      <RadioGroupIndicator />
    </RadioGroupItem>
  </RadioGroupRoot>
  <span id="rg-value">{{ value }}</span>
</template>
