<script setup vapor lang="ts">
import { CalendarDate } from '@internationalized/date'
import { RangeCalendarCell, RangeCalendarCellTrigger, RangeCalendarGrid, RangeCalendarGridBody, RangeCalendarGridRow, RangeCalendarHeader, RangeCalendarHeading, RangeCalendarNext, RangeCalendarRoot } from 'reka-ui'

const placeholder = new CalendarDate(2024, 3, 1)
</script>

<template>
  <RangeCalendarRoot
    v-slot="{ grid }"
    :default-placeholder="placeholder"
    locale="en-US"
  >
    <RangeCalendarHeader>
      <RangeCalendarHeading id="rc-heading" />
      <RangeCalendarNext id="rc-next" />
    </RangeCalendarHeader>
    <RangeCalendarGrid
      v-for="month in grid"
      :key="month.value.toString()"
    >
      <RangeCalendarGridBody>
        <RangeCalendarGridRow
          v-for="(week, i) in month.rows"
          :key="i"
        >
          <RangeCalendarCell
            v-for="date in week"
            :key="date.toString()"
            :date="date"
          >
            <RangeCalendarCellTrigger
              :day="date"
              :month="month.value"
              class="rc-day"
            />
          </RangeCalendarCell>
        </RangeCalendarGridRow>
      </RangeCalendarGridBody>
    </RangeCalendarGrid>
  </RangeCalendarRoot>
</template>
