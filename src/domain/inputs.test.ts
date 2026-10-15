import { describe, expect, it } from 'vitest'
import { validateInputs } from './inputs'
import type { InputDefinition } from './model'

const input = (type: InputDefinition['type'], required = true): InputDefinition => ({ id: 'field', label: 'Champ', type, required, ...(type === 'select' ? { options: ['Premier', 'Second'] } : {}) })

describe('validation des données de parcours', () => {
  it.each(['', 'false'])('refuse une case obligatoire décochée (%s)', (value) => {
    expect(validateInputs([input('checkbox')], { field: value })).toHaveLength(1)
  })
  it('accepte une case cochée et une case facultative décochée', () => {
    expect(validateInputs([input('checkbox')], { field: 'true' })).toEqual([])
    expect(validateInputs([input('checkbox', false)], { field: 'false' })).toEqual([])
  })
  it.each(['text', 'textarea'] as const)('refuse un champ %s ne contenant que des espaces', (type) => {
    expect(validateInputs([input(type)], { field: '  \n ' })).toHaveLength(1)
  })
  it.each([
    ['email', 'invalide', 'contact@example.com'],
    ['url', 'pas une URL', 'https://example.com'],
    ['number', 'abc', '0.5'],
    ['date', '2026-02-30', '2026-02-28'],
    ['select', 'inconnu', 'Second'],
  ] as const)('valide le type %s même pour une donnée facultative non vide', (type, invalid, valid) => {
    expect(validateInputs([input(type, false)], { field: invalid })).toHaveLength(1)
    expect(validateInputs([input(type)], { field: valid })).toEqual([])
    expect(validateInputs([input(type, false)], {})).toEqual([])
  })
})
