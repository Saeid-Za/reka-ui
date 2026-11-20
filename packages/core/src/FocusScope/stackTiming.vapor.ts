// @vapor-twin-of stackTiming.ts 6237b0985c36
// Vapor variant of `stackTiming.ts`. Vapor mounts children and runs their mount-time
// focus before the parent's post-`nextTick` effect, so a scope that waited would let
// content inside it (e.g. a Combobox input in a trapped Dialog) focus while the outer
// trap is still active, and the outer trap pulls focus back (QS15, #2749). Join in
// `setup` instead, in render order, and not again on mount (that would reorder
// nested scopes).

export function joinStackInSetup(join: () => void) {
  join()
}

export function joinStackOnMount(_join: () => void) {}
