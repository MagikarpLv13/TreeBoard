import { describe, expect, it } from 'vitest'
import { pasteTreeNode, removeTreeNode } from './editor'
import { emailExample } from './model'

describe('opérations de l’éditeur', () => {
  it('supprime un nœud et toutes ses connexions', () => {
    const tree = emailExample()
    const node = tree.nodes[1]
    const next = removeTreeNode(tree, node.id)
    expect(next.nodes.some((item) => item.id === node.id)).toBe(false)
    expect(next.edges.some((edge) => edge.source === node.id || edge.target === node.id)).toBe(false)
  })

  it('colle un nœud avec de nouveaux identifiants internes', () => {
    const source = emailExample().nodes.find((node) => node.kind === 'question')!
    const pasted = pasteTreeNode(source, { x: 420, y: 180 })
    expect(pasted.id).not.toBe(source.id)
    expect(pasted.position).toEqual({ x: 420, y: 180 })
    expect(pasted.choices?.map((choice) => choice.id)).not.toEqual(source.choices?.map((choice) => choice.id))
  })
})
