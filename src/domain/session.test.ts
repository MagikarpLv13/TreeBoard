import { describe, expect, it } from 'vitest'
import { checkpointSession, createSession, getSessionTree, moveToTree, recordStep, sessionAtCheckpoint, snapshotSessionTrees } from './engine'
import { emailExample } from './model'

describe('versions des arbres dans les sessions', () => {
  it('reprend la version de départ après modification ou suppression de ses étapes', () => {
    const tree = emailExample()
    const session = createSession(tree, { email: 'a@b.test' })
    const original = structuredClone(tree)
    tree.nodes[0].body = 'Instruction modifiée'
    tree.inputs[0].label = 'Champ modifié'
    tree.nodes.shift()
    expect(getSessionTree(session, [tree])).toEqual(original)
    expect(getSessionTree(session, [])?.nodes[0].id).toBe(session.currentNodeId)
  })

  it('fige chaque arbre au premier passage et réutilise sa version lors des retours', () => {
    const source = emailExample()
    const target = emailExample()
    const originalTarget = structuredClone(target)
    const moved = moveToTree(createSession(source, {}), target)
    target.nodes.shift()
    target.title = 'Version modifiée'
    const returned = moveToTree(moveToTree(moved, source), target)
    expect(getSessionTree(returned, [target])).toEqual(originalTarget)
    expect(returned.currentNodeId).toBe(originalTarget.nodes[0].id)
    expect(returned.treeTitle).toBe(originalTarget.title)
    expect(returned.treeSnapshots?.[source.id]).toEqual(source)
  })

  it('conserve la compatibilité avec une session antérieure au correctif', () => {
    const tree = emailExample()
    const session = createSession(tree, {})
    delete session.treeSnapshots
    expect(getSessionTree(session, [tree])).toBe(tree)
    expect(getSessionTree(session, [])).toBeUndefined()
  })

  it('protège aussi les arbres déjà parcourus lors de la migration des anciennes sessions', () => {
    const source = emailExample()
    const target = emailExample()
    const legacy = checkpointSession(moveToTree(createSession(source, {}), target))
    delete legacy.treeSnapshots
    const migrated = snapshotSessionTrees(legacy, [source, target])
    expect(Object.keys(migrated.treeSnapshots!)).toEqual(expect.arrayContaining([source.id, target.id]))
    source.nodes.length = 0
    target.nodes.length = 0
    expect(getSessionTree(sessionAtCheckpoint(migrated, 0), [])?.nodes).toHaveLength(4)
    expect(getSessionTree(migrated, [])?.nodes).toHaveLength(4)
    expect(snapshotSessionTrees(migrated, [source, target])).toBe(migrated)
  })

  it('ne marque pas une étape antérieure comme terminée après la clôture', () => {
    const tree = emailExample()
    const started = createSession(tree, {})
    const finished = checkpointSession({
      ...recordStep(started, tree, tree.nodes[0].id, 'completed'),
      currentNodeId: tree.nodes[1].id,
      completedAt: new Date().toISOString(),
    })
    expect(sessionAtCheckpoint(finished, 0).completedAt).toBeUndefined()
    expect(sessionAtCheckpoint(finished, 1).completedAt).toBeDefined()
  })
})
