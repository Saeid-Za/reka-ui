<script setup vapor lang="ts">
import { MenubarContent, MenubarItem, MenubarMenu, MenubarPortal, MenubarRoot, MenubarTrigger } from 'reka-ui'
</script>

<template>
  <MenubarRoot id="mb">
    <MenubarMenu value="file">
      <MenubarTrigger id="mb-file">
        File
      </MenubarTrigger>
      <MenubarPortal>
        <MenubarContent id="mb-content">
          <MenubarItem>New</MenubarItem>
          <MenubarItem>Open</MenubarItem>
        </MenubarContent>
      </MenubarPortal>
    </MenubarMenu>
    <MenubarMenu value="edit">
      <MenubarTrigger id="mb-edit">
        Edit
      </MenubarTrigger>
    </MenubarMenu>
  </MenubarRoot>
</template>
