<script setup vapor lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'

defineProps<{ open: boolean }>()
</script>

<template>
  <CollapsibleRoot :open="open">
    <CollapsibleTrigger class="col-trigger">
      Toggle
    </CollapsibleTrigger>
    <CollapsibleContent class="col-content">
      Content
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
