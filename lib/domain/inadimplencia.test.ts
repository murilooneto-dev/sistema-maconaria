import { describe, expect, it } from 'vitest'
import {
  calcularSituacaoMembro,
  competenciaVencida,
  contarCompetenciasVencidasNaoPagas,
} from './inadimplencia'

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

  it('retorna INATIVO com exatamente 12 competências vencidas (limite)', () => {
    expect(calcularSituacaoMembro(12)).toBe('INATIVO')
  })

  it('retorna IRREGULAR com 13 competências vencidas', () => {
    expect(calcularSituacaoMembro(13)).toBe('IRREGULAR')
  })

  it('retorna IRREGULAR com muitas competências vencidas', () => {
    expect(calcularSituacaoMembro(30)).toBe('IRREGULAR')
  })
})

describe('competenciaVencida', () => {
  it('competência de mês anterior ao atual está vencida', () => {
    expect(competenciaVencida({ ano: 2026, mes: 6 }, { ano: 2026, mes: 8 })).toBe(true)
  })

  it('competência do mês atual não está vencida', () => {
    expect(competenciaVencida({ ano: 2026, mes: 8 }, { ano: 2026, mes: 8 })).toBe(false)
  })

  it('competência futura não está vencida', () => {
    expect(competenciaVencida({ ano: 2026, mes: 9 }, { ano: 2026, mes: 8 })).toBe(false)
  })

  it('considera o ano na comparação', () => {
    expect(competenciaVencida({ ano: 2025, mes: 12 }, { ano: 2026, mes: 1 })).toBe(true)
  })
})

describe('contarCompetenciasVencidasNaoPagas', () => {
  const hoje = { ano: 2026, mes: 8 }

  it('conta apenas PENDENTE/PARCIAL vencidas', () => {
    const mensalidades = [
      { ano: 2026, mes: 1, status: 'PENDENTE' },
      { ano: 2026, mes: 2, status: 'PARCIAL' },
      { ano: 2026, mes: 3, status: 'QUITADA' },
      { ano: 2026, mes: 4, status: 'CANCELADA' },
      { ano: 2026, mes: 5, status: 'NAO_APLICAVEL' },
      { ano: 2026, mes: 9, status: 'PENDENTE' }, // futura, não conta
    ]
    expect(contarCompetenciasVencidasNaoPagas(mensalidades, hoje)).toBe(2)
  })

  it('retorna 0 quando não há competências vencidas', () => {
    expect(contarCompetenciasVencidasNaoPagas([], hoje)).toBe(0)
  })
})
