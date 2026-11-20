// @vapor-twin-of Collection.ts b62fda701777
import type { InjectionKey } from 'vue'
// Vapor implementation of `useCollection`.
//
// The VDOM version builds `CollectionSlot`/`CollectionItem` per call with
// `defineComponent` + `h(Slot)`. Vapor components cannot be created from a
// render function, so the two parts are SFCs; the calling component hands its
// collection context to them through `provide` (each component calls
// `useCollection` at most once, so the nearest provided context is its own).
// Swapped in for `Collection.ts` by the Vapor build.
import type { CollectionContext } from './collectionCore'
import { provide } from 'vue'
import { useCollectionContext } from './collectionCore'
import CollectionItem from './CollectionItem.vapor.vue'
import CollectionSlot from './CollectionSlot.vapor.vue'

export const CURRENT_COLLECTION: InjectionKey<CollectionContext<any>> = Symbol('RekaCurrentCollection')

export function useCollection<ItemData = {}>(options: { key?: string, isProvider?: boolean } = {}) {
  const { context, getItems, getItem, reactiveItems, itemMapSize } = useCollectionContext<ItemData>(options)
  provide(CURRENT_COLLECTION, context)
  return {
    getItems,
    getItem,
    reactiveItems,
    itemMapSize,
    CollectionSlot: CollectionSlot as typeof CollectionSlot,
    CollectionItem: CollectionItem as typeof CollectionItem,
  }
}
