<script setup vapor lang="ts">
import { CalendarCell, CalendarCellTrigger, CalendarGrid, CalendarGridBody, CalendarGridRow, CalendarHeader, CalendarHeading, CalendarNext, CalendarPrev, CalendarRoot } from 'reka-ui'
</script>

<template>
  <CalendarRoot
    id="cal"
    v-slot="{ grid }"
    :week-starts-on="0"
    locale="en"
  >
    <CalendarHeader>
      <CalendarPrev id="cal-prev" />
      <CalendarHeading id="cal-heading" />
      <CalendarNext id="cal-next" />
    </CalendarHeader>
    <CalendarGrid
      v-for="month in grid"
      :key="month.value.toString()"
    >
      <CalendarGridBody>
        <CalendarGridRow
          v-for="(week, i) in month.rows"
          :key="i"
        >
          <CalendarCell
            v-for="d in week"
            :key="d.toString()"
            :date="d"
          >
            <CalendarCellTrigger
              :day="d"
              :month="month.value"
              class="cal-day"
            />
          </CalendarCell>
        </CalendarGridRow>
      </CalendarGridBody>
    </CalendarGrid>
  </CalendarRoot>
</template>
