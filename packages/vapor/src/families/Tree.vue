<script setup vapor lang="ts">
import { TreeItem, TreeRoot } from 'reka-ui'

const items = [{ id: 'a', children: [{ id: 'a1' }] }, { id: 'b' }]
</script>

<template>
  <TreeRoot
    v-slot="{ flattenItems }"
    :items="items"
    :get-key="(i: any) => i.id"
    :default-expanded="['a']"
  >
    <TreeItem
      v-for="item in flattenItems"
      :key="item._id"
      v-bind="item.bind"
      class="tree-item"
    >
      {{ item.value.id }}
    </TreeItem>
  </TreeRoot>
</template>
