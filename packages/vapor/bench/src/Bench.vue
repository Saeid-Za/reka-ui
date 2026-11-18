<script setup vapor lang="ts">
import CheckboxRow from './CheckboxRow.vue'
import CollapsibleRow from './CollapsibleRow.vue'
import DialogCase from './DialogCase.vue'
import PlainExposeOriginalRow from './PlainExposeOriginalRow.vue'
import PlainExposeRow from './PlainExposeRow.vue'
import PlainFnRefRow from './PlainFnRefRow.vue'
import PlainFragmentRow from './PlainFragmentRow.vue'
import PlainOnUpdatedRow from './PlainOnUpdatedRow.vue'
import PlainRow from './PlainRow.vue'
import PlainSlotRow from './PlainSlotRow.vue'
import PlainVModelRow from './PlainVModelRow.vue'
import PopoverCase from './PopoverCase.vue'
import ProbeRow from './ProbeRow.vue'
import { state } from './state'
import TabsRow from './TabsRow.vue'
</script>

<template>
  <div id="bench">
    <template v-if="state.scenario === 'checkbox'">
      <CheckboxRow
        v-for="i in state.count"
        :key="i"
        :checked="state.on"
      />
    </template>
    <template v-else-if="state.scenario === 'collapsible'">
      <CollapsibleRow
        v-for="i in state.count"
        :key="i"
        :open="state.on"
      />
    </template>
    <template v-else-if="state.scenario === 'tabs'">
      <TabsRow
        v-for="i in state.count"
        :key="i"
        :second="state.on"
      />
    </template>
    <template v-else-if="state.scenario === 'dialog'">
      <DialogCase
        v-for="i in state.count"
        :key="i"
        :open="state.on"
      />
    </template>
    <template v-else-if="state.scenario === 'plain'">
      <PlainRow
        v-for="i in state.count"
        :key="i"
        :checked="state.on"
      />
    </template>
    <template v-else-if="state.scenario === 'plain-fragment'">
      <PlainFragmentRow
        v-for="i in state.count"
        :key="i"
        :checked="state.on"
      />
    </template>
    <template v-else-if="state.scenario === 'plain-vmodel'">
      <PlainVModelRow
        v-for="i in state.count"
        :key="i"
        :model-value="state.on"
      />
    </template>
    <template v-else-if="state.scenario === 'plain-expose'">
      <PlainExposeRow
        v-for="i in state.count"
        :key="i"
        :checked="state.on"
      />
    </template>
    <template v-else-if="state.scenario === 'plain-expose-original'">
      <PlainExposeOriginalRow
        v-for="i in state.count"
        :key="i"
        :checked="state.on"
      />
    </template>
    <template v-else-if="state.scenario === 'plain-onupdated'">
      <PlainOnUpdatedRow
        v-for="i in state.count"
        :key="i"
        :checked="state.on"
      />
    </template>
    <template v-else-if="state.scenario === 'plain-fnref'">
      <PlainFnRefRow
        v-for="i in state.count"
        :key="i"
        :checked="state.on"
      />
    </template>
    <template v-else-if="state.scenario === 'plain-slot'">
      <PlainSlotRow
        v-for="i in state.count"
        :key="i"
        :checked="state.on"
      >
        x
      </PlainSlotRow>
    </template>
    <template v-else-if="state.scenario.startsWith('probe:')">
      <ProbeRow
        v-for="i in state.count"
        :key="i"
        :probe="state.scenario.slice(6)"
        :checked="state.on"
      />
    </template>
    <template v-else-if="state.scenario === 'popover'">
      <PopoverCase
        v-for="i in state.count"
        :key="i"
        :open="state.on"
      />
    </template>
  </div>
</template>
