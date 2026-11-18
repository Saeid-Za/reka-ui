<script setup vapor lang="ts">
import { ListboxContent, ListboxItem, ListboxRoot } from 'reka-ui'
import { ref } from 'vue'

const value = ref<string>()
</script>

<template>
  <ListboxRoot v-model="value">
    <ListboxContent>
      <ListboxItem
        id="lb-a"
        value="a"
      >
        A
      </ListboxItem>
      <ListboxItem
        id="lb-b"
        value="b"
      >
        B
      </ListboxItem>
    </ListboxContent>
  </ListboxRoot>
  <span id="lb-value">{{ value }}</span>
</template>
