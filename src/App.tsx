import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react'
import { Background, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow, useEdgesState, useNodesState, type Connection, type Edge, type Node, type NodeProps, type OnConnect } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { blankNode, blankTree, DecisionTreeSchema, osintEmailExample, type Choice, type DecisionTree, type ExecutionSession, type InputDefinition, type NodeKind, type StepStatus, type TreeNode } from './domain/model'
import { createSession, markdownReport, moveToTree, nextNode, recordStep, renderTemplate, safeExternalUrl, updateSessionVariables } from './domain/engine'
import { pasteTreeNode, removeTreeNode } from './domain/editor'
import { validateTree } from './domain/validate'
import { useAppStore } from './store/appStore'
import './App.css'

const nodeLabel: Record<NodeKind, string> = { start: 'Transition', information: 'Information', action: 'Action', question: 'Question', condition: 'Condition', handoff: 'Autre arbre', end: 'Fin' }
const statusLabel: Record<StepStatus, string> = { completed: 'Terminé', skipped: 'Ignoré', inconclusive: 'Non concluant', later: 'À vérifier plus tard', blocked: 'Bloqué' }
const kindColor: Record<NodeKind, string> = { start: '#3763c9', information: '#6b7280', action: '#8256c9', question: '#c07d24', condition: '#c0504c', handoff: '#16828f', end: '#2f8f6a' }
const paletteKinds: NodeKind[] = ['information', 'action', 'question', 'condition', 'handoff', 'end']
let copiedNode: TreeNode | undefined

const download = (name: string, body: string) => {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([body], { type: name.endsWith('.json') ? 'application/json' : 'text/markdown' }))
  link.download = name
  link.click()
  URL.revokeObjectURL(link.href)
}

function Logo({ compact = false }: { compact?: boolean }) {
  return <span className="logo-lockup" aria-label="TreeBoard">
    <svg className="logo-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M9 31 20 20 31 9M20 20 10 11" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="31" r="3" fill="var(--surface)" stroke="currentColor" strokeWidth="2.3" />
      <circle cx="10" cy="11" r="2.7" fill="currentColor" opacity=".55" />
      <circle cx="20" cy="20" r="2.3" fill="currentColor" />
      <circle cx="31" cy="9" r="4" fill="currentColor" />
    </svg>
    {!compact && <span>Tree<span>Board</span></span>}
  </span>
}

function ThemeToggle({ theme, onChange }: { theme: 'light' | 'dark'; onChange: () => void }) {
  return <button className="theme-toggle" type="button" onClick={onChange} aria-label={theme === 'light' ? 'Activer le thème sombre' : 'Activer le thème clair'}>{theme === 'light' ? '◐' : '☼'}</button>
}

function TreePreview({ tree }: { tree: DecisionTree }) {
  const colors = tree.nodes.filter((node) => node.kind !== 'start').slice(0, 4).map((node) => kindColor[node.kind])
  const nodes = colors.length ? colors : [kindColor.action, kindColor.question, kindColor.end]
  return <svg className="tree-preview" viewBox="0 0 96 72" aria-hidden="true">
    <path d="M19 36h21m0 0 20-16m-20 16 20 16m0-32h18m-18 32h18" stroke="#b6bbc3" strokeWidth="1.5" fill="none" />
    <circle cx="19" cy="36" r="6" fill={nodes[0]} /><circle cx="40" cy="36" r="6" fill={nodes[1] ?? nodes[0]} />
    <circle cx="60" cy="20" r="6" fill={nodes[2] ?? nodes[0]} /><circle cx="60" cy="52" r="6" fill={nodes[3] ?? nodes[1] ?? nodes[0]} />
    <circle cx="78" cy="20" r="6" fill="var(--preview-end)" /><circle cx="78" cy="52" r="6" fill="var(--preview-end)" />
  </svg>
}

type FlowNodeData = { node: TreeNode }

function DecisionNode({ data, selected }: NodeProps) {
  const node = (data as unknown as FlowNodeData).node
  const isQuestion = node.kind === 'question' && node.choices?.length
  return <div className={`decision-node ${selected ? 'selected' : ''}`}>
    <Handle id="target-top" type="target" position={Position.Top} title="Entrée haute" />
    <Handle id="target-left" type="target" position={Position.Left} title="Entrée latérale gauche" />
    <div className="node-type" style={{ color: kindColor[node.kind] }}><i />{nodeLabel[node.kind]}</div>
    <strong>{node.title || 'Sans titre'}</strong>
    {node.body && <p>{node.body}</p>}
    {node.kind === 'action' && node.links?.length ? <span className="node-chip">{node.links.length} lien{node.links.length > 1 ? 's' : ''}</span> : null}
    {isQuestion ? <div className="node-choices">{node.choices?.slice(0, 3).map((choice) => <span key={choice.id}>{choice.label}<b>{choice.value}</b></span>)}</div> : null}
    <Handle id="source-bottom" type="source" position={Position.Bottom} title="Sortie basse" />
    <Handle id="source-right" type="source" position={Position.Right} title="Sortie latérale droite" />
  </div>
}

const nodeTypes = { decision: DecisionNode }

export default function App() {
  const { trees, sessions, activeTree, activeSession, screen, loaded, load, saveTree, removeTree, setActiveTree, setActiveSession, setScreen, saveSession, removeSession } = useAppStore()
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('treeboard-theme') === 'dark' ? 'dark' : 'light')
  const toggleTheme = () => setTheme((current) => current === 'light' ? 'dark' : 'light')

  useEffect(() => { void load() }, [load])
  useEffect(() => { localStorage.setItem('treeboard-theme', theme) }, [theme])
  useEffect(() => {
    const page = screen === 'library'
      ? 'Arbres de décision'
      : screen === 'editor'
        ? `Éditeur — ${activeTree?.title ?? 'Nouvel arbre'}`
        : `Parcours — ${activeTree?.title ?? 'Arbre de décision'}`
    document.title = `TreeBoard | ${page}`
  }, [activeTree?.title, screen])
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (activeTree) void saveTree(activeTree)
      }
    }
    addEventListener('keydown', handler)
    return () => removeEventListener('keydown', handler)
  }, [activeTree, saveTree])

  if (!loaded) return <main className="loading" data-theme={theme}><Logo /><span>Chargement de votre espace local…</span></main>

  const openTree = (tree: DecisionTree) => { setActiveTree(tree); setScreen('editor') }
  const runTree = (tree: DecisionTree) => { setActiveTree(tree); setActiveSession(undefined); setScreen('run') }
  const commonTheme = { theme, toggleTheme }

  return <main className="app" data-theme={theme}>
    {screen === 'library' && <Library trees={trees} sessions={sessions} openTree={openTree} runTree={runTree} onNew={() => openTree(blankTree())} onExample={() => openTree(osintEmailExample())} onDelete={(id) => void removeTree(id)} onSession={(session) => { const tree = trees.find((item) => item.id === session.treeId); if (tree) { setActiveTree(tree); setActiveSession(session); setScreen('run') } }} onDeleteSession={(id) => void removeSession(id)} {...commonTheme} />}
    {screen === 'editor' && activeTree && <Editor key={activeTree.id} tree={activeTree} trees={trees} onBack={() => setScreen('library')} onSave={saveTree} onRun={runTree} {...commonTheme} />}
    {screen === 'run' && activeTree && <Runner tree={activeTree} trees={trees} session={activeSession} onBack={() => setScreen('library')} onSave={saveSession} {...commonTheme} />}
  </main>
}

type LibraryProps = {
  trees: DecisionTree[]; sessions: ExecutionSession[]; openTree: (tree: DecisionTree) => void; runTree: (tree: DecisionTree) => void; onNew: () => void; onExample: () => void; onDelete: (id: string) => void; onSession: (session: ExecutionSession) => void; onDeleteSession: (id: string) => void; theme: 'light' | 'dark'; toggleTheme: () => void
}

function Library({ trees, sessions, openTree, runTree, onNew, onExample, onDelete, onSession, onDeleteSession, theme, toggleTheme }: LibraryProps) {
  const [query, setQuery] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const importTree = async (file?: File) => {
    if (!file || file.size > 2_000_000) return alert('Fichier absent ou trop volumineux (limite : 2 Mo).')
    try {
      const parsed: unknown = JSON.parse(await file.text())
      const candidate = typeof parsed === 'object' && parsed !== null && 'tree' in parsed ? (parsed as { tree: unknown }).tree : parsed
      const tree = DecisionTreeSchema.parse(candidate)
      tree.id = crypto.randomUUID()
      tree.title += ' (importé)'
      openTree(tree)
    } catch { alert('Ce fichier ne correspond pas à un arbre valide.') }
  }
  const filtered = trees.filter((tree) => tree.title.toLowerCase().includes(query.toLowerCase()))
  const scrollToSessions = () => document.getElementById('sessions')?.scrollIntoView({ behavior: 'smooth' })

  return <section className="library-shell">
    <aside className="library-rail">
      <button className="brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><Logo /></button>
      <nav className="rail-nav" aria-label="Navigation principale">
        <button className="active" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><span>⌘</span>Arbres de décision <b>{trees.length}</b></button>
        <button onClick={scrollToSessions}><span>◷</span>Sessions <b>{sessions.length}</b></button>
        <button disabled><span>⌫</span>Corbeille</button>
      </nav>
      <div className="rail-footer"><div className="storage-head"><span>Stockage local</span><span>IndexedDB</span></div><div className="storage-bar"><i /></div><p><b>●</b> Local uniquement</p><ThemeToggle theme={theme} onChange={toggleTheme} /></div>
    </aside>
    <div className="library-workspace">
      <header className="workspace-head"><label className="search"><span>⌕</span><input aria-label="Rechercher un arbre" placeholder="Rechercher un arbre…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="workspace-actions"><button className="import-button" onClick={() => input.current?.click()}>Importer</button><button className="primary" onClick={onNew}>+ Nouvel arbre</button><input ref={input} hidden type="file" accept="application/json" onChange={(event) => void importTree(event.target.files?.[0])} /></div></header>
      <section className="library-content"><div className="section-heading"><div><p className="eyebrow">Espace de travail</p><h1>Arbres de décision</h1></div><div className="section-heading-actions"><button onClick={onExample}>Exemple e-mail</button><span>{filtered.length} arbre{filtered.length > 1 ? 's' : ''}</span></div></div>
        {filtered.length ? <div className="cards">{filtered.map((tree) => <article className="tree-card" key={tree.id}><button className="tree-thumb" onClick={() => openTree(tree)} aria-label={`Ouvrir ${tree.title}`}><TreePreview tree={tree} /></button><div className="card-main"><p className="eyebrow">{tree.nodes.filter((node) => node.kind !== 'start').length} étapes · modifié {new Date(tree.updatedAt).toLocaleDateString('fr-FR')}</p><h3>{tree.title}</h3><p>{tree.description || 'Ajoutez une description pour guider les personnes qui suivront ce parcours.'}</p></div><div className="card-actions"><button onClick={() => runTree(tree)}>Lancer</button><button onClick={() => openTree(tree)}>Modifier</button><button aria-label="Exporter" onClick={() => download(`${tree.title}.json`, JSON.stringify({ format: 'decision-tree-package', schemaVersion: 1, exportedAt: new Date().toISOString(), tree }, null, 2))}>⇩</button><button className="danger icon-button" aria-label="Supprimer" onClick={() => confirm(`Supprimer « ${tree.title} » ?`) && onDelete(tree.id)}>×</button></div></article>)}</div> : <div className="empty-state"><Logo compact /><h2>Aucun arbre ne correspond</h2><p>Créez votre premier parcours ou modifiez votre recherche.</p><button className="primary" onClick={onNew}>+ Nouvel arbre</button></div>}
        <section id="sessions" className="sessions-section"><div className="section-heading compact"><h2>Sessions</h2><span>{sessions.length} enregistrée{sessions.length > 1 ? 's' : ''}</span></div><div className="sessions">{sessions.length ? sessions.map((session) => <article key={session.id}><span className={`session-dot ${session.completedAt ? 'done' : ''}`} /><div><strong>{session.treeTitle}</strong><p>{session.completedAt ? 'Terminée' : 'En cours'} · {session.steps.length} étape{session.steps.length > 1 ? 's' : ''}</p></div><span className={`session-state ${session.completedAt ? 'done' : ''}`}>{session.completedAt ? 'Terminée' : 'En cours'}</span><button onClick={() => onSession(session)}>{session.completedAt ? 'Consulter' : 'Reprendre'}</button><button className="danger icon-button" aria-label="Supprimer la session" onClick={() => confirm('Supprimer cette session ?') && onDeleteSession(session.id)}>×</button></article>) : <p className="empty">Vos parcours interrompus ou terminés apparaîtront ici.</p>}</div></section>
      </section>
    </div>
  </section>
}

function Editor({ tree, trees, onBack, onSave, onRun, theme, toggleTheme }: { tree: DecisionTree; trees: DecisionTree[]; onBack: () => void; onSave: (tree: DecisionTree) => Promise<void>; onRun: (tree: DecisionTree) => void; theme: 'light' | 'dark'; toggleTheme: () => void }) {
  const [draft, setDraft] = useState(tree)
  const undoStack = useRef<DecisionTree[]>([])
  const redoStack = useRef<DecisionTree[]>([])
  const [selected, setSelected] = useState<string | undefined>()
  const [inspectorTab, setInspectorTab] = useState<'tree' | 'node'>('tree')
  const [inspectorWidth, setInspectorWidth] = useState(336)
  const [isResizingInspector, setIsResizingInspector] = useState(false)
  const editorRef = useRef<HTMLElement>(null)
  const issues = useMemo(() => validateTree(draft, trees), [draft, trees])
  const flowNodes = useMemo(() => draft.nodes.map((node): Node => ({ id: node.id, type: 'decision', position: node.position, data: { node } })), [draft.nodes])
  const flowEdges = useMemo(() => draft.edges.map((edge): Edge => {
    const source = draft.nodes.find((node) => node.id === edge.source)
    const choice = source?.choices?.find((item) => item.value === edge.choiceValue)
    return { id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle ?? 'source-bottom', targetHandle: edge.targetHandle ?? 'target-top', data: { choiceValue: edge.choiceValue }, ...(choice ? { label: choice.label } : {}), labelBgPadding: [6, 3], labelBgBorderRadius: 5, labelBgStyle: { fill: 'var(--surface)', stroke: 'var(--border-strong)', strokeWidth: 1 }, labelStyle: { fill: 'var(--text-secondary)', fontSize: 10, fontFamily: 'IBM Plex Mono, monospace' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#a8adb5' }, style: { stroke: '#a8adb5', strokeWidth: 1.6 }, type: 'smoothstep' }
  }), [draft.edges, draft.nodes])
  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges)

  useEffect(() => { setNodes(flowNodes); setEdges(flowEdges) }, [flowEdges, flowNodes, setEdges, setNodes])
  useEffect(() => {
    if (!isResizingInspector) return
    const resizeInspector = (event: PointerEvent) => {
      const editorBounds = editorRef.current?.getBoundingClientRect()
      if (!editorBounds) return
      setInspectorWidth(Math.min(520, Math.max(300, editorBounds.right - event.clientX)))
    }
    const stopResizing = () => setIsResizingInspector(false)
    document.addEventListener('pointermove', resizeInspector)
    document.addEventListener('pointerup', stopResizing)
    document.body.style.userSelect = 'none'
    return () => {
      document.removeEventListener('pointermove', resizeInspector)
      document.removeEventListener('pointerup', stopResizing)
      document.body.style.userSelect = ''
    }
  }, [isResizingInspector])
  const selectedNode = draft.nodes.find((node) => node.id === selected)
  const commitDraft = useCallback((update: DecisionTree | ((current: DecisionTree) => DecisionTree)) => {
    const next = typeof update === 'function' ? update(draft) : update
    undoStack.current = [...undoStack.current.slice(-99), draft]
    redoStack.current = []
    setDraft(next)
  }, [draft])
  const undo = useCallback(() => {
    const previous = undoStack.current.pop()
    if (!previous) return
    redoStack.current = [draft, ...redoStack.current.slice(0, 99)]
    setDraft(previous)
  }, [draft])
  const redo = useCallback(() => {
    const next = redoStack.current.shift()
    if (!next) return
    undoStack.current = [...undoStack.current.slice(-99), draft]
    setDraft(next)
  }, [draft])
  const deleteSelectedNode = useCallback(() => {
    if (!selectedNode) return
    commitDraft((current) => removeTreeNode(current, selectedNode.id))
    setSelected(undefined)
    setInspectorTab('tree')
  }, [commitDraft, selectedNode])
  const pasteCopiedNode = useCallback(() => {
    if (!copiedNode) return
    const origin = selectedNode?.position ?? { x: 160 + draft.nodes.length * 35, y: 140 + draft.nodes.length * 25 }
    const node = pasteTreeNode(copiedNode, { x: origin.x + 40, y: origin.y + 40 })
    commitDraft((current) => ({ ...current, nodes: [...current.nodes, node] }))
    setSelected(node.id)
    setInspectorTab('node')
  }, [commitDraft, draft.nodes.length, selectedNode?.position])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return
      const modifier = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      if (modifier && key === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return }
      if (modifier && key === 'y') { event.preventDefault(); redo(); return }
      if (modifier && key === 'c' && selectedNode) { event.preventDefault(); copiedNode = JSON.parse(JSON.stringify(selectedNode)) as TreeNode; return }
      if (modifier && key === 'v' && copiedNode) { event.preventDefault(); pasteCopiedNode(); return }
      if (event.key === 'Delete' && selectedNode) { event.preventDefault(); deleteSelectedNode() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [draft, selectedNode, deleteSelectedNode, pasteCopiedNode, redo, undo])
  const updateNode = (patch: Partial<TreeNode>) => selectedNode && commitDraft((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === selectedNode.id ? { ...node, ...patch } : node) }))
  const persist = async (): Promise<DecisionTree> => {
    const position = new Map(nodes.map((node) => [node.id, node.position]))
    const next = { ...draft, nodes: draft.nodes.map((node) => ({ ...node, position: position.get(node.id) ?? node.position })) }
    setDraft(next)
    await onSave(next)
    return next
  }
  const onConnect: OnConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return
    if (connection.source === connection.target) return alert('Une étape ne peut pas être reliée à elle-même.')
    const source = draft.nodes.find((node) => node.id === connection.source)
    if (!source) return
    if (source.kind !== 'question' && draft.edges.some((edge) => edge.source === connection.source && edge.target === connection.target)) return
    const choice = source.kind === 'question' ? source.choices?.find((item) => !draft.edges.some((edge) => edge.source === source.id && edge.choiceValue === item.value)) : undefined
    if (source.kind === 'question' && !choice) return alert('Tous les chemins de cette question sont déjà reliés. Modifiez-les dans l’onglet Étape.')
    commitDraft((current) => ({ ...current, edges: [...current.edges, { id: crypto.randomUUID(), source: connection.source!, target: connection.target!, sourceHandle: connection.sourceHandle ?? undefined, targetHandle: connection.targetHandle ?? undefined, ...(choice ? { choiceValue: choice.value } : {}) }] }))
  }
  const add = (kind: NodeKind, position?: { x: number; y: number }) => {
    const node = blankNode(kind, position ?? { x: 160 + draft.nodes.length * 45, y: 160 + draft.nodes.length * 30 })
    commitDraft((current) => ({ ...current, nodes: [...current.nodes, node] }))
    setSelected(node.id)
  }
  const createResultBranches = () => {
    if (!selectedNode || selectedNode.kind !== 'action') return
    if (draft.edges.some((edge) => edge.source === selectedNode.id)) return
    const choices: Choice[] = [
      { id: crypto.randomUUID(), label: 'Aucun résultat exploitable', value: 'no-result' },
      { id: crypto.randomUUID(), label: 'Résultat à qualifier', value: 'to-qualify' },
      { id: crypto.randomUUID(), label: 'À recouper', value: 'cross-check' },
    ]
    const decision = { ...blankNode('question', { x: selectedNode.position.x + 320, y: selectedNode.position.y }), title: 'Quel résultat a été obtenu ?', body: 'Choisissez le résultat le plus proche, puis adaptez les branches à votre métier.', choices }
    const nextSteps = [
      { title: 'Documenter l’absence de résultat', body: 'Notez l’outil consulté, la date et l’absence de signal exploitable.', y: selectedNode.position.y - 180 },
      { title: 'Qualifier le résultat', body: 'Vérifiez sa pertinence pour l’objectif, puis conservez la source et le niveau de confiance.', y: selectedNode.position.y },
      { title: 'Recouper les informations', body: 'Comparez les éléments disponibles dans le périmètre autorisé avant de conclure.', y: selectedNode.position.y + 180 },
    ].map((step) => ({ ...blankNode('action', { x: selectedNode.position.x + 650, y: step.y }), title: step.title, body: step.body }))
    const link = (source: string, target: string, choiceValue?: string) => ({ id: crypto.randomUUID(), source, target, sourceHandle: 'source-right', targetHandle: 'target-left', ...(choiceValue ? { choiceValue } : {}) })
    commitDraft((current) => ({ ...current, nodes: [...current.nodes, decision, ...nextSteps], edges: [...current.edges, link(selectedNode.id, decision.id), ...nextSteps.map((step, index) => link(decision.id, step.id, choices[index].value))] }))
    setSelected(decision.id)
    setInspectorTab('node')
  }
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const kind = event.dataTransfer.getData('application/treeboard-node') as NodeKind
    if (!paletteKinds.includes(kind)) return
    const rect = event.currentTarget.getBoundingClientRect()
    add(kind, { x: event.clientX - rect.left - 100, y: event.clientY - rect.top - 50 })
  }
  const addInput = () => commitDraft((current) => ({ ...current, inputs: [...current.inputs, { id: `field_${crypto.randomUUID().slice(0, 8)}`, label: 'Nouveau champ', type: 'text', required: false }] }))
  const updateQuestionChoices = (choices: Choice[]) => selectedNode && commitDraft((current) => {
    const previousChoices = current.nodes.find((node) => node.id === selectedNode.id)?.choices ?? []
    const replacements = new Map(previousChoices.map((choice) => [choice.value, choices.find((item) => item.id === choice.id)?.value]))
    const validValues = new Set(choices.map((choice) => choice.value))
    return {
      ...current,
      nodes: current.nodes.map((node) => node.id === selectedNode.id ? { ...node, choices } : node),
      edges: current.edges.flatMap((edge) => {
        if (edge.source !== selectedNode.id || !edge.choiceValue) return [edge]
        const nextValue = replacements.get(edge.choiceValue)
        return nextValue && validValues.has(nextValue) ? [{ ...edge, choiceValue: nextValue }] : []
      }),
    }
  })
  const assignQuestionPath = (choice: Choice, targetId: string) => commitDraft((current) => {
    const existing = current.edges.find((edge) => edge.source === selectedNode?.id && edge.choiceValue === choice.value)
    const remaining = current.edges.filter((edge) => edge.id !== existing?.id)
    return { ...current, edges: targetId ? [...remaining, { id: existing?.id ?? crypto.randomUUID(), source: selectedNode!.id, target: targetId, choiceValue: choice.value }] : remaining }
  })
  const run = () => {
    if (issues.some((issue) => issue.level === 'error')) return alert('Corrigez les erreurs de validation avant de tester le parcours.')
    void persist().then(onRun)
  }

  return <section ref={editorRef} className="editor" style={{ '--inspector-width': `${inspectorWidth}px` } as CSSProperties}>
    <div className="editor-top"><button className="back-button" onClick={onBack} aria-label="Retour à la bibliothèque">←</button><span className="breadcrumb">Bibliothèque /</span><input className="tree-title" title={draft.title} aria-label="Titre de l’arbre" value={draft.title} onChange={(event) => commitDraft({ ...draft, title: event.target.value })} /><span className="saved">● Modifs locales</span><ThemeToggle theme={theme} onChange={toggleTheme} /><button onClick={() => void persist()}>Enregistrer</button><button className="primary" onClick={run}>Tester le parcours →</button></div>
    <aside className="palette"><strong>Éléments</strong>{paletteKinds.map((kind) => <button key={kind} draggable title="Cliquez pour ajouter ou glissez sur le canvas pour positionner" onDragStart={(event) => event.dataTransfer.setData('application/treeboard-node', kind)} onClick={() => add(kind)}><i style={{ background: kindColor[kind] }} /><span>{nodeLabel[kind]}</span></button>)}<hr /><strong>Raccourcis</strong><p className="shortcut-help"><i>⌨</i><span>Suppr : supprimer<br />Ctrl/Cmd+Z : annuler<br />Ctrl/Cmd+Y : rétablir<br />Ctrl/Cmd+C / V : copier / coller</span></p><hr /><strong>Validation</strong>{issues.length ? issues.map((issue, index) => <p key={index} className={issue.level}><i>{issue.level === 'error' ? '!' : '△'}</i>{issue.message}</p>) : <p className="ok"><i>✓</i>Arbre prêt à être exécuté</p>}</aside>
    <div className="canvas" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onEdgesDelete={(deleted) => commitDraft((current) => ({ ...current, edges: current.edges.filter((edge) => !deleted.some((item) => item.id === edge.id)) }))}
        onConnect={onConnect} onNodeDragStop={(_, node) => commitDraft((current) => ({ ...current, nodes: current.nodes.map((item) => item.id === node.id ? { ...item, position: node.position } : item) }))} onNodeClick={(_, node) => { setSelected(node.id); setInspectorTab('node') }} onPaneClick={() => { setSelected(undefined); setInspectorTab('tree') }} fitView
      ><Background gap={22} size={1} color="var(--canvas-dot)" /><Controls showInteractive={false} /><MiniMap pannable zoomable nodeColor={(node) => kindColor[(node.data as unknown as FlowNodeData).node.kind]} /></ReactFlow>
    </div>
    <div className="inspector-shell"><div className="inspector-resizer" role="separator" tabIndex={0} aria-orientation="vertical" aria-label="Redimensionner le panneau de droite" aria-valuemin={300} aria-valuemax={520} aria-valuenow={inspectorWidth} onPointerDown={(event) => { event.preventDefault(); setIsResizingInspector(true) }} onKeyDown={(event) => { if (event.key === 'ArrowLeft') setInspectorWidth((current) => Math.min(520, current + 20)); if (event.key === 'ArrowRight') setInspectorWidth((current) => Math.max(300, current - 20)) }} /><aside className="inspector"><div className="inspector-tabs"><button className={inspectorTab === 'tree' ? 'active' : ''} onClick={() => setInspectorTab('tree')}>Arbre</button><button className={inspectorTab === 'node' ? 'active' : ''} disabled={!selectedNode} onClick={() => setInspectorTab('node')}>Étape</button></div>{inspectorTab === 'node' && selectedNode ? <NodeInspector key={selectedNode.id} node={selectedNode} nodes={draft.nodes} edges={draft.edges} inputs={draft.inputs} availableTrees={trees.filter((candidate) => candidate.id !== draft.id)} update={updateNode} updateChoices={updateQuestionChoices} assignPath={assignQuestionPath} createResultBranches={createResultBranches} canCreateResultBranches={!draft.edges.some((edge) => edge.source === selectedNode.id)} onRemove={deleteSelectedNode} /> : <TreeInspector tree={draft} update={(patch) => commitDraft((current) => ({ ...current, ...patch }))} addInput={addInput} updateInput={(index, patch) => commitDraft((current) => ({ ...current, inputs: current.inputs.map((item, at) => at === index ? { ...item, ...patch } : item) }))} removeInput={(index) => commitDraft((current) => ({ ...current, inputs: current.inputs.filter((_, at) => at !== index) }))} />}</aside></div>
  </section>
}

function TreeInspector({ tree, update, addInput, updateInput, removeInput }: { tree: DecisionTree; update: (patch: Partial<Pick<DecisionTree, 'title' | 'description'>>) => void; addInput: () => void; updateInput: (index: number, patch: Partial<InputDefinition>) => void; removeInput: (index: number) => void }) {
  return <><h3>Propriétés de l’arbre</h3><label>Titre de l’arbre<textarea className="tree-title-editor" rows={2} value={tree.title} onChange={(event) => update({ title: event.target.value })} /></label><label>Description<textarea value={tree.description} onChange={(event) => update({ description: event.target.value })} /></label><div className="input-head"><h3>Données initiales</h3><button onClick={addInput}>+ Ajouter</button></div>{tree.inputs.map((input, index) => <InputEditor key={input.id} input={input} update={(patch) => updateInput(index, patch)} remove={() => removeInput(index)} />)}</>
}

function InputEditor({ input, update, remove }: { input: InputDefinition; update: (patch: Partial<InputDefinition>) => void; remove: () => void }) {
  return <div className="input-editor"><input aria-label="Libellé du champ" value={input.label} onChange={(event) => update({ label: event.target.value })} /><input aria-label="Identifiant du champ" className="mono" value={input.id} onChange={(event) => update({ id: event.target.value.replace(/[^\w-]/g, '_') })} /><select value={input.type} onChange={(event) => update({ type: event.target.value as InputDefinition['type'] })}>{['text', 'textarea', 'email', 'url', 'number', 'date', 'checkbox'].map((type) => <option key={type}>{type}</option>)}</select><label><input type="checkbox" checked={input.required} onChange={(event) => update({ required: event.target.checked })} /> obligatoire</label><button className="danger" onClick={remove}>Supprimer</button></div>
}

function insertTemplateAtCursor(field: HTMLTextAreaElement | null, value: string, template: string, update: (next: string) => void) {
  const start = field?.selectionStart ?? value.length
  const end = field?.selectionEnd ?? value.length
  const next = `${value.slice(0, start)}${template}${value.slice(end)}`
  update(next)
  requestAnimationFrame(() => { field?.focus(); field?.setSelectionRange(start + template.length, start + template.length) })
}

function ActionTemplateBuilder({ inputs, insertInstruction, insertLink }: { inputs: InputDefinition[]; insertInstruction: (template: string) => void; insertLink: (template: string) => void }) {
  if (!inputs.length) return <p className="template-empty">Ajoutez des données initiales dans l’onglet Arbre pour les réutiliser ici.</p>
  return <section className="action-template-builder"><div><strong>Insérer une donnée</strong><span>dans les instructions ou dans une URL</span></div>{inputs.map((input) => <div className="template-data" key={input.id}><span title={input.id}>{input.label}</span><button onClick={() => insertInstruction(`{{${input.id}}}`)}>Instruction</button><button onClick={() => insertLink(`{{${input.id}|urlencode}}`)}>Lien</button></div>)}</section>
}

function NodeInspector({ node, nodes, edges, inputs, availableTrees, update, updateChoices, assignPath, createResultBranches, canCreateResultBranches, onRemove }: { node: TreeNode; nodes: TreeNode[]; edges: DecisionTree['edges']; inputs: InputDefinition[]; availableTrees: DecisionTree[]; update: (patch: Partial<TreeNode>) => void; updateChoices: (choices: Choice[]) => void; assignPath: (choice: Choice, targetId: string) => void; createResultBranches: () => void; canCreateResultBranches: boolean; onRemove: () => void }) {
  const instructions = useRef<HTMLTextAreaElement>(null)
  const links = useRef<HTMLTextAreaElement>(null)
  const [linkText, setLinkText] = useState(() => (node.links ?? []).map((link) => link.urlTemplate ? `${link.label}|${link.urlTemplate}` : link.label).join('\n'))
  const updateLinks = (value: string) => {
    setLinkText(value)
    update({ links: value.split('\n').filter(Boolean).map((line) => { const separator = line.indexOf('|'); return { id: crypto.randomUUID(), label: (separator < 0 ? line : line.slice(0, separator)).trim() || 'Lien', urlTemplate: (separator < 0 ? '' : line.slice(separator + 1)).trim() } }) })
  }
  return <><div className="inspector-title"><div><i style={{ background: kindColor[node.kind] }} /><h3>{nodeLabel[node.kind]}</h3></div><button className="danger icon-button" onClick={onRemove} aria-label="Supprimer l’étape">×</button></div><label>Titre<input value={node.title} onChange={(event) => update({ title: event.target.value })} /></label><label>Instructions<textarea ref={instructions} value={node.body} onChange={(event) => update({ body: event.target.value })} /></label>{node.kind === 'handoff' && <section className="handoff-editor"><strong>Arbre à ouvrir</strong><span>Les données de la session (pseudo, URL, identifiants…) sont transmises à l’arbre choisi.</span><select value={node.targetTreeId ?? ''} onChange={(event) => update({ targetTreeId: event.target.value || undefined })}><option value="">— Choisir un arbre —</option>{availableTrees.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}</select>{!availableTrees.length && <small>Créez et enregistrez d’abord un autre arbre.</small>}</section>}{node.kind === 'action' && <ActionTemplateBuilder inputs={inputs} insertInstruction={(template) => insertTemplateAtCursor(instructions.current, node.body, template, (body) => update({ body }))} insertLink={(template) => insertTemplateAtCursor(links.current, linkText, template, updateLinks)} />}{node.kind === 'action' && <section className="result-path-starter"><div><strong>Créer la suite selon le résultat</strong><span>Ajoute une décision et trois actions déjà reliées, prêtes à être renommées.</span></div><button className="primary" disabled={!canCreateResultBranches} onClick={createResultBranches}>+ Ajouter les branches de résultat</button>{!canCreateResultBranches && <small>Cette action est déjà reliée à une étape.</small>}</section>}{node.kind === 'question' && <QuestionPathsEditor node={node} nodes={nodes} edges={edges} updateChoices={updateChoices} assignPath={assignPath} />}{node.kind === 'action' && <label>Liens <span className="field-hint">libellé|URL modèle</span><textarea ref={links} className="mono" placeholder="Recherche|https://…?q={{email|urlencode}}" value={linkText} onChange={(event) => updateLinks(event.target.value)} /></label>}</>
}

function QuestionPathsEditor({ node, nodes, edges, updateChoices, assignPath }: { node: TreeNode; nodes: TreeNode[]; edges: DecisionTree['edges']; updateChoices: (choices: Choice[]) => void; assignPath: (choice: Choice, targetId: string) => void }) {
  const choices = node.choices ?? []
  const updateChoice = (id: string, patch: Partial<Choice>) => updateChoices(choices.map((choice) => choice.id === id ? { ...choice, ...patch } : choice))
  return <section className="question-paths"><div className="question-help"><strong>Décider des chemins</strong><p>Le libellé est affiché pendant le parcours. Choisissez ensuite l’étape à ouvrir pour chaque réponse.</p></div>{choices.map((choice, index) => {
    const targetId = edges.find((edge) => edge.source === node.id && edge.choiceValue === choice.value)?.target ?? ''
    return <div className="path-editor" key={choice.id}><div className="path-editor-head"><span>Chemin {index + 1}</span><button className="danger" disabled={choices.length === 1} onClick={() => updateChoices(choices.filter((item) => item.id !== choice.id))}>Supprimer</button></div><label>Réponse affichée<input value={choice.label} onChange={(event) => updateChoice(choice.id, { label: event.target.value })} /></label><label>Identifiant du chemin <span className="field-hint">unique, par exemple oui ou non</span><input className="mono" value={choice.value} onChange={(event) => updateChoice(choice.id, { value: event.target.value.trim().replace(/\s+/g, '-') })} /></label><label>Étape suivante<select value={targetId} onChange={(event) => assignPath(choice, event.target.value)}><option value="">— À relier —</option>{nodes.filter((item) => item.id !== node.id).map((item) => <option key={item.id} value={item.id}>{item.title || 'Sans titre'} · {nodeLabel[item.kind]}</option>)}</select></label></div>
  })}<button className="add-path" onClick={() => updateChoices([...choices, { id: crypto.randomUUID(), label: 'Nouvelle réponse', value: `choix-${choices.length + 1}` }])}>+ Ajouter un chemin</button></section>
}

function SessionDataEditor({ session, onSave }: { session: ExecutionSession; onSave: (changes: Record<string, string>, removed: string[]) => Promise<void> }) {
  const [entries, setEntries] = useState(() => Object.entries(session.variables).map(([key, value]) => ({ key, value })))
  const [removed, setRemoved] = useState<string[]>([])
  const saveChanges = async () => {
    const changes = Object.fromEntries(entries.filter((entry) => entry.key.trim()).map((entry) => [entry.key.trim().replace(/[^\w-]/g, '_'), entry.value]))
    const modified = Object.fromEntries(Object.entries(changes).filter(([key, value]) => session.variables[key] !== value))
    if (!Object.keys(modified).length && !removed.length) return
    await onSave(modified, removed)
  }
  return <section className="session-data-editor"><div><strong>Données trouvées</strong><span>Ajoutez ou corrigez un pseudo, une URL, un identifiant… Les valeurs seront disponibles dans les étapes et arbres suivants via <code>{'{{identifiant}}'}</code>.</span></div>{entries.map((entry, index) => <div className="session-data-row" key={`${entry.key}-${index}`}><input aria-label="Identifiant de donnée" className="mono" placeholder="twitter_url" value={entry.key} onChange={(event) => setEntries((current) => current.map((item, at) => at === index ? { ...item, key: event.target.value } : item))} /><input aria-label="Valeur de donnée" placeholder="Valeur trouvée" value={entry.value} onChange={(event) => setEntries((current) => current.map((item, at) => at === index ? { ...item, value: event.target.value } : item))} /><button className="danger" onClick={() => { if (entry.key in session.variables) setRemoved((current) => [...new Set([...current, entry.key])]); setEntries((current) => current.filter((_, at) => at !== index)) }}>Supprimer</button></div>)}<div className="session-data-actions"><button onClick={() => setEntries((current) => [...current, { key: '', value: '' }])}>+ Nouvelle donnée</button><button className="primary" onClick={() => void saveChanges()}>Enregistrer les données</button></div></section>
}

function Runner({ tree, trees, session: suppliedSession, onBack, onSave, theme, toggleTheme }: { tree: DecisionTree; trees: DecisionTree[]; session?: ExecutionSession; onBack: () => void; onSave: (session: ExecutionSession) => Promise<void>; theme: 'light' | 'dark'; toggleTheme: () => void }) {
  const [session, setSession] = useState(suppliedSession)
  const [values, setValues] = useState<Record<string, string>>(suppliedSession?.variables ?? Object.fromEntries(tree.inputs.map((input) => [input.id, input.defaultValue ?? ''])))
  const [note, setNote] = useState('')
  const currentTree = session ? trees.find((candidate) => candidate.id === session.treeId) ?? tree : tree
  const node = session ? currentTree.nodes.find((item) => item.id === session.currentNodeId) : undefined
  const save = async (next: ExecutionSession) => { setSession(next); await onSave(next) }
  const startSession = () => {
    if (tree.inputs.some((input) => input.required && !values[input.id])) return alert('Complétez les champs obligatoires.')
    try { void save(createSession(tree, values)) } catch { alert('Ajoutez une première étape à ce parcours avant de le lancer.') }
  }
  if (!session) return <section className="runner start-run"><header className="run-head"><button className="back-button" onClick={onBack} aria-label="Quitter">←</button><Logo /><span className="run-head-spacer" /><ThemeToggle theme={theme} onChange={toggleTheme} /></header><div className="run-card"><p className="eyebrow">Parcours guidé</p><h1>{tree.title}</h1><p>{tree.description || 'Suivez ce parcours étape par étape et consignez vos observations.'}</p>{tree.inputs.length ? <><h2>Informations initiales</h2>{tree.inputs.map((input) => <label key={input.id}>{input.label}{input.required && ' *'}{input.type === 'textarea' ? <textarea value={values[input.id] ?? ''} onChange={(event) => setValues({ ...values, [input.id]: event.target.value })} /> : <input type={input.type === 'checkbox' ? 'checkbox' : input.type} required={input.required} value={input.type === 'checkbox' ? undefined : values[input.id] ?? ''} checked={input.type === 'checkbox' ? values[input.id] === 'true' : undefined} onChange={(event) => setValues({ ...values, [input.id]: input.type === 'checkbox' ? String(event.target.checked) : event.target.value })} />}{input.description && <small>{input.description}</small>}</label>)}</> : null}<button className="primary launch-button" onClick={startSession}>Lancer l’analyse →</button></div></section>
  if (!node) return <section className="runner missing-step"><button onClick={onBack}>← Bibliothèque</button><p>Cette étape n’existe plus dans l’arbre.</p></section>
  const runnableNodes = currentTree.nodes.filter((item) => item.kind !== 'start')
  const progress = Math.min(100, Math.round((session.steps.length / Math.max(runnableNodes.length, 1)) * 100))
  const complete = async (status: StepStatus, answer?: string) => {
    let next = recordStep(session, currentTree, node.id, status, answer, note)
    const destination = nextNode(currentTree, node, answer)
    if (node.kind === 'end' || !destination) next = { ...next, completedAt: new Date().toISOString() }
    else next = { ...next, currentNodeId: destination.id }
    setNote('')
    await save(next)
  }
  const transfer = async () => {
    const target = trees.find((candidate) => candidate.id === node.targetTreeId)
    if (!target) return alert('Choisissez un arbre cible existant dans l’éditeur.')
    const missing = target.inputs.filter((input) => input.required && !session.variables[input.id])
    if (missing.length) return alert(`Renseignez ces données avant de continuer : ${missing.map((input) => input.label).join(', ')}.`)
    try {
      let next = recordStep(session, currentTree, node.id, 'completed', undefined, note)
      next = moveToTree(next, target)
      setNote('')
      await save(next)
    } catch { alert('L’arbre cible ne contient pas de première étape exécutable.') }
  }
  return <section className="runner"><header className="run-head"><button className="back-button" onClick={onBack} aria-label="Quitter">←</button><div className="run-title"><strong>{currentTree.title}</strong><div className="progress"><span style={{ width: `${progress}%` }} /></div></div><span className="progress-number">{progress}%</span><span className="session-saved">● Session enregistrée</span><ThemeToggle theme={theme} onChange={toggleTheme} /></header><div className="runner-grid"><aside className="context"><h3>Contexte</h3>{Object.entries(session.variables).length ? Object.entries(session.variables).map(([key, value]) => <p key={key}><small>{key}</small><span>{value || '—'}</span></p>) : <p className="context-empty">Aucune donnée initiale</p>}<h3>Historique</h3>{session.steps.length ? session.steps.map((step) => <p key={step.id} className="history"><i /><b>{step.nodeTitle ?? step.treeTitle ?? currentTree.title}</b><small>{statusLabel[step.status]}</small></p>) : <p className="context-empty">La première étape est prête.</p>}</aside><article className="step-card"><p className="eyebrow" style={{ color: kindColor[node.kind] }}>{nodeLabel[node.kind]} · étape {session.steps.length + 1}</p><h1>{renderTemplate(node.title, session.variables).value}</h1><p className="instructions">{renderTemplate(node.body, session.variables).value || 'Aucune instruction complémentaire.'}</p>{node.links?.length ? <div className="links">{node.links.map((link) => { const url = safeExternalUrl(link.urlTemplate, session.variables); return <button key={link.id} disabled={!url} onClick={() => url && confirm('Ouvrir ce lien externe dans un nouvel onglet ?') && open(url, '_blank', 'noopener,noreferrer')}>↗ <span>{link.label}</span><small>{url ? new URL(url).hostname : 'Lien invalide'}</small></button> })}</div> : null}{node.kind !== 'end' && <SessionDataEditor key={`${node.id}-${session.updatedAt}`} session={session} onSave={async (changes, removed) => save(updateSessionVariables(session, currentTree, node.id, changes, removed))} />}{node.kind === 'question' ? <div className="choices">{node.choices?.map((choice) => <button key={choice.id} onClick={() => void complete('completed', choice.value)}><span>{choice.label}</span><small>{choice.value}</small><b>→</b></button>)}</div> : node.kind === 'handoff' ? <><label className="note">Note de transition<textarea value={note} placeholder="Pourquoi cette suite est lancée, éléments utiles…" onChange={(event) => setNote(event.target.value)} /></label><button className="primary launch-button" onClick={() => void transfer()}>Continuer dans l’autre arbre →</button></> : node.kind === 'end' ? <div className="final-actions"><p className="final">Cette branche est terminée.</p><button className="complete-button" onClick={() => void complete('completed')}>Terminer et enregistrer</button><button onClick={() => download(`${currentTree.title}-rapport.md`, markdownReport(currentTree, session))}>Exporter le compte rendu</button></div> : <><label className="note">Note de cette étape<textarea value={note} placeholder="Observations, résultats, éléments à retenir…" onChange={(event) => setNote(event.target.value)} /></label><div className="status-actions">{(Object.keys(statusLabel) as StepStatus[]).map((status) => <button key={status} className={status === 'completed' ? 'complete-button' : status === 'blocked' ? 'danger' : ''} onClick={() => void complete(status)}>{statusLabel[status]}</button>)}</div></>}</article></div></section>
}
