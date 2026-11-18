<script setup vapor lang="ts">
import { RatingItem, RatingItemIndicator, RatingRoot } from 'reka-ui'
import { ref } from 'vue'

const value = ref(2)
</script>

<template>
  <RatingRoot
    id="rating"
    v-slot="{ items }"
    v-model="value"
    :length="5"
    orientation="vertical"
  >
    <RatingItem
      v-for="item in items"
      :key="item"
      v-slot="{ steps }"
      :item="item"
      class="rating-item"
    >
      <RatingItemIndicator
        v-for="step in steps"
        :key="step"
        :step="step"
        :aria-label="`Rating ${step}`"
      >
        *
      </RatingItemIndicator>
    </RatingItem>
  </RatingRoot>
  <span id="rating-value">{{ value }}</span>
</template>
