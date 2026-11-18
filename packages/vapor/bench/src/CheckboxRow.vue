<script setup vapor lang="ts">
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui'

defineProps<{ checked: boolean }>()
</script>

<template>
  <CheckboxRoot
    class="cb"
    :model-value="checked"
    aria-label="row"
  >
    <CheckboxIndicator>x</CheckboxIndicator>
  </CheckboxRoot>
</template>
