<script setup vapor lang="ts">
// Leak bisection probes for the interop memory finding (BENCHMARKS.md).
import { CheckboxRoot, Primitive, VisuallyHidden } from 'reka-ui'

defineProps<{ probe: string, checked: boolean }>()
</script>

<template>
  <Primitive
    v-if="probe === 'primitive'"
    as="button"
    class="probe"
  >
    x
  </Primitive>
  <Primitive
    v-else-if="probe === 'primitive-as-child'"
    as-child
    class="probe"
  >
    <button>x</button>
  </Primitive>
  <VisuallyHidden
    v-else-if="probe === 'visually-hidden'"
    class="probe"
  >
    x
  </VisuallyHidden>
  <CheckboxRoot
    v-else-if="probe === 'checkbox-root'"
    class="probe"
    :model-value="checked"
  />
</template>
