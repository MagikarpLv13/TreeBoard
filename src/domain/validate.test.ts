import { describe, expect, it } from 'vitest'
import { blankTree, emailExample } from './model'
import { validateTree } from './validate'
describe('validation des arbres', () => {
  it('détecte une absence de conclusion', () => expect(validateTree(blankTree()).some((issue) => issue.message.includes('conclusion'))).toBe(true))
  it('accepte une première étape sans nœud de départ', () => expect(validateTree(emailExample()).some((issue) => issue.message.includes('première étape'))).toBe(false))
  it('détecte les étapes inaccessibles', () => { const tree = emailExample(); tree.nodes.push({ ...tree.nodes[1], id: crypto.randomUUID(), title: 'Isolé' }); expect(validateTree(tree).some((issue) => issue.message.includes('inaccessible'))).toBe(true) })
  it('demande de relier chaque réponse de question', () => { const tree = emailExample(); tree.edges = tree.edges.filter((edge) => edge.choiceValue !== 'no'); expect(validateTree(tree).some((issue) => issue.message.includes('Non concluant'))).toBe(true) })
  it('détecte les identifiants de chemin en doublon', () => { const tree = emailExample(); const question = tree.nodes.find((node) => node.kind === 'question')!; question.choices![1].value = 'yes'; expect(validateTree(tree).some((issue) => issue.message.includes('utilisé plusieurs fois'))).toBe(true) })
  it('demande un arbre cible pour une transition vers un autre arbre', () => { const tree = blankTree(); tree.nodes = [{ ...tree.nodes[0], kind: 'handoff', title: 'Continuer' }]; expect(validateTree(tree).some((issue) => issue.message.includes('Choisissez l’arbre'))).toBe(true) })
})
