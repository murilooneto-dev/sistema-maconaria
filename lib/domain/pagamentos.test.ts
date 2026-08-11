// lib/domain/pagamentos.test.ts
import { describe, expect, it } from 'vitest'
import {
  calcularNovoStatusMensalidade,
  calcularValorTotal,
  validarAlocacoes,
} from './pagamentos'

describe('validarAlocacoes', () => {
  const mensalidades = [
    { id: 'm1', saldo: 150 },
    { id: 'm2', saldo: 100 },
  ]

  it('rejeita lista vazia', () => {
    expect(validarAlocacoes([], mensalidades)).toEqual({
      valido: false,
      erro: 'Selecione ao menos uma competência.',
    })
  })

  it('aceita uma alocação de valor igual ao saldo (pagamento integral)', () => {
    expect(validarAlocacoes([{ mensalidadeId: 'm1', valorAplicado: 150 }], mensalidades)).toEqual({
      valido: true,
    })
  })

  it('aceita uma alocação menor que o saldo (pagamento parcial)', () => {
    expect(validarAlocacoes([{ mensalidadeId: 'm1', valorAplicado: 100 }], mensalidades)).toEqual({
      valido: true,
    })
  })

  it('aceita múltiplas competências (pagamento de várias competências / acima do valor de uma)', () => {
    expect(
      validarAlocacoes(
        [
          { mensalidadeId: 'm1', valorAplicado: 150 },
          { mensalidadeId: 'm2', valorAplicado: 100 },
        ],
        mensalidades
      )
    ).toEqual({ valido: true })
  })

  it('rejeita valor zero ou negativo', () => {
    expect(validarAlocacoes([{ mensalidadeId: 'm1', valorAplicado: 0 }], mensalidades)).toEqual({
      valido: false,
      erro: 'Informe um valor válido para cada competência selecionada.',
    })
  })

  it('rejeita competência não encontrada na lista', () => {
    expect(validarAlocacoes([{ mensalidadeId: 'inexistente', valorAplicado: 50 }], mensalidades)).toEqual({
      valido: false,
      erro: 'Competência selecionada não encontrada.',
    })
  })

  it('rejeita valor aplicado maior que o saldo da competência (SPEC §13: não criar competência automaticamente)', () => {
    expect(validarAlocacoes([{ mensalidadeId: 'm1', valorAplicado: 200 }], mensalidades)).toEqual({
      valido: false,
      erro: 'O valor aplicado não pode ser maior que o saldo devido da competência.',
    })
  })
})

describe('calcularNovoStatusMensalidade', () => {
  it('retorna QUITADA quando o valor pago iguala o devido', () => {
    expect(calcularNovoStatusMensalidade(150, 150)).toBe('QUITADA')
  })

  it('retorna QUITADA quando o valor pago excede o devido (não deveria ocorrer, mas não deve travar)', () => {
    expect(calcularNovoStatusMensalidade(150, 160)).toBe('QUITADA')
  })

  it('retorna PARCIAL quando o valor pago é menor que o devido', () => {
    expect(calcularNovoStatusMensalidade(150, 100)).toBe('PARCIAL')
  })
})

describe('calcularValorTotal', () => {
  it('soma o valor aplicado de todas as alocações', () => {
    expect(
      calcularValorTotal([
        { mensalidadeId: 'm1', valorAplicado: 150 },
        { mensalidadeId: 'm2', valorAplicado: 100 },
      ])
    ).toBe(250)
  })

  it('retorna 0 para lista vazia', () => {
    expect(calcularValorTotal([])).toBe(0)
  })
})
