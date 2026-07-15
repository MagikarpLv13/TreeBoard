import type { DecisionTree, ExecutionSession, StepExecution, TreeNode } from './model'

export type TemplateResult = { value: string; unknown: string[] }
export function renderTemplate(source: string, variables: Record<string, string>): TemplateResult {
  const unknown: string[] = []
  const value = source.replace(/{{\s*([^{}]+)\s*}}/g, (all, expression: string) => {
    const [key, ...filters] = expression.split('|').map((part) => part.trim())
    if (!/^[\w-]+$/.test(key) || !(key in variables)) { unknown.push(key); return all }
    return filters.reduce((value, filter) => filter === 'urlencode' ? encodeURIComponent(value) : filter === 'lower' ? value.toLowerCase() : filter === 'upper' ? value.toUpperCase() : filter === 'trim' ? value.trim() : value, variables[key])
  })
  return { value, unknown }
}
export function safeExternalUrl(template: string, variables: Record<string, string>): string | null {
  const value = renderTemplate(template, variables).value
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null } catch { return null }
}
export function nextNode(tree: DecisionTree, node: TreeNode, answer?: string): TreeNode | undefined {
  const outgoing = tree.edges.filter((item) => item.source === node.id)
  const edge = node.kind === 'question'
    ? outgoing.find((item) => item.choiceValue === answer)
    : outgoing.length === 1 ? outgoing[0] : undefined
  return edge ? tree.nodes.find((candidate) => candidate.id === edge.target) : undefined
}

export function initialNode(tree: DecisionTree): TreeNode | undefined {
  const targets = new Set(tree.edges.map((edge) => edge.target))
  let current = tree.nodes.find((node) => node.kind === 'start' && !targets.has(node.id)) ?? tree.nodes.find((node) => !targets.has(node.id))
  const visited = new Set<string>()
  while (current?.kind === 'start') {
    if (visited.has(current.id)) return undefined
    visited.add(current.id)
    current = nextNode(tree, current)
  }
  return current
}
export function createSession(tree: DecisionTree, variables: Record<string, string>): ExecutionSession {
  const firstNode = initialNode(tree); if (!firstNode) throw new Error('Arbre sans première étape.')
  const at = new Date().toISOString(); return { id: crypto.randomUUID(), treeId: tree.id, treeTitle: tree.title, createdAt: at, updatedAt: at, currentNodeId: firstNode.id, variables, steps: [], variableUpdates: [] }
}
export function recordStep(session: ExecutionSession, tree: DecisionTree, nodeId: string, status: StepExecution['status'], answer?: string, note?: string): ExecutionSession {
  const at = new Date().toISOString(); return { ...session, updatedAt: at, steps: [...session.steps, { id: crypto.randomUUID(), nodeId, at, status, answer, note, treeId: tree.id, treeTitle: tree.title, nodeTitle: tree.nodes.find((node) => node.id === nodeId)?.title }] }
}
export function updateSessionVariables(session: ExecutionSession, tree: DecisionTree, nodeId: string, changes: Record<string, string>, removed: string[] = []): ExecutionSession {
  const cleaned = Object.fromEntries(Object.entries(changes).filter(([key]) => key.trim()))
  const removedKeys = [...new Set(removed.map((key) => key.trim()).filter((key) => key && key in session.variables && !(key in cleaned)))]
  if (!Object.keys(cleaned).length && !removedKeys.length) return session
  const at = new Date().toISOString()
  const variables = { ...session.variables, ...cleaned }
  removedKeys.forEach((key) => delete variables[key])
  return { ...session, updatedAt: at, variables, variableUpdates: [...(session.variableUpdates ?? []), { id: crypto.randomUUID(), at, nodeId, treeId: tree.id, changes: cleaned, ...(removedKeys.length ? { removed: removedKeys } : {}) }] }
}
export function moveToTree(session: ExecutionSession, targetTree: DecisionTree): ExecutionSession {
  const firstNode = initialNode(targetTree)
  if (!firstNode) throw new Error('L’arbre cible ne contient pas de première étape.')
  return { ...session, treeId: targetTree.id, treeTitle: targetTree.title, currentNodeId: firstNode.id, updatedAt: new Date().toISOString() }
}
export function markdownReport(tree: DecisionTree, session: ExecutionSession): string {
  const details = Object.entries(session.variables).map(([key, value]) => `- **${key}** : ${value || '—'}`).join('\n')
  const steps = session.steps.map((step) => { const node = step.treeId === tree.id ? tree.nodes.find((n) => n.id === step.nodeId) : undefined; return `### ${step.treeTitle ? `${step.treeTitle} — ` : ''}${step.nodeTitle ?? node?.title ?? 'Étape enregistrée'}\n- Statut : ${step.status}${step.answer ? `\n- Réponse : ${step.answer}` : ''}${step.note ? `\n- Note : ${step.note}` : ''}` }).join('\n\n')
  const updates = (session.variableUpdates ?? []).map((update) => `- ${new Date(update.at).toLocaleString('fr-FR')} : ${[...Object.entries(update.changes).map(([key, value]) => `**${key}** = ${value || '—'}`), ...(update.removed ?? []).map((key) => `**${key}** supprimé`)].join(', ')}`).join('\n')
  return `# Compte rendu — ${tree.title}\n\nCréé le ${new Date(session.createdAt).toLocaleString('fr-FR')}\n\n## Données collectées\n${details}\n\n## Mises à jour des données\n${updates || '_Aucune mise à jour enregistrée._'}\n\n## Chronologie\n\n${steps || '_Aucune étape enregistrée._'}\n`
}
