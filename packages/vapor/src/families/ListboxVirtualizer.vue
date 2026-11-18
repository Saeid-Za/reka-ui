<script setup vapor lang="ts">
import { ListboxContent, ListboxItem, ListboxRoot, ListboxVirtualizer } from 'reka-ui'

const options = Array.from({ length: 100 }, (_, i) => ({ label: `Item ${i}`, value: i }))
</script>

<template>
  <ListboxRoot id="lbv">
    <ListboxContent style="height: 200px; overflow: auto">
      <ListboxVirtualizer
        v-slot="{ option }"
        :options="options"
        :text-content="(o: any) => o.label"
      >
        <ListboxItem
          :value="option"
          class="lbv-item"
        >
          {{ option.label }}
        </ListboxItem>
      </ListboxVirtualizer>
    </ListboxContent>
  </ListboxRoot>
</template>
