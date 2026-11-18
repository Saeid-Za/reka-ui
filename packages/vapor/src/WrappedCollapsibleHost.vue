<script setup vapor lang="ts">
import { ref } from 'vue'
import WrappedCollapsible from './WrappedCollapsible.vue'

const events = ref<boolean[]>([])
defineExpose({ events })
</script>

<template>
  <WrappedCollapsible
    :default-open="true"
    @update:open="events.push($event)"
  />
</template>
