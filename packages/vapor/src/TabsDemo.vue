<script setup vapor lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { ref } from 'vue'

const tab = ref('a')
</script>

<template>
  <TabsRoot v-model="tab">
    <TabsList aria-label="tabs">
      <TabsTrigger
        id="tab-a"
        value="a"
      >
        A
      </TabsTrigger>
      <TabsTrigger
        id="tab-b"
        value="b"
      >
        B
      </TabsTrigger>
    </TabsList>
    <TabsContent
      id="panel-a"
      value="a"
    >
      Panel A
    </TabsContent>
    <TabsContent
      id="panel-b"
      value="b"
    >
      Panel B
    </TabsContent>
  </TabsRoot>
</template>
