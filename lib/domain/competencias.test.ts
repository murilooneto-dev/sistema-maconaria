import { describe, expect, it } from 'vitest'
import { competenciaDoCadastro, competenciasFaltantes, primeiraCompetenciaDoAno } from './competencias'

describe('competenciaDoCadastro', () => {
  it('retorna o próprio mês do cadastro (cadastro 15/08/2026 → primeira competência 08/2026)', () => {
    expect(competenciaDoCadastro('2026-08-15')).toEqual({ ano: 2026, mes: 8 })
  })

  it('não desloca o mês no primeiro e no último dia (sem efeito de fuso horário)', () => {
    expect(competenciaDoCadastro('2026-08-01')).toEqual({ ano: 2026, mes: 8 })
    expect(competenciaDoCadastro('2026-12-31')).toEqual({ ano: 2026, mes: 12 })
  })
})

describe('primeiraCompetenciaDoAno', () => {
  it('começa no mês do cadastro quando o membro entrou no meio do ano', () => {
    expect(primeiraCompetenciaDoAno('2026-10-09', 2026)).toEqual({ ano: 2026, mes: 10 })
  })

  it('começa em janeiro quando o cadastro é de um ano anterior', () => {
    expect(primeiraCompetenciaDoAno('2026-10-09', 2027)).toEqual({ ano: 2027, mes: 1 })
  })

  it('começa em janeiro quando o cadastro foi em janeiro do próprio ano', () => {
    expect(primeiraCompetenciaDoAno('2026-01-20', 2026)).toEqual({ ano: 2026, mes: 1 })
  })

  it('cadastro em 09/10/2026 gera só outubro, novembro e dezembro de 2026', () => {
    const primeira = primeiraCompetenciaDoAno('2026-10-09', 2026)
    expect(competenciasFaltantes(primeira, { ano: 2026, mes: 12 }, [])).toEqual([
      { ano: 2026, mes: 10 },
      { ano: 2026, mes: 11 },
      { ano: 2026, mes: 12 },
    ])
  })

  it('não gera nada para um ano anterior ao cadastro', () => {
    const primeira = primeiraCompetenciaDoAno('2026-10-09', 2025)
    expect(competenciasFaltantes(primeira, { ano: 2025, mes: 12 }, [])).toEqual([])
  })
})

describe('competenciasFaltantes', () => {
  it('não gera nada se a primeira competência é posterior ao limite', () => {
    const primeira = { ano: 2026, mes: 9 }
    const ate = { ano: 2026, mes: 8 }
    expect(competenciasFaltantes(primeira, ate, [])).toEqual([])
  })

  it('gera todas as competências entre a primeira e a atual quando não existe nenhuma', () => {
    const primeira = { ano: 2026, mes: 4 }
    const ate = { ano: 2026, mes: 6 }
    expect(competenciasFaltantes(primeira, ate, [])).toEqual([
      { ano: 2026, mes: 4 },
      { ano: 2026, mes: 5 },
      { ano: 2026, mes: 6 },
    ])
  })

  it('não repete competências já existentes', () => {
    const primeira = { ano: 2026, mes: 4 }
    const ate = { ano: 2026, mes: 6 }
    const existentes = [{ ano: 2026, mes: 5 }]
    expect(competenciasFaltantes(primeira, ate, existentes)).toEqual([
      { ano: 2026, mes: 4 },
      { ano: 2026, mes: 6 },
    ])
  })

  it('atravessa a virada de ano corretamente', () => {
    const primeira = { ano: 2026, mes: 11 }
    const ate = { ano: 2027, mes: 2 }
    expect(competenciasFaltantes(primeira, ate, [])).toEqual([
      { ano: 2026, mes: 11 },
      { ano: 2026, mes: 12 },
      { ano: 2027, mes: 1 },
      { ano: 2027, mes: 2 },
    ])
  })
})
