import { describe, expect, it } from 'vitest'
import { DecisionTreeSchema, osintEmailExample } from './model'

describe('exemple de référence', () => {
  it('est identifié comme exemple et respecte le schéma d’import', () => {
    const example = osintEmailExample()
    expect(example.isExample).toBe(true)
    expect(DecisionTreeSchema.parse(example)).toEqual(example)
  })
})
