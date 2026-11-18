<script setup lang="ts">
// Vapor implementation of `Primitive`.
//
// The VDOM `Primitive` (Primitive.ts) is a render function that clones the
// first slot vnode for `as-child`. Vapor has no vnodes, so this SFC renders
// the element with `<component :is>` and, for `as-child`, applies its attrs
// to the element the slot rendered. It is swapped in for `Primitive.ts` by the
// Vapor build (see packages/vapor) and is never imported by the VDOM build.
import type { PrimitiveProps } from './Primitive'
import { onMounted, onUpdated, useAttrs, watchEffect } from 'vue'
import { findBlockElement, getInstance } from '@/shared/instance'
import { applyAsChildAttrs } from './asChildAttrs'
import '@/shared/instance.vapor'

defineOptions({
  name: 'Primitive',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<PrimitiveProps>(), {
  as: 'div',
  asChild: false,
})

// For self closing tags, don't provide default slots because of hydration issue
const SELF_CLOSING_TAGS = ['area', 'img', 'input']

const attrs = useAttrs()
const instance = getInstance()

function rootElement() {
  return instance && 'block' in instance ? findBlockElement(instance.block) : undefined
}

// Match the VDOM component: a template ref on `Primitive` resolves to the
// element it rendered (for `as-child`, the slot's element) through `$el`.
defineExpose({
  get $el() {
    return rootElement()
  },
})

if (props.asChild) {
  let mounted = false
  const sync = () => {
    const el = rootElement()
    if (el)
      applyAsChildAttrs(el, attrs)
  }
  onMounted(() => {
    mounted = true
    sync()
  })
  onUpdated(sync)
  // attrs is reactive in Vapor: re-apply when the parent changes them.
  watchEffect(() => {
    // track every attr key and value
    for (const key in attrs)
      void attrs[key]
    if (mounted)
      sync()
  }, { flush: 'post' })
}
</script>

<template>
  <slot v-if="asChild" />
  <component
    :is="as"
    v-else-if="typeof as === 'string' && SELF_CLOSING_TAGS.includes(as)"
    v-bind="attrs"
  />
  <component
    :is="as"
    v-else
    v-bind="attrs"
  >
    <slot />
  </component>
</template>
