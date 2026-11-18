<script setup vapor lang="ts">
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger id="dd-trigger">
      Menu
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent id="dd-content">
        <DropdownMenuItem>One</DropdownMenuItem>
        <DropdownMenuItem>Two</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
