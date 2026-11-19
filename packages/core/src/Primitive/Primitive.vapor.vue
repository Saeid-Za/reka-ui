<script setup lang="ts">
// Vapor implementation of `Primitive`.
//
// The VDOM `Primitive` (Primitive.ts) is a render function that clones the
// first slot vnode for `as-child`. Vapor has no vnodes, so this SFC renders
// the element with `<component :is>` and, for `as-child`, applies its attrs
// to the element the slot rendered. It is swapped in for `Primitive.ts` by the
// Vapor build (see packages/vapor) and is never imported by the VDOM build.
import type { PrimitiveProps } from './Primitive'
import { onMounted, onUnmounted, onUpdated, shallowRef, useAttrs, watchEffect } from 'vue'
import { findBlockElement, getInstance, onRootFragmentUpdate } from '@/shared/instance'
import { createAsChildApplier, resolveAsChildTarget } from './asChildAttrs'
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

// Like the VDOM `Primitive`: `as="template"` renders as-child too. Read once, as there.
const renderAsChild = props.asChild || props.as === 'template'

function rootElement() {
  return instance && 'block' in instance ? findBlockElement(instance.block) : undefined
}

// Bumped when the slot swaps the element an `as-child` Primitive renders. A slot's
// `v-if`/`v-for` updates in the slot owner's render effects, so `onUpdated` here does
// not run for it, and refs that resolve `$el` would keep the old element.
const rootVersion = shallowRef(0)

// Match the VDOM component: a template ref on `Primitive` resolves to the
// element it rendered (for `as-child`, the slot's element) through `$el`.
defineExpose({
  get $el() {
    void rootVersion.value
    return rootElement()
  },
})

if (renderAsChild) {
  let mounted = false
  let observedWrapper: HTMLElement | null = null
  let wrapperObserver: MutationObserver | undefined
  const applyAsChildAttrs = createAsChildApplier()
  const sync = () => {
    const el = rootElement()
    if (el) {
      applyAsChildAttrs(resolveAsChildTarget(el), attrs)
      if (el.hasAttribute('data-reka-popper-content-wrapper') && el !== observedWrapper) {
        observedWrapper = el
        wrapperObserver?.disconnect()
        wrapperObserver ??= new MutationObserver(sync)
        wrapperObserver.observe(el, { childList: true })
      }
    }
  }
  const onRootUpdate = () => {
    sync()
    rootVersion.value++
    onRootFragmentUpdate(instance, onRootUpdate)
  }
  onMounted(() => {
    mounted = true
    sync()
    onRootFragmentUpdate(instance, onRootUpdate)
  })
  onUpdated(sync)
  onUnmounted(() => {
    wrapperObserver?.disconnect()
  })
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
  <slot v-if="renderAsChild" />
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
