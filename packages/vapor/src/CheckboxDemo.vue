<script setup vapor lang="ts">
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui'
import { ref } from 'vue'

const checked = ref<boolean | 'indeterminate'>(false)
</script>

<template>
  <CheckboxRoot
    id="cb"
    v-model="checked"
    aria-label="accept"
  >
    <CheckboxIndicator id="indicator">
      ✓
    </CheckboxIndicator>
  </CheckboxRoot>
  <span id="value">{{ String(checked) }}</span>
</template>
