import { describe, expect, it } from 'vitest'
import { createSession, moveToTree, nextNode, renderTemplate, safeExternalUrl, updateSessionVariables } from './engine'
import { blankNode, blankTree, emailExample } from './model'

describe('moteur de templates', () => {
  it('applique les transformations sans évaluer de code', () => expect(renderTemplate('https://x.test?q={{email|lower|urlencode}}', { email: ' A B@EXAMPLE.TEST ' }).value).toBe('https://x.test?q=%20a%20b%40example.test%20'))
  it('signale les variables manquantes', () => expect(renderTemplate('{{absent}}', {}).unknown).toEqual(['absent']))
  it('refuse les protocoles dangereux', () => expect(safeExternalUrl('javascript:alert(1)', {})).toBeNull())
})

describe('parcours', () => {
  it('suit la branche correspondant à une réponse', () => { const tree = emailExample(); const question = tree.nodes.find((node) => node.kind === 'question'); expect(question).toBeDefined(); expect(nextNode(tree, question!, 'yes')?.kind).toBe('end') })
  it('ne suit pas un chemin de question non associé à la réponse', () => { const tree = emailExample(); const question = tree.nodes.find((node) => node.kind === 'question')!; tree.edges.push({ id: crypto.randomUUID(), source: question.id, target: tree.nodes[2].id }); expect(nextNode(tree, question, 'missing')).toBeUndefined() })
  it('crée une session sur la première étape utile', () => { const tree = emailExample(); expect(createSession(tree, { email: 'a@b.test' }).currentNodeId).toBe(tree.nodes[0].id) })
  it('ignore le nœud de départ des arbres existants', () => { const tree = emailExample(); const first = tree.nodes[0]; const legacy = { ...first, id: crypto.randomUUID(), kind: 'start' as const, title: 'Démarrer' }; tree.nodes.unshift(legacy); tree.edges.unshift({ id: crypto.randomUUID(), source: legacy.id, target: first.id }); expect(createSession(tree, {}).currentNodeId).toBe(first.id) })
  it('conserve les données trouvées avec leur historique', () => { const tree = emailExample(); const session = createSession(tree, { email: 'a@b.test' }); const updated = updateSessionVariables(session, tree, tree.nodes[0].id, { twitter_url: 'https://x.com/example' }); expect(updated.variables.twitter_url).toBe('https://x.com/example'); expect(updated.variableUpdates).toHaveLength(1); expect(updated.variableUpdates?.[0].treeId).toBe(tree.id) })
  it('retire une donnée enregistrée et journalise la suppression', () => { const tree = emailExample(); const session = createSession(tree, { email: 'a@b.test', twitter_url: 'https://x.com/example' }); const updated = updateSessionVariables(session, tree, tree.nodes[0].id, {}, ['twitter_url']); expect(updated.variables.twitter_url).toBeUndefined(); expect(updated.variableUpdates?.[0].removed).toEqual(['twitter_url']) })
  it('passe à la première étape d’un autre arbre sans perdre les données', () => { const source = emailExample(); const target = blankTree(); const first = blankNode('action'); target.nodes = [first]; const moved = moveToTree(createSession(source, { pseudo: 'exemple', twitter_url: 'https://x.com/exemple' }), target); expect(moved.treeId).toBe(target.id); expect(moved.currentNodeId).toBe(first.id); expect(moved.variables.twitter_url).toBe('https://x.com/exemple') })
})
