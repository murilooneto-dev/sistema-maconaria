import { describe, expect, it } from 'vitest'
import { competenciaAtual, hojeISO, primeiroDiaMesAtual } from './datas'

describe('datas no fuso da Loja (Brasília)', () => {
  it('às 22h de 31/10 em Brasília ainda é outubro, mesmo já sendo novembro em UTC', () => {
    const agora = new Date('2026-11-01T01:00:00Z')
    expect(hojeISO(agora)).toBe('2026-10-31')
    expect(competenciaAtual(agora)).toEqual({ ano: 2026, mes: 10 })
    expect(primeiroDiaMesAtual(agora)).toBe('2026-10-01')
  })

  it('às 22h de 31/12 em Brasília ainda é o ano corrente', () => {
    const agora = new Date('2027-01-01T01:00:00Z')
    expect(competenciaAtual(agora)).toEqual({ ano: 2026, mes: 12 })
  })

  it('vira o mês à meia-noite de Brasília', () => {
    expect(hojeISO(new Date('2026-11-01T03:00:00Z'))).toBe('2026-11-01')
  })
})
