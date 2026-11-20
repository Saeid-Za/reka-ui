// When a FocusScope joins the focus-scope stack. Swapped for `stackTiming.vapor.ts` in
// the Vapor build (packages/vapor/rekaVapor.ts `VUE_VAPOR_TWINS`).
//
// VDOM: join once the container has rendered (after `nextTick` in the mount effect),
// so a scope that mounts hidden can still opt out through `present`.

/** Called synchronously in `setup`. */
export function joinStackInSetup(_join: () => void) {}

/** Called from the mount effect once the container exists. */
export function joinStackOnMount(join: () => void) {
  join()
}
