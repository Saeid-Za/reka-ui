# reka-ui / Vapor — user guide draft

Draft for a future docs PR (not published with this branch).

## Migration: `useForwardExpose` under Vapor

In Vapor mode, component refs do not expose a synthetic `$el` on the child instance. Components
that Reka forwards refs to (via `useForwardExpose`, `forwardRef`, and similar) must call
`defineExpose({ $el })` (or expose a getter for `$el`) on their root element when running as Vapor
components. See QS9 in `OPEN_QUESTIONS.md`.
