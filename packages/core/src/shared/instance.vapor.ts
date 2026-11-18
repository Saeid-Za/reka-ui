// Vapor-only entry for instance access. Imported by the Vapor implementations
// of `Primitive` and `Presence` (and by a future `reka-ui/vapor` entry), never
// by the default VDOM build, so Vue < 3.6 never sees this import.
// @ts-expect-error `currentInstance` is a runtime export of Vue >= 3.6 that is not part of its public types.
import { currentInstance } from 'vue'
import { setVaporInstanceResolver } from './instance'

setVaporInstanceResolver(() => currentInstance)
