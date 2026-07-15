import { z } from 'zod'

export const NODE_TYPES = ['start', 'information', 'action', 'question', 'condition', 'handoff', 'end'] as const
export type NodeKind = (typeof NODE_TYPES)[number]
export type InputKind = 'text' | 'textarea' | 'email' | 'url' | 'number' | 'date' | 'select' | 'checkbox'
export type StepStatus = 'completed' | 'skipped' | 'inconclusive' | 'later' | 'blocked'

export interface InputDefinition { id: string; label: string; type: InputKind; required: boolean; description?: string; defaultValue?: string; options?: string[] }
export interface ToolLink { id: string; label: string; urlTemplate: string }
export interface Choice { id: string; label: string; value: string }
export interface TreeNode { id: string; kind: NodeKind; title: string; body: string; position: { x: number; y: number }; choices?: Choice[]; links?: ToolLink[]; targetTreeId?: string }
export interface TreeEdge { id: string; source: string; target: string; choiceValue?: string; sourceHandle?: string; targetHandle?: string }
export interface DecisionTree { id: string; title: string; description: string; schemaVersion: 1; createdAt: string; updatedAt: string; inputs: InputDefinition[]; nodes: TreeNode[]; edges: TreeEdge[] }
export interface StepExecution { id: string; nodeId: string; at: string; status: StepStatus; answer?: string; note?: string; treeId?: string; treeTitle?: string; nodeTitle?: string }
export interface VariableUpdate { id: string; at: string; nodeId: string; treeId: string; changes: Record<string, string>; removed?: string[] }
export interface ExecutionSession { id: string; treeId: string; treeTitle: string; createdAt: string; updatedAt: string; completedAt?: string; currentNodeId: string; variables: Record<string, string>; steps: StepExecution[]; variableUpdates?: VariableUpdate[] }

const id = () => crypto.randomUUID()
const now = () => new Date().toISOString()
export const blankNode = (kind: NodeKind, position = { x: 160, y: 140 }): TreeNode => ({ id: id(), kind, title: kind === 'start' ? 'Démarrer' : kind === 'end' ? 'Conclusion' : kind === 'handoff' ? 'Ouvrir un autre arbre' : 'Nouvelle étape', body: '', position, ...(kind === 'question' ? { choices: [{ id: id(), label: 'Oui', value: 'yes' }, { id: id(), label: 'Non', value: 'no' }] } : {}) })
export const blankTree = (): DecisionTree => {
  const firstNode = blankNode('action')
  firstNode.title = 'Première étape'
  return { id: id(), title: 'Nouvel arbre', description: '', schemaVersion: 1, createdAt: now(), updatedAt: now(), inputs: [], nodes: [firstNode], edges: [] }
}

export const DecisionTreeSchema = z.object({
  id: z.string().uuid(), title: z.string().min(1).max(160), description: z.string().max(5000), schemaVersion: z.literal(1), createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  inputs: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), type: z.enum(['text', 'textarea', 'email', 'url', 'number', 'date', 'select', 'checkbox']), required: z.boolean(), description: z.string().optional(), defaultValue: z.string().optional(), options: z.array(z.string()).optional() })).max(100),
  nodes: z.array(z.object({ id: z.string().uuid(), kind: z.enum(NODE_TYPES), title: z.string().max(250), body: z.string().max(20000), position: z.object({ x: z.number(), y: z.number() }), choices: z.array(z.object({ id: z.string().uuid(), label: z.string(), value: z.string() })).optional(), links: z.array(z.object({ id: z.string().uuid(), label: z.string(), urlTemplate: z.string() })).optional(), targetTreeId: z.string().uuid().optional() })).max(500),
  edges: z.array(z.object({ id: z.string().uuid(), source: z.string().uuid(), target: z.string().uuid(), choiceValue: z.string().optional(), sourceHandle: z.string().optional(), targetHandle: z.string().optional() })).max(1000),
})

export function emailExample(): DecisionTree {
  const tree = blankTree(); tree.title = 'Analyse guidée d’une adresse e-mail'; tree.description = 'Exemple local et modifiable de procédure guidée.'
  tree.inputs = [{ id: 'email', label: 'Adresse e-mail', type: 'email', required: true, description: 'Saisie une seule fois pour les liens dynamiques.' }, { id: 'context', label: 'Contexte', type: 'textarea', required: false }]
  const action = { ...blankNode('action', { x: 160, y: 100 }), title: 'Vérifier le domaine', body: 'Ouvrez la recherche, notez les éléments pertinents et choisissez un statut.', links: [{ id: id(), label: 'Recherche web', urlTemplate: 'https://www.google.com/search?q={{email|urlencode}}' }] }
  const question = { ...blankNode('question', { x: 700, y: 100 }), title: 'Un résultat pertinent est-il présent ?', body: 'Choisissez la branche qui correspond à votre constat.', choices: [{ id: id(), label: 'Oui, à examiner', value: 'yes' }, { id: id(), label: 'Non concluant', value: 'no' }] }
  const yes = { ...blankNode('end', { x: 1040, y: 20 }), title: 'Résultat à approfondir', body: 'Conservez vos éléments et poursuivez les vérifications prévues.' }
  const no = { ...blankNode('end', { x: 1040, y: 230 }), title: 'Aucun élément concluant', body: 'Documentez l’absence de résultat et clôturez ou reprenez plus tard.' }
  tree.nodes = [action, question, yes, no]; tree.edges = [{ id: id(), source: action.id, target: question.id }, { id: id(), source: question.id, target: yes.id, choiceValue: 'yes' }, { id: id(), source: question.id, target: no.id, choiceValue: 'no' }]; return tree
}

export function osintEmailExample(): DecisionTree {
  const tree = blankTree(); tree.title = 'Qualification d’une adresse e-mail'; tree.description = 'Modèle de triage OSINT fondé sur des sources publiques, à utiliser uniquement dans un périmètre autorisé.'
  tree.inputs = [{ id: 'email', label: 'Adresse e-mail', type: 'email', required: true, description: 'Saisie une seule fois pour les liens dynamiques.' }, { id: 'objective', label: 'Objectif et périmètre autorisé', type: 'textarea', required: true, description: 'Précisez le besoin légitime avant de commencer.' }]
  const epieos = { ...blankNode('action', { x: 80, y: 280 }), title: 'Consulter Epieos', body: 'Recherchez l’adresse, puis relevez uniquement les signaux accessibles publiquement et utiles à l’objectif défini.', links: [{ id: id(), label: 'Ouvrir Epieos', urlTemplate: 'https://epieos.com/' }] }
  const result = { ...blankNode('question', { x: 420, y: 280 }), title: 'Que renvoie la recherche ?', body: 'Choisissez le constat le plus proche. Ces branches sont des pistes à qualifier, pas des conclusions.', choices: [{ id: id(), label: 'Aucun signal exploitable', value: 'none' }, { id: id(), label: 'Signal de profil ou Maps', value: 'profile-maps' }, { id: id(), label: 'Calendrier ou disponibilité publique', value: 'calendar' }, { id: id(), label: 'Plusieurs éléments à recouper', value: 'cross-check' }] }
  const none = { ...blankNode('action', { x: 780, y: 0 }), title: 'Documenter l’absence de résultat', body: 'Notez l’outil consulté, la date et l’absence de signal exploitable. Évitez toute conclusion fondée sur cette seule absence.' }
  const profile = { ...blankNode('action', { x: 780, y: 180 }), title: 'Qualifier le signal de profil', body: 'Vérifiez sa pertinence métier dans le périmètre autorisé. Conservez la source, la date et le niveau de confiance.' }
  const calendar = { ...blankNode('action', { x: 780, y: 360 }), title: 'Qualifier le signal de calendrier', body: 'Évaluez seulement la pertinence de ce qui est rendu public, sans interaction avec le compte ni inférence hâtive.' }
  const crossCheck = { ...blankNode('action', { x: 780, y: 540 }), title: 'Recouper les éléments', body: 'Comparez les observations avec des sources publiques autorisées avant de les exploiter dans une synthèse.' }
  const enough = { ...blankNode('question', { x: 1140, y: 280 }), title: 'Information suffisante pour l’objectif ?', body: 'Décidez au regard du périmètre initial et de la fiabilité des sources.', choices: [{ id: id(), label: 'Oui, synthèse possible', value: 'yes' }, { id: id(), label: 'Non, rien de concluant', value: 'no' }] }
  const synthesize = { ...blankNode('end', { x: 1480, y: 180 }), title: 'Préparer une synthèse sourcée', body: 'Consignez les constats, les sources, les dates et les limites d’interprétation.' }
  const close = { ...blankNode('end', { x: 1480, y: 420 }), title: 'Clôturer sans résultat', body: 'Documentez l’absence de résultat concluant et les démarches déjà menées.' }
  const link = (source: string, target: string, choiceValue?: string): TreeEdge => ({ id: id(), source, target, sourceHandle: 'source-right', targetHandle: 'target-left', ...(choiceValue ? { choiceValue } : {}) })
  tree.nodes = [epieos, result, none, profile, calendar, crossCheck, enough, synthesize, close]
  tree.edges = [link(epieos.id, result.id), link(result.id, none.id, 'none'), link(result.id, profile.id, 'profile-maps'), link(result.id, calendar.id, 'calendar'), link(result.id, crossCheck.id, 'cross-check'), link(none.id, enough.id), link(profile.id, enough.id), link(calendar.id, enough.id), link(crossCheck.id, enough.id), link(enough.id, synthesize.id, 'yes'), link(enough.id, close.id, 'no')]
  return tree
}
