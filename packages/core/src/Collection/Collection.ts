import { defineComponent, h, markRaw, onBeforeUnmount, watch, watchEffect } from 'vue'
import { Slot, usePrimitiveElement } from '@/Primitive'
import { ITEM_DATA_ATTR, useCollectionContext } from './collectionCore'

export function useCollection<ItemData = {}>(options: { key?: string, isProvider?: boolean } = {}) {
  const { context, getItems, getItem, reactiveItems, itemMapSize } = useCollectionContext<ItemData>(options)

  const CollectionSlot = defineComponent({
    name: 'CollectionSlot',
    inheritAttrs: false,
    setup(_, { slots, attrs }) {
      const { primitiveElement, currentElement } = usePrimitiveElement()
      watch(currentElement, () => {
        context.collectionRef.value = currentElement.value
      })
      // The watcher stops on unmount, before the element ref clears, so a provider that
      // outlives this slot would keep the detached element. Only clear our own registration.
      onBeforeUnmount(() => {
        if (context.collectionRef.value === currentElement.value)
          context.collectionRef.value = undefined
      })
      return () => h(Slot, { ref: primitiveElement, ...attrs }, slots)
    },
  })

  const CollectionItem = defineComponent({
    name: 'CollectionItem',
    inheritAttrs: false,
    props: {
      value: {
        // It accepts any value
        validator: () => true,
      },
    },
    setup(props, { slots, attrs }) {
      const { primitiveElement, currentElement } = usePrimitiveElement()

      watchEffect((cleanupFn) => {
        if (currentElement.value) {
          const key = markRaw(currentElement.value)
          // @ts-expect-error ignore assignment of unknown to any
          context.itemMap.value.set(key, { ref: currentElement.value!, value: props.value })
          cleanupFn(() => context.itemMap.value.delete(key))
        }
      })

      return () => h(Slot, { ...attrs, [ITEM_DATA_ATTR]: '', ref: primitiveElement }, slots)
    },
  })

  return { getItems, getItem, reactiveItems, itemMapSize, CollectionSlot, CollectionItem }
}
