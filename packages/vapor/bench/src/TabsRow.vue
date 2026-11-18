<script setup vapor lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

defineProps<{ second: boolean }>()
</script>

<template>
  <TabsRoot :model-value="second ? 'b' : 'a'">
    <TabsList aria-label="tabs">
      <TabsTrigger value="a">
        A
      </TabsTrigger>
      <TabsTrigger value="b">
        B
      </TabsTrigger>
      <TabsTrigger value="c">
        C
      </TabsTrigger>
    </TabsList>
    <TabsContent value="a">
      Panel A
    </TabsContent>
    <TabsContent value="b">
      Panel B
    </TabsContent>
    <TabsContent value="c">
      Panel C
    </TabsContent>
  </TabsRoot>
</template>
