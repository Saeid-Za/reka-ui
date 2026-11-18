<script setup vapor lang="ts">
import { AccordionContent, AccordionHeader, AccordionItem, AccordionRoot, AccordionTrigger } from 'reka-ui'
</script>

<template>
  <AccordionRoot
    type="single"
    collapsible
  >
    <AccordionItem value="a">
      <AccordionHeader>
        <AccordionTrigger id="acc-a">
          A
        </AccordionTrigger>
      </AccordionHeader>
      <AccordionContent id="acc-a-content">
        Content A
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="b">
      <AccordionHeader>
        <AccordionTrigger id="acc-b">
          B
        </AccordionTrigger>
      </AccordionHeader>
      <AccordionContent>Content B</AccordionContent>
    </AccordionItem>
  </AccordionRoot>
</template>
