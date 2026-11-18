import type { Ref } from 'vue'
import { computed, inject, provide, ref } from 'vue'

// Rendering-agnostic part of `useCollection`, shared by the VDOM (`Collection.ts`)
// and Vapor (`Collection.vapor.ts`) implementations.

export interface CollectionContext<ItemData = {}> {
  collectionRef: Ref<HTMLElement | undefined>
  itemMap: Ref<Map<HTMLElement, { ref: HTMLElement, value?: any } & ItemData>>
}

export const ITEM_DATA_ATTR = 'data-reka-collection-item'

export function useCollectionContext<ItemData = {}>(options: { key?: string, isProvider?: boolean } = {}) {
  const { key = '', isProvider = false } = options
  const injectionKey = `${key}CollectionProvider`
  let context: CollectionContext<ItemData>

  if (isProvider) {
    const itemMap = ref<Map<HTMLElement, { ref: HTMLElement } & ItemData>>(new Map())
    const collectionRef = ref<HTMLElement>()

    context = {
      collectionRef,
      itemMap,
    } as CollectionContext<ItemData>
    provide(injectionKey, context)
  }
  else {
    context = inject(injectionKey) as CollectionContext<ItemData>
  }
  const getItem = (element: HTMLElement, includeDisabledItem = false) => {
    if (!context.collectionRef.value)
      return undefined

    const item = context.itemMap.value.get(element)
    return item && (includeDisabledItem || item.ref.dataset.disabled !== '') ? item : undefined
  }

  const getItems = (includeDisabledItem = false) => {
    const collectionNode = context.collectionRef.value
    if (!collectionNode)
      return []
    const orderedNodes = Array.from(collectionNode.querySelectorAll(`[${ITEM_DATA_ATTR}]`))
    const orderMap = new Map(orderedNodes.map((node, index) => [node, index]))
    const items = Array.from(context.itemMap.value.values())
    const orderedItems = items.sort(
      (a, b) => (orderMap.get(a.ref) ?? -1) - (orderMap.get(b.ref) ?? -1),
    )

    if (includeDisabledItem)
      return orderedItems
    else
      return orderedItems.filter(i => i.ref.dataset.disabled !== '')
  }

  const reactiveItems = computed(() => Array.from(context.itemMap.value.values()))
  const itemMapSize = computed(() => context.itemMap.value.size)

  return { context, getItems, getItem, reactiveItems, itemMapSize }
}
