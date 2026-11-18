<script setup vapor lang="ts">
import { NumberFieldDecrement, NumberFieldIncrement, NumberFieldInput, NumberFieldRoot } from 'reka-ui'
</script>

<template>
  <NumberFieldRoot :default-value="5">
    <NumberFieldDecrement id="nf-dec">
      -
    </NumberFieldDecrement>
    <NumberFieldInput id="nf-input" />
    <NumberFieldIncrement id="nf-inc">
      +
    </NumberFieldIncrement>
  </NumberFieldRoot>
</template>
