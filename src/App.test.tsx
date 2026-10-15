// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createSession } from './domain/engine'
import { blankNode, emailExample, type DecisionTree, type InputDefinition } from './domain/model'
import { useAppStore } from './store/appStore'

const saveSession = vi.fn(async () => {})

beforeEach(() => {
  saveSession.mockClear()
  vi.stubGlobal('alert', vi.fn())
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  useAppStore.setState({ loaded: true, screen: 'run', activeSession: undefined, sessions: [], saveSession })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function showTree(inputs?: InputDefinition[]): DecisionTree {
  const tree = emailExample()
  if (inputs) tree.inputs = inputs
  useAppStore.setState({ activeTree: tree, trees: [tree] })
  render(<App />)
  return tree
}

describe('lancement du parcours', () => {
  it('ne lance pas une session après avoir coché puis décoché une case obligatoire', () => {
    showTree([{ id: 'agreement', label: 'Accord', type: 'checkbox', required: true }])
    const checkbox = screen.getByRole('checkbox', { name: 'Accord *' })
    fireEvent.click(checkbox)
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole('button', { name: 'Lancer l’analyse →' }))
    expect(saveSession).not.toHaveBeenCalled()
    expect(checkbox).toHaveProperty('checked', false)
  })

  it('refuse une adresse e-mail invalide avec la validation native', () => {
    showTree()
    fireEvent.change(screen.getByRole('textbox', { name: /Adresse e-mail/ }), { target: { value: 'invalide' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lancer l’analyse →' }))
    expect(saveSession).not.toHaveBeenCalled()
  })

  it('refuse des espaces dans une zone de texte obligatoire', () => {
    showTree([{ id: 'context', label: 'Contexte', type: 'textarea', required: true }])
    fireEvent.change(screen.getByRole('textbox', { name: 'Contexte *' }), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lancer l’analyse →' }))
    expect(saveSession).not.toHaveBeenCalled()
    expect(alert).toHaveBeenCalledWith('Renseignez « Contexte ».')
  })

  it('permet de choisir une option et de saisir un nombre décimal', () => {
    showTree([
      { id: 'option', label: 'Option', type: 'select', required: true, options: ['Premier', 'Second'] },
      { id: 'amount', label: 'Quantité', type: 'number', required: true },
    ])
    fireEvent.change(screen.getByRole('combobox', { name: 'Option *' }), { target: { value: 'Second' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Quantité *' }), { target: { value: '0.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lancer l’analyse →' }))
    expect(saveSession).toHaveBeenCalledWith(expect.objectContaining({ variables: { option: 'Second', amount: '0.5' } }))
  })
})

describe('reprise et clôture du parcours', () => {
  it('reprend une étape conservée dans la session après sa suppression de la bibliothèque', () => {
    const tree = emailExample()
    const session = createSession(tree, {})
    const edited = { ...tree, nodes: [] }
    useAppStore.setState({ activeTree: edited, trees: [edited], activeSession: session })
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Vérifier le domaine')
  })

  it('affiche 100 % après une conclusion sans compter les branches alternatives', () => {
    showTree([])
    fireEvent.click(screen.getByRole('button', { name: 'Lancer l’analyse →' }))
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Terminé' }))
    fireEvent.click(screen.getByRole('button', { name: /Oui, à examiner/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Terminer et enregistrer' }))
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100')
    fireEvent.click(screen.getByRole('button', { name: '← Étape précédente' }))
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).not.toBe('100')
  })

  it('valide aussi les cases obligatoires lors du passage à un autre arbre', () => {
    const target = emailExample()
    target.inputs = [{ id: 'agreement', label: 'Accord', type: 'checkbox', required: true }]
    const source = emailExample()
    source.nodes = [{ ...blankNode('handoff'), targetTreeId: target.id }]
    source.edges = []
    const session = createSession(source, { agreement: 'false' })
    useAppStore.setState({ activeTree: source, trees: [source, target], activeSession: session })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Continuer dans l’autre arbre →' }))
    expect(saveSession).not.toHaveBeenCalled()
    expect(alert).toHaveBeenCalledWith('Cochez « Accord » pour continuer.')
  })
})
