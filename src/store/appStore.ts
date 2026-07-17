import { create } from 'zustand'
import { db } from '../data/db'
import { osintEmailExample, type DecisionTree, type ExecutionSession } from '../domain/model'
type Screen = 'library' | 'editor' | 'run'
interface State { trees: DecisionTree[]; sessions: ExecutionSession[]; activeTree?: DecisionTree; activeSession?: ExecutionSession; screen: Screen; loaded: boolean; load: () => Promise<void>; saveTree: (tree: DecisionTree) => Promise<void>; removeTree: (id: string) => Promise<void>; setScreen: (screen: Screen) => void; setActiveTree: (tree?: DecisionTree) => void; saveSession: (session: ExecutionSession) => Promise<void>; setActiveSession: (session?: ExecutionSession) => void; removeSession: (id: string) => Promise<void> }
let loadPromise: Promise<void> | undefined
export const useAppStore = create<State>((set, get) => ({
  trees: [], sessions: [], screen: 'library', loaded: false,
  load: async () => {
    if (get().loaded) return
    if (loadPromise) return loadPromise
    loadPromise = (async () => {
      const trees = await db.transaction('rw', db.trees, async () => {
        const existing = await db.trees.orderBy('updatedAt').reverse().toArray()
        const savedExample = existing.find((tree) => tree.isExample || tree.title === 'Qualification d’une adresse e-mail')
        if (savedExample) {
          if (savedExample.isExample) return existing
          const markedExample = { ...savedExample, isExample: true }
          await db.trees.put(markedExample)
          return existing.map((tree) => tree.id === markedExample.id ? markedExample : tree)
        }
        const example = osintEmailExample()
        await db.trees.add(example)
        return [example, ...existing]
      })
      set({ trees, sessions: await db.sessions.orderBy('updatedAt').reverse().toArray(), loaded: true })
    })()
    try { await loadPromise } finally { loadPromise = undefined }
  },
  saveTree: async (tree) => { const saved = { ...tree, updatedAt: new Date().toISOString() }; await db.trees.put(saved); set({ trees: [saved, ...get().trees.filter((item) => item.id !== saved.id)], activeTree: saved }) },
  removeTree: async (id) => { await db.transaction('rw', db.trees, db.sessions, async () => { await db.trees.delete(id); await db.sessions.where('treeId').equals(id).delete() }); set({ trees: get().trees.filter((tree) => tree.id !== id), sessions: get().sessions.filter((session) => session.treeId !== id) }) },
  setScreen: (screen) => set({ screen }), setActiveTree: (activeTree) => set({ activeTree }),
  saveSession: async (session) => { await db.sessions.put(session); set({ sessions: [session, ...get().sessions.filter((item) => item.id !== session.id)], activeSession: session }) }, setActiveSession: (activeSession) => set({ activeSession }),
  removeSession: async (id) => { await db.sessions.delete(id); set({ sessions: get().sessions.filter((session) => session.id !== id) }) },
}))
