<script setup lang="ts">
import { ListboxContent, ListboxItem, ListboxRoot, ListboxVirtualizer } from 'reka-ui'

const options = Array.from({ length: 10000 }, (_, i) => ({ label: `Item ${i}`, value: i }))
</script>

<template>
  <ListboxRoot>
    <ListboxContent
      class="listbox-virtual-content"
      style="height: 200px; overflow: auto"
    >
      <ListboxVirtualizer
        :options="options"
        :text-content="(o: { label: string }) => o.label"
      >
        <template #default="{ option }">
          <ListboxItem :value="option">
            {{ option.label }}
          </ListboxItem>
        </template>
      </ListboxVirtualizer>
    </ListboxContent>
  </ListboxRoot>
</template>
