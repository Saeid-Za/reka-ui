<script setup vapor lang="ts">
import { NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuRoot, NavigationMenuTrigger, NavigationMenuViewport } from 'reka-ui'
</script>

<template>
  <NavigationMenuRoot id="nm">
    <NavigationMenuList>
      <NavigationMenuItem value="learn">
        <NavigationMenuTrigger id="nm-trigger">
          Learn
        </NavigationMenuTrigger>
        <NavigationMenuContent id="nm-content">
          <NavigationMenuLink href="#a">
            Docs
          </NavigationMenuLink>
        </NavigationMenuContent>
      </NavigationMenuItem>
      <NavigationMenuItem>
        <NavigationMenuLink
          id="nm-link"
          href="#b"
        >
          Blog
        </NavigationMenuLink>
      </NavigationMenuItem>
    </NavigationMenuList>
    <NavigationMenuViewport />
  </NavigationMenuRoot>
</template>
