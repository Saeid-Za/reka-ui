<script setup vapor lang="ts">
import { Presence } from 'reka-ui'
import { ref } from 'vue'

const present = ref(true)
const tone = ref('a')
defineExpose({ present, tone })
</script>

<template>
  <Presence
    :present="present"
    :data-tone="tone"
  >
    <div id="pres">
      x
    </div>
  </Presence>
</template>
