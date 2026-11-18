<script setup vapor lang="ts">
import { PinInputInput, PinInputRoot } from 'reka-ui'
</script>

<template>
  <PinInputRoot id="pin">
    <PinInputInput
      v-for="i in 4"
      :key="i"
      :index="i - 1"
      class="pin-cell"
    />
  </PinInputRoot>
</template>
