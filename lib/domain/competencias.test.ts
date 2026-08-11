import { describe, expect, it } from 'vitest'
import { competenciasFaltantes, proximaCompetenciaAposCadastro } from './competencias'

describe('proximaCompetenciaAposCadastro', () => {
  it('retorna o mês seguinte ao cadastro (SPEC: cadastro 15/08/2026 → primeira competência 09/2026)', () => {
    expect(proximaCompetenciaAposCadastro('2026-08-15')).toEqual({ ano: 2026, mes: 9 })
  })

  it('vira o ano quando o cadastro é em dezembro', () => {
    expect(proximaCompetenciaAposCadastro('2026-12-01')).toEqual({ ano: 2027, mes: 1 })
  })
})

describe('competenciasFaltantes', () => {
  it('não gera nada se a primeira competência ainda não chegou (cadastro no mês atual)', () => {
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
