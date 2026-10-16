import { describe, expect, it } from 'vitest'
import { createSession, moveToTree, nextNode } from './engine'
import { blankNode, DecisionTreeSchema, emailExample, type TreeNode } from './model'

function routedTree() {
  const tree = emailExample()
  tree.inputs = [{ id: 'secteur', label: 'Secteur', type: 'select', required: true, options: ['Détective privé', 'Cabinet d’avocats'] }]
  const router = { ...tree.nodes[1], answerInputId: 'secteur', choices: [
    { id: crypto.randomUUID(), label: 'Détective privé', value: 'Détective privé' },
    { id: crypto.randomUUID(), label: 'Cabinet d’avocats', value: 'Cabinet d’avocats' },
  ] }
  tree.nodes[1] = router
  tree.edges = tree.edges.map((edge) => ({ ...edge, choiceValue: edge.choiceValue === 'yes' ? 'Détective privé' : edge.choiceValue === 'no' ? 'Cabinet d’avocats' : undefined }))
  return { tree, router }
}

describe('réponses déjà fournies dans les données de départ', () => {
  it('conserve le lien vers la donnée lors de l’import JSON', () => {
    const { tree } = routedTree()
    expect(DecisionTreeSchema.parse(tree)).toEqual(tree)
  })

  it.each(['Détective privé', 'Cabinet d’avocats'])('suit directement le secteur %s après une étape', (secteur) => {
    const { tree } = routedTree()
    const expected = secteur === 'Détective privé' ? tree.nodes[2] : tree.nodes[3]
    expect(nextNode(tree, tree.nodes[0], undefined, { secteur })).toBe(expected)
  })

  it('résout aussi la première étape et les passages vers un autre arbre', () => {
    const { tree, router } = routedTree()
    tree.nodes.shift()
    tree.edges = tree.edges.filter((edge) => edge.source === router.id)
    expect(createSession(tree, { secteur: 'Cabinet d’avocats' }).currentNodeId).toBe(tree.nodes[2].id)
    const source = emailExample()
    expect(moveToTree(createSession(source, { secteur: 'Détective privé' }), tree).currentNodeId).toBe(tree.nodes[1].id)
  })

  it.each<Record<string, string>>([{}, { secteur: 'Inconnu' }])('laisse la question visible si la donnée ne correspond pas', (variables) => {
    const { tree, router } = routedTree()
    expect(nextNode(tree, tree.nodes[0], undefined, variables)).toBe(router)
  })

  it('laisse la question visible si sa destination est absente', () => {
    const { tree, router } = routedTree()
    tree.edges = tree.edges.filter((edge) => edge.choiceValue !== 'Détective privé')
    expect(nextNode(tree, tree.nodes[0], undefined, { secteur: 'Détective privé' })).toBe(router)
  })

  it('ne boucle pas indéfiniment entre deux questions automatiques', () => {
    const { tree, router } = routedTree()
    const other = { ...router, id: crypto.randomUUID() }
    tree.nodes.push(other)
    tree.edges.find((edge) => edge.source === router.id && edge.choiceValue === 'Détective privé')!.target = other.id
    tree.edges.push({ id: crypto.randomUUID(), source: other.id, target: router.id, choiceValue: 'Détective privé' })
    expect(nextNode(tree, tree.nodes[0], undefined, { secteur: 'Détective privé' })).toBe(router)
  })

  it('traverse plusieurs questions automatiques et un ancien nœud de départ', () => {
    const { tree, router } = routedTree()
    const second: TreeNode = { ...router, id: crypto.randomUUID() }
    const start = blankNode('start')
    tree.nodes.push(second, start)
    tree.edges.find((edge) => edge.source === router.id && edge.choiceValue === 'Détective privé')!.target = start.id
    tree.edges.push({ id: crypto.randomUUID(), source: start.id, target: second.id }, { id: crypto.randomUUID(), source: second.id, target: tree.nodes[2].id, choiceValue: 'Détective privé' })
    expect(nextNode(tree, tree.nodes[0], undefined, { secteur: 'Détective privé' })).toBe(tree.nodes[2])
  })
})
