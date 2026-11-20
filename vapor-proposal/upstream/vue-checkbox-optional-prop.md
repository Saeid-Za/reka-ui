# Vue issue (not filed): optional props becoming `false` in Vapor

Status: **does not reproduce standalone. Do not file.**

Original observation (FIX_PLAN_8, U1): after moving `packages/vapor` to vue 3.6.0-rc.16, the
Checkbox story (`packages/core/src/Checkbox/story/_Checkbox.vue`, `defineProps<CheckboxRootProps>()`
then `v-bind="props"` on `CheckboxRoot`) passed `trueValue: false` and `falseValue: false`
to `CheckboxRoot`, overriding its `withDefaults`, so the box stayed checked.

Minimal check on 2026-11-20 (vue 3.6.0-rc.16, jsdom), same SFCs compiled once as Vapor and
once as VDOM:

- `defineProps<{ flag?: boolean }>()`, nothing passed: `flag` is `false` in **both** modes
  (Vue's Boolean casting).
- `interface P<T = boolean> { tv?: T }`, `defineProps<P>()`, nothing passed, then
  `v-bind="props"` onto a child with `withDefaults({ tv: () => 'DEFAULT' })`: the child
  renders `false` in **both** modes.

So plain Vue does the same thing in VDOM and Vapor. The story difference has to come from
how the story's props type is resolved (or from something in the old harness), not from a
Vapor-only props bug. The story keeps its small workaround (only forward `trueValue` /
`falseValue` when they differ), which is correct in both modes.

Re-verified on 2026-11-20 on a second machine (vue 3.6.0-rc.16, jsdom,
`packages/vapor/scratch/repro2/`, not committed): Vapor and VDOM both render
`{"tv":false}` / `false` for the generic optional prop, and `false` for the optional boolean.
Same result as above, so this stays **do not file**.

Upstream note: `unovue/reka-ui` `v2` fixed the same story on 2026-11-19 in 3b50f1742
(#3261, "preserve defaults when forwarding story props") by binding
`useForwardProps(props)` instead of `props`. When the PR stack is rebased onto current `v2`,
take upstream's version of `_Checkbox.vue` and drop ours (ours also carries a comment that
blames Vapor, which the check above shows is wrong).
