<script setup vapor lang="ts">
import { StepperItem, StepperRoot, StepperTitle, StepperTrigger } from 'reka-ui'
</script>

<template>
  <StepperRoot :default-value="1">
    <StepperItem
      v-for="s in 3"
      :key="s"
      :step="s"
    >
      <StepperTrigger :id="`step-${s}`">
        <StepperTitle>Step {{ s }}</StepperTitle>
      </StepperTrigger>
    </StepperItem>
  </StepperRoot>
</template>
