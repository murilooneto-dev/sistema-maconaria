import { describe, expect, it } from 'vitest'
import { canAccess } from './authorization'

describe('canAccess', () => {
  it('nega quando o perfil é null', () => {
    expect(canAccess(null, 'ADMINISTRADOR')).toBe(false)
  })

  it('nega quando o perfil está inativo, mesmo sendo ADMINISTRADOR', () => {
    expect(canAccess({ role: 'ADMINISTRADOR', ativo: false }, 'ADMINISTRADOR')).toBe(false)
  })

  it('permite ADMINISTRADOR ativo quando o mínimo é ADMINISTRADOR', () => {
    expect(canAccess({ role: 'ADMINISTRADOR', ativo: true }, 'ADMINISTRADOR')).toBe(true)
  })

  it('nega TESOUREIRO quando o mínimo é ADMINISTRADOR', () => {
    expect(canAccess({ role: 'TESOUREIRO', ativo: true }, 'ADMINISTRADOR')).toBe(false)
  })

  it('permite TESOUREIRO ativo quando o mínimo é TESOUREIRO', () => {
    expect(canAccess({ role: 'TESOUREIRO', ativo: true }, 'TESOUREIRO')).toBe(true)
  })

  it('permite ADMINISTRADOR ativo quando o mínimo é TESOUREIRO', () => {
    expect(canAccess({ role: 'ADMINISTRADOR', ativo: true }, 'TESOUREIRO')).toBe(true)
  })

  it('nega CONSULTA quando o mínimo é TESOUREIRO', () => {
    expect(canAccess({ role: 'CONSULTA', ativo: true }, 'TESOUREIRO')).toBe(false)
  })
})
