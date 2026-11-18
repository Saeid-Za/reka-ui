<script setup vapor lang="ts">
import { TagGroupItem, TagGroupItemDelete, TagGroupItemText, TagGroupRoot } from 'reka-ui'
import { ref } from 'vue'

const tags = ref(['News', 'Travel'])
function onRemove(keys: unknown) {
  const removed = new Set(Array.isArray(keys) ? keys : [keys])
  tags.value = tags.value.filter(t => !removed.has(t))
}
</script>

<template>
  <TagGroupRoot
    id="tgr"
    aria-label="Categories"
    @remove="onRemove"
  >
    <TagGroupItem
      v-for="tag in tags"
      :key="tag"
      :value="tag"
      class="tg-item"
    >
      <TagGroupItemText>{{ tag }}</TagGroupItemText>
      <TagGroupItemDelete class="tg-del">
        x
      </TagGroupItemDelete>
    </TagGroupItem>
  </TagGroupRoot>
</template>
