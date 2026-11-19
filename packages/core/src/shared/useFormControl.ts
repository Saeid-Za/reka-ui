import type { MaybeElementRef } from '@vueuse/core'
import { unrefElement } from '@vueuse/core'
import { computed, onMounted, shallowRef, toValue } from 'vue'
import { getInstance } from './instance'

export function useFormControl(el: MaybeElementRef) {
  // `closest('form')` is not reactive. In Vapor the element ref is set before the
  // component's nodes are inserted under the <form>, so read it again once mounted
  // (in VDOM the value is already right then, and the computed does not change).
  const mounted = shallowRef(false)
  if (getInstance())
    onMounted(() => { mounted.value = true })
  // We set this to true by default so that events bubble to forms without JS (SSR)
  return computed(() => {
    return toValue(el) && mounted.value ? Boolean(unrefElement(el)?.closest('form')) : true
  })
}
