import Dexie, { type Table } from 'dexie'
import type { DecisionTree, ExecutionSession } from '../domain/model'
class AppDatabase extends Dexie { trees!: Table<DecisionTree, string>; sessions!: Table<ExecutionSession, string>; constructor() { super('decision-tree-studio'); this.version(1).stores({ trees: 'id, updatedAt, title', sessions: 'id, treeId, updatedAt, completedAt' }) } }
export const db = new AppDatabase()
