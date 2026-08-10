import { describe, expect, it } from 'vitest'
import { normalizeUsername, usernameToAuthEmail } from './auth'

describe('normalizeUsername', () => {
  it('remove espaços e converte para minúsculas', () => {
    expect(normalizeUsername('  Joao.Silva ')).toBe('joao.silva')
  })
})

describe('usernameToAuthEmail', () => {
  it('gera e-mail interno determinístico a partir do username', () => {
    expect(usernameToAuthEmail('Joao.Silva')).toBe('joao.silva@loja.internal')
  })

  it('rejeita username vazio', () => {
    expect(() => usernameToAuthEmail('   ')).toThrow('username inválido')
  })
})
