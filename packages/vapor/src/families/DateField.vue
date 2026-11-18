<script setup vapor lang="ts">
import { CalendarDate } from '@internationalized/date'
import { DateFieldInput, DateFieldRoot } from 'reka-ui'

const value = new CalendarDate(2024, 3, 15)
</script>

<template>
  <DateFieldRoot
    id="df"
    v-slot="{ segments }"
    :default-value="value"
    locale="en-US"
  >
    <template
      v-for="item in segments"
      :key="item.part"
    >
      <DateFieldInput
        :part="item.part"
        class="df-seg"
        :data-part="item.part"
      >
        {{ item.value }}
      </DateFieldInput>
    </template>
  </DateFieldRoot>
</template>
