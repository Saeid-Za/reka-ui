<script setup vapor lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { ref } from 'vue'

const open = ref(false)
</script>

<template>
  <CollapsibleRoot
    v-model:open="open"
    data-testid="root"
  >
    <CollapsibleTrigger as-child>
      <button
        id="trigger"
        class="trigger"
      >
        toggle
      </button>
    </CollapsibleTrigger>
    <CollapsibleContent id="content">
      secret
    </CollapsibleContent>
    <span id="state">{{ open ? 'open' : 'closed' }}</span>
  </CollapsibleRoot>
</template>
