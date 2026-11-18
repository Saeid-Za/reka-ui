<script setup lang="ts">
// Deliberately NOT `vapor`: VDOM component using VueUse's useVModel (as CheckboxRoot does).
import { useVModel } from '@vueuse/core'

const props = defineProps<{ modelValue?: boolean }>()
const emits = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const value = useVModel(props, 'modelValue', emits, { passive: (props.modelValue === undefined) as false, defaultValue: false })
</script>

<template>
  <button
    class="plain-vmodel"
    type="button"
    :aria-pressed="value"
  >
    x
  </button>
</template>
