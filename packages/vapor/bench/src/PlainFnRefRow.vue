<script setup lang="ts">
// Deliberately NOT `vapor`: VDOM component with a function template ref and a
// replaced `exposed` object, the two other things useForwardExpose does. Leak bisection.
import { getCurrentInstance, shallowRef } from 'vue'

defineProps<{ checked: boolean }>()
const el = shallowRef<Element | null>(null)
function setEl(value: any) { el.value = value }
const instance = getCurrentInstance()!
instance.exposed = { get $el() { return el.value } }
</script>

<template>
  <button
    :ref="setEl"
    class="plain-fnref"
    type="button"
    :aria-pressed="checked"
  >
    x
  </button>
</template>
