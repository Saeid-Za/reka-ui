<script setup vapor lang="ts">
import { SelectContent, SelectItem, SelectItemText, SelectPortal, SelectRoot, SelectTrigger, SelectValue, SelectViewport } from 'reka-ui'
import { ref } from 'vue'

const value = ref('a')
</script>

<template>
  <SelectRoot v-model="value">
    <SelectTrigger
      id="sel-trigger"
      aria-label="fruit"
    >
      <SelectValue />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent>
        <SelectViewport>
          <SelectItem value="a">
            <SelectItemText>Apple</SelectItemText>
          </SelectItem>
          <SelectItem value="b">
            <SelectItemText>Banana</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
