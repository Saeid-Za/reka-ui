<script setup vapor lang="ts">
import { TagsInputInput, TagsInputItem, TagsInputItemDelete, TagsInputItemText, TagsInputRoot } from 'reka-ui'
import { ref } from 'vue'

const tags = ref(['vue', 'vapor'])
</script>

<template>
  <TagsInputRoot v-model="tags">
    <TagsInputItem
      v-for="t in tags"
      :key="t"
      :value="t"
      class="tag"
    >
      <TagsInputItemText />
      <TagsInputItemDelete class="tag-del" />
    </TagsInputItem>
    <TagsInputInput id="tags-input" />
  </TagsInputRoot>
</template>
