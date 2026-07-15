import type { DecisionTree } from './model'
export interface Issue { level: 'error' | 'warning' | 'info'; message: string; nodeId?: string }
export function validateTree(tree: DecisionTree, availableTrees: DecisionTree[] = []): Issue[] {
  const issues: Issue[] = []
  if (!tree.title.trim()) issues.push({ level: 'error', message: 'Donnez un titre à l’arbre.' })
  const targets = new Set(tree.edges.map((edge) => edge.target))
  const roots = tree.nodes.filter((node) => !targets.has(node.id))
  const actionableRoots = roots.filter((node) => node.kind !== 'start')
  if (!actionableRoots.length && !roots.some((node) => node.kind === 'start' && tree.edges.some((edge) => edge.source === node.id))) issues.push({ level: 'error', message: 'Ajoutez une première étape.' })
  if (actionableRoots.length > 1) issues.push({ level: 'warning', message: 'Plusieurs premières étapes sont définies.' })
  if (!tree.nodes.some((node) => node.kind === 'end')) issues.push({ level: 'warning', message: 'Aucune conclusion n’est définie.' })
  const ids = new Set(tree.nodes.map((node) => node.id)); tree.edges.forEach((edge) => { if (!ids.has(edge.source) || !ids.has(edge.target)) issues.push({ level: 'error', message: 'Une connexion cible un nœud inexistant.' }) })
  const entry = roots.find((node) => node.kind === 'start') ?? roots[0]
  const seen = new Set<string>(); const walk = (id: string) => { if (seen.has(id)) return; seen.add(id); tree.edges.filter((edge) => edge.source === id).forEach((edge) => walk(edge.target)) }; if (entry) walk(entry.id)
  tree.nodes.filter((node) => !seen.has(node.id)).forEach((node) => issues.push({ level: 'warning', message: `Étape inaccessible : ${node.title || 'sans titre'}`, nodeId: node.id }))
  tree.nodes.filter((node) => node.kind !== 'end' && node.kind !== 'handoff' && !tree.edges.some((edge) => edge.source === node.id)).forEach((node) => issues.push({ level: 'warning', message: `Aucune suite après « ${node.title || 'cette étape'} ».`, nodeId: node.id }))
  tree.nodes.filter((node) => node.kind !== 'question').forEach((node) => {
    if (tree.edges.filter((edge) => edge.source === node.id).length > 1) issues.push({ level: 'error', message: `« ${node.title || 'Cette étape'} » mène à plusieurs étapes. Ajoutez une question pour créer des branches.`, nodeId: node.id })
  })
  tree.nodes.filter((node) => node.kind === 'question').forEach((node) => {
    const choices = node.choices ?? []
    if (!choices.length) issues.push({ level: 'error', message: `Ajoutez au moins une réponse à « ${node.title || 'cette question'} ».`, nodeId: node.id })
    const values = new Set<string>()
    choices.forEach((choice) => {
      if (!choice.label.trim() || !choice.value.trim()) issues.push({ level: 'error', message: `Chaque réponse de « ${node.title || 'cette question'} » doit avoir un libellé et un identifiant.`, nodeId: node.id })
      if (values.has(choice.value)) issues.push({ level: 'error', message: `L’identifiant « ${choice.value} » est utilisé plusieurs fois dans « ${node.title || 'cette question'} ».`, nodeId: node.id })
      values.add(choice.value)
      const paths = tree.edges.filter((edge) => edge.source === node.id && edge.choiceValue === choice.value)
      if (!paths.length) issues.push({ level: 'error', message: `Reliez la réponse « ${choice.label || choice.value || 'sans libellé'} » à une étape.`, nodeId: node.id })
      if (paths.length > 1) issues.push({ level: 'error', message: `La réponse « ${choice.label || choice.value || 'sans libellé'} » mène à plusieurs étapes.`, nodeId: node.id })
    })
    tree.edges.filter((edge) => edge.source === node.id && (!edge.choiceValue || !values.has(edge.choiceValue))).forEach(() => issues.push({ level: 'error', message: `Un chemin de « ${node.title || 'cette question'} » n’est associé à aucune réponse.`, nodeId: node.id }))
  })
  tree.nodes.filter((node) => node.kind === 'handoff').forEach((node) => {
    if (!node.targetTreeId) issues.push({ level: 'error', message: `Choisissez l’arbre à ouvrir depuis « ${node.title || 'cette étape'} ».`, nodeId: node.id })
    else if (availableTrees.length && !availableTrees.some((candidate) => candidate.id === node.targetTreeId)) issues.push({ level: 'error', message: `L’arbre cible de « ${node.title || 'cette étape'} » n’existe plus.`, nodeId: node.id })
  })
  return issues
}
