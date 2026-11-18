export { renderToString } from './ssr'
// `@vue/server-renderer` for the full-suite run: the real one, with `renderToString`
// taking the suite's Vapor SSR apps (ssr.ts). Server-compiled Reka modules import
// their `ssrRender*` helpers from here too.
export * from 'vapor-suite:real-server-renderer'
