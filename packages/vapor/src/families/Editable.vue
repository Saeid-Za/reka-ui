<script setup vapor lang="ts">
import { EditableArea, EditableEditTrigger, EditableInput, EditablePreview, EditableRoot } from 'reka-ui'
</script>

<template>
  <EditableRoot default-value="hello">
    <EditableArea>
      <EditablePreview id="ed-preview" />
      <EditableInput id="ed-input" />
    </EditableArea>
    <EditableEditTrigger id="ed-edit">
      Edit
    </EditableEditTrigger>
  </EditableRoot>
</template>
