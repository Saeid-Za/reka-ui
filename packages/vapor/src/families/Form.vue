<script setup vapor lang="ts">
import { FieldControl, FieldError, FieldLabel, FieldRoot, FormRoot } from 'reka-ui'
</script>

<template>
  <FormRoot
    id="form"
    :errors="{ email: 'Taken' }"
  >
    <FieldRoot name="email">
      <FieldLabel>Email</FieldLabel>
      <FieldControl
        id="form-email"
        type="email"
      />
      <FieldError id="form-error" />
    </FieldRoot>
  </FormRoot>
</template>
