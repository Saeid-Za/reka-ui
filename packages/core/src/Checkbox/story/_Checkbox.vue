<script setup lang="ts">
import type { CheckboxRootProps } from '..'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { CheckboxIndicator, CheckboxRoot } from '..'

const props = defineProps<CheckboxRootProps>()
const modelValue = ref(props.modelValue)

// Vapor SFC `defineProps` (Vue 3.6.0-rc.16+) can materialize omitted optional props as
// `false`. Spreading them onto CheckboxRoot overrides withDefaults so trueValue and
// falseValue both become false and isEqual keeps the box checked forever.
const rootAttrs = computed(() => {
  const { modelValue: _modelValue, trueValue, falseValue, ...rest } = props
  const bind: Record<string, unknown> = { ...rest }
  if (!Object.is(trueValue, falseValue)) {
    bind.trueValue = trueValue
    bind.falseValue = falseValue
  }
  return bind
})
</script>

<template>
  <label
    class="flex flex-row gap-4 items-center [&>.checkbox]:hover:bg-neutral-100"
    for="test"
  >
    Test
  </label>
  <CheckboxRoot
    v-bind="rootAttrs"
    v-model="modelValue"
    name="test"
    class="shadow-blackA7 hover:bg-violet3 flex h-[25px] w-[25px] appearance-none items-center justify-center rounded-[4px] bg-white shadow-[0_2px_10px] outline-none focus-within:shadow-[0_0_0_2px_black]"
    aria-label="Test"
  >
    <CheckboxIndicator
      data-testid="test-indicator"
      class="bg-white h-full w-full rounded flex items-center justify-center"
    >
      <Icon
        icon="radix-icons:check"
        class="h-3 w-3 text-black"
      />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
