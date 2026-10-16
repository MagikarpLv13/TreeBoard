import type { DecisionTree, ExecutionSession, SessionCheckpoint, StepExecution, TreeNode } from './model'

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
function linkedNode(tree: DecisionTree, node: TreeNode, answer?: string): TreeNode | undefined {
  const outgoing = tree.edges.filter((item) => item.source === node.id)
  const edge = node.kind === 'question'
    ? outgoing.find((item) => item.choiceValue === answer)
    : outgoing.length === 1 ? outgoing[0] : undefined
  return edge ? tree.nodes.find((candidate) => candidate.id === edge.target) : undefined
}

function resolveNode(tree: DecisionTree, current: TreeNode | undefined, variables: Record<string, string>): TreeNode | undefined {
  const visited = new Set<string>()
  while (current && (current.kind === 'start' || (current.kind === 'question' && current.answerInputId))) {
    if (visited.has(current.id)) return current.kind === 'start' ? undefined : current
    visited.add(current.id)
    const answer = current.answerInputId ? variables[current.answerInputId] : undefined
    if (current.kind === 'question' && !current.choices?.some((choice) => choice.value === answer)) return current
    const destination = linkedNode(tree, current, answer)
    if (!destination && current.kind === 'question') return current
    current = destination
  }
  return current
}
export function nextNode(tree: DecisionTree, node: TreeNode, answer?: string, variables: Record<string, string> = {}): TreeNode | undefined {
  return resolveNode(tree, linkedNode(tree, node, answer), variables)
}
export function initialNode(tree: DecisionTree, variables: Record<string, string> = {}): TreeNode | undefined {
  const targets = new Set(tree.edges.map((edge) => edge.target))
  const first = tree.nodes.find((node) => node.kind === 'start' && !targets.has(node.id)) ?? tree.nodes.find((node) => !targets.has(node.id))
  return resolveNode(tree, first, variables)
}
export function createSession(tree: DecisionTree, variables: Record<string, string>): ExecutionSession {
  const firstNode = initialNode(tree, variables); if (!firstNode) throw new Error('Arbre sans première étape.')
  const at = new Date().toISOString()
  return snapshotSessionTrees(checkpointSession({ id: crypto.randomUUID(), treeId: tree.id, treeTitle: tree.title, createdAt: at, updatedAt: at, currentNodeId: firstNode.id, variables, steps: [], variableUpdates: [] }), [tree])
}
export function getSessionTree(session: ExecutionSession, trees: DecisionTree[]): DecisionTree | undefined {
  return session.treeSnapshots?.[session.treeId] ?? trees.find((tree) => tree.id === session.treeId)
}
export function snapshotSessionTrees(session: ExecutionSession, trees: DecisionTree[]): ExecutionSession {
  const usedIds = new Set([session.treeId, ...(session.timeline ?? []).map((point) => point.treeId), ...session.steps.map((step) => step.treeId)])
  const missing = trees.filter((tree) => usedIds.has(tree.id) && !session.treeSnapshots?.[tree.id])
  if (!missing.length) return session
  return { ...session, treeSnapshots: { ...session.treeSnapshots, ...Object.fromEntries(missing.map((tree) => [tree.id, structuredClone(tree)])) } }
}
export function sessionCheckpoint(session: ExecutionSession): SessionCheckpoint {
  return { treeId: session.treeId, treeTitle: session.treeTitle, currentNodeId: session.currentNodeId, variables: { ...session.variables }, steps: [...session.steps], variableUpdates: session.variableUpdates ? [...session.variableUpdates] : undefined, ...(session.completedAt ? { completedAt: session.completedAt } : {}) }
}
export function checkpointSession(session: ExecutionSession): ExecutionSession {
  return { ...session, timeline: [...(session.timeline ?? []), sessionCheckpoint(session)] }
}
export function replaceCurrentCheckpoint(session: ExecutionSession): ExecutionSession {
  const timeline = session.timeline ?? []
  return { ...session, timeline: timeline.length ? [...timeline.slice(0, -1), sessionCheckpoint(session)] : [sessionCheckpoint(session)] }
}
export function sessionAtCheckpoint(session: ExecutionSession, index: number): ExecutionSession {
  const checkpoint = session.timeline?.[index]
  return checkpoint ? { ...session, ...checkpoint, completedAt: checkpoint.completedAt, variables: { ...checkpoint.variables }, steps: [...checkpoint.steps], variableUpdates: checkpoint.variableUpdates ? [...checkpoint.variableUpdates] : undefined } : session
}
export function discardAfterCheckpoint(session: ExecutionSession, index: number): ExecutionSession {
  const restored = sessionAtCheckpoint(session, index)
  return { ...restored, completedAt: undefined, timeline: (session.timeline ?? []).slice(0, index + 1), updatedAt: new Date().toISOString() }
}
export function duplicateAtCheckpoint(session: ExecutionSession, index: number): ExecutionSession {
  const restored = discardAfterCheckpoint(session, index)
  const at = new Date().toISOString()
  return { ...restored, id: crypto.randomUUID(), createdAt: at, updatedAt: at }
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
  return replaceCurrentCheckpoint({ ...session, updatedAt: at, variables, variableUpdates: [...(session.variableUpdates ?? []), { id: crypto.randomUUID(), at, nodeId, treeId: tree.id, changes: cleaned, ...(removedKeys.length ? { removed: removedKeys } : {}) }] })
}
export function moveToTree(session: ExecutionSession, targetTree: DecisionTree): ExecutionSession {
  const target = session.treeSnapshots?.[targetTree.id] ?? targetTree
  const firstNode = initialNode(target, session.variables)
  if (!firstNode) throw new Error('L’arbre cible ne contient pas de première étape.')
  return snapshotSessionTrees({ ...session, treeId: target.id, treeTitle: target.title, currentNodeId: firstNode.id, updatedAt: new Date().toISOString() }, [target])
}
export function markdownReport(tree: DecisionTree, session: ExecutionSession): string {
  const details = Object.entries(session.variables).map(([key, value]) => `- **${key}** : ${value || '—'}`).join('\n')
  const steps = session.steps.map((step) => { const node = step.treeId === tree.id ? tree.nodes.find((n) => n.id === step.nodeId) : undefined; return `### ${step.treeTitle ? `${step.treeTitle} — ` : ''}${step.nodeTitle ?? node?.title ?? 'Étape enregistrée'}\n- Statut : ${step.status}${step.answer ? `\n- Réponse : ${step.answer}` : ''}${step.note ? `\n- Note : ${step.note}` : ''}` }).join('\n\n')
  const updates = (session.variableUpdates ?? []).map((update) => `- ${new Date(update.at).toLocaleString('fr-FR')} : ${[...Object.entries(update.changes).map(([key, value]) => `**${key}** = ${value || '—'}`), ...(update.removed ?? []).map((key) => `**${key}** supprimé`)].join(', ')}`).join('\n')
  return `# Compte rendu — ${tree.title}\n\nCréé le ${new Date(session.createdAt).toLocaleString('fr-FR')}\n\n## Données collectées\n${details}\n\n## Mises à jour des données\n${updates || '_Aucune mise à jour enregistrée._'}\n\n## Chronologie\n\n${steps || '_Aucune étape enregistrée._'}\n`
}
