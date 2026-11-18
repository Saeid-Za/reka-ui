import { isFragment, isVaporComponent } from 'vue'

export class VaporSuiteUnsupported extends Error {
  constructor(what: string) {
    super(`[vapor-suite] unsupported in pure Vapor: ${what}`)
    this.name = 'VaporSuiteUnsupported'
  }
}

/** DOM nodes a Vapor block currently renders, in document order. */
export function blockNodes(block: any): Node[] {
  if (!block)
    return []
  if (block instanceof Node)
    return [block]
  if (Array.isArray(block))
    return block.flatMap(blockNodes)
  if (isVaporComponent(block))
    return blockNodes((block as any).block)
  if (isFragment(block)) {
    const nodes = blockNodes((block as any).nodes)
    const anchor = (block as any).anchor
    return anchor instanceof Node && anchor.parentNode ? [...nodes, anchor] : nodes
  }
  return []
}
