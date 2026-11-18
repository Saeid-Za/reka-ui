<script setup vapor lang="ts">
import { AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogOverlay, AlertDialogPortal, AlertDialogRoot, AlertDialogTitle, AlertDialogTrigger } from 'reka-ui'
</script>

<template>
  <AlertDialogRoot>
    <AlertDialogTrigger id="ad-open">
      Delete
    </AlertDialogTrigger>
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogContent id="ad-content">
        <AlertDialogTitle>Sure?</AlertDialogTitle>
        <AlertDialogDescription>Cannot undo</AlertDialogDescription>
        <AlertDialogCancel id="ad-cancel">
          Cancel
        </AlertDialogCancel>
        <AlertDialogAction>OK</AlertDialogAction>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
