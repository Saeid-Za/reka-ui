<script setup lang="ts">
// Pure-Vapor stand-in for `@iconify/vue`'s <Icon> in the full-suite run.
// Iconify's component is an Options-API VDOM component, so it cannot render in
// pure Vapor. The story fixtures only use it for decoration, and in jsdom (no
// icon data, no network) Iconify renders its empty 16x16 placeholder <svg>;
// this renders the same placeholder.
defineProps<{ icon?: string | object, inline?: boolean, ssr?: boolean, width?: string | number, height?: string | number }>()
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    aria-hidden="true"
    role="img"
    width="1em"
    height="1em"
    viewBox="0 0 16 16"
  />
</template>
