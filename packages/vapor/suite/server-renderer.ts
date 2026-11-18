import { VaporSuiteUnsupported } from './shared'

// Server rendering is out of scope for the pure-Vapor client run: Reka's SFCs
// are compiled for the Vapor client here, and Vapor SSR/hydration is a separate
// target (OPEN_QUESTIONS Q11). Fail loudly so these tests are classified `ssr`.
export function renderToString(): never {
  throw new VaporSuiteUnsupported('SSR renderToString (Vapor SSR is out of scope, Q11)')
}
export const renderToNodeStream = renderToString
export const renderToWebStream = renderToString
export const pipeToNodeWritable = renderToString
export const pipeToWebWritable = renderToString
export const renderToSimpleStream = renderToString
