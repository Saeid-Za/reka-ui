<script setup vapor lang="ts">
import { AvatarFallback, AvatarImage, AvatarRoot } from 'reka-ui'
</script>

<template>
  <AvatarRoot id="avatar">
    <AvatarImage
      src=""
      alt="me"
    />
    <AvatarFallback id="avatar-fallback">
      SC
    </AvatarFallback>
  </AvatarRoot>
</template>
