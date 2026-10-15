import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { createSession, getSessionTree } from '../domain/engine'
import { emailExample } from '../domain/model'
import { useAppStore } from './appStore'

beforeEach(async () => {
  await db.trees.clear()
  await db.sessions.clear()
  useAppStore.setState({ loaded: false, trees: [], sessions: [] })
})

describe('persistance des versions des arbres', () => {
  it('migre une ancienne session avant de permettre la modification de son arbre', async () => {
    const tree = emailExample()
    const session = createSession(tree, { email: 'a@b.test' })
    delete session.treeSnapshots
    await db.trees.put(tree)
    await db.sessions.put(session)
    await useAppStore.getState().load()
    await useAppStore.getState().saveTree({ ...tree, nodes: [] })
    const savedSession = await db.sessions.get(session.id)
    expect(getSessionTree(savedSession!, [])?.nodes).toEqual(tree.nodes)
    expect(useAppStore.getState().sessions[0].treeSnapshots?.[tree.id]).toEqual(tree)
    expect((await db.trees.get(tree.id))?.nodes).toEqual([])
  })
})
