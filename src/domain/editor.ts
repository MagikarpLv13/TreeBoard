import type { DecisionTree, TreeNode } from './model'

export function removeTreeNode(tree: DecisionTree, nodeId: string): DecisionTree {
  return { ...tree, nodes: tree.nodes.filter((node) => node.id !== nodeId), edges: tree.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId) }
}

export function pasteTreeNode(source: TreeNode, position: TreeNode['position']): TreeNode {
  return {
    ...source,
    id: crypto.randomUUID(),
    position,
    ...(source.choices ? { choices: source.choices.map((choice) => ({ ...choice, id: crypto.randomUUID() })) } : {}),
    ...(source.links ? { links: source.links.map((link) => ({ ...link, id: crypto.randomUUID() })) } : {}),
  }
}
