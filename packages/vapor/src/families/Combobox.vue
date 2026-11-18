<script setup vapor lang="ts">
import { ComboboxAnchor, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxRoot, ComboboxTrigger, ComboboxViewport } from 'reka-ui'
import { ref } from 'vue'

const value = ref<string>()
</script>

<template>
  <ComboboxRoot v-model="value">
    <ComboboxAnchor>
      <ComboboxInput id="cbx-input" />
      <ComboboxTrigger id="cbx-trigger">
        v
      </ComboboxTrigger>
    </ComboboxAnchor>
    <ComboboxContent>
      <ComboboxViewport>
        <ComboboxItem value="apple">
          Apple
        </ComboboxItem>
        <ComboboxItem value="banana">
          Banana
        </ComboboxItem>
      </ComboboxViewport>
    </ComboboxContent>
  </ComboboxRoot>
</template>
