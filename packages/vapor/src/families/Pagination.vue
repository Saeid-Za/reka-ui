<script setup vapor lang="ts">
import { PaginationList, PaginationListItem, PaginationNext, PaginationPrev, PaginationRoot } from 'reka-ui'
</script>

<template>
  <PaginationRoot
    :total="50"
    :items-per-page="10"
    :default-page="1"
  >
    <PaginationList v-slot="{ items }">
      <PaginationPrev id="pg-prev">
        ‹
      </PaginationPrev>
      <template
        v-for="(item, index) in items"
        :key="index"
      >
        <PaginationListItem
          v-if="item.type === 'page'"
          :value="item.value"
          class="pg-item"
        >
          {{ item.value }}
        </PaginationListItem>
      </template>
      <PaginationNext id="pg-next">
        ›
      </PaginationNext>
    </PaginationList>
  </PaginationRoot>
</template>
