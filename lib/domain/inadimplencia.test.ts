import { describe, expect, it } from 'vitest'
import { calcularSituacaoMembro } from './inadimplencia'

describe('calcularSituacaoMembro', () => {
  it('retorna ATIVO com zero competências vencidas', () => {
    expect(calcularSituacaoMembro(0)).toBe('ATIVO')
  })

  it('retorna ATIVO com exatamente 6 competências vencidas (limite)', () => {
    expect(calcularSituacaoMembro(6)).toBe('ATIVO')
  })

  it('retorna INATIVO com 7 competências vencidas', () => {
    expect(calcularSituacaoMembro(7)).toBe('INATIVO')
  })

  it('retorna INATIVO com muitas competências vencidas', () => {
    expect(calcularSituacaoMembro(20)).toBe('INATIVO')
  })
})
