<script setup vapor lang="ts">
import { Time } from '@internationalized/date'
import { TimeFieldInput, TimeFieldRoot } from 'reka-ui'

const value = new Time(9, 30)
</script>

<template>
  <TimeFieldRoot
    id="tf"
    v-slot="{ segments }"
    :default-value="value"
    locale="en-US"
  >
    <template
      v-for="item in segments"
      :key="item.part"
    >
      <TimeFieldInput
        :part="item.part"
        class="tf-seg"
        :data-part="item.part"
      >
        {{ item.value }}
      </TimeFieldInput>
    </template>
  </TimeFieldRoot>
</template>
