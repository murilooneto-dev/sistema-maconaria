import { describe, expect, it } from 'vitest'
import {
  validarConfigMensalidade,
  validarConta,
  validarFormaPagamento,
  validarLoja,
} from './configuracoes'

describe('validarLoja', () => {
  it('aceita um nome válido', () => {
    expect(validarLoja({ nome: 'Loja Exemplo' })).toEqual({ valido: true })
  })

  it('rejeita nome vazio', () => {
    expect(validarLoja({ nome: '  ' })).toEqual({ valido: false, erro: 'Informe o nome da loja.' })
  })
})

describe('validarConfigMensalidade', () => {
  const base = { tipo: 'NORMAL', valorMensalidade: 150, valorGrandeLoja: 50 }

  it('aceita um input válido', () => {
    expect(validarConfigMensalidade(base)).toEqual({ valido: true })
  })

  it('rejeita tipo inválido', () => {
    expect(validarConfigMensalidade({ ...base, tipo: 'X' })).toEqual({
      valido: false,
      erro: 'Tipo inválido.',
    })
  })

  it('rejeita valor de mensalidade negativo', () => {
    expect(validarConfigMensalidade({ ...base, valorMensalidade: -1 })).toEqual({
      valido: false,
      erro: 'Informe um valor de mensalidade válido.',
    })
  })

  it('rejeita valor de mensalidade não numérico', () => {
    expect(validarConfigMensalidade({ ...base, valorMensalidade: Number('abc') })).toEqual({
      valido: false,
      erro: 'Informe um valor de mensalidade válido.',
    })
  })

  it('rejeita valor de Grande Loja negativo', () => {
    expect(validarConfigMensalidade({ ...base, valorGrandeLoja: -1 })).toEqual({
      valido: false,
      erro: 'Informe um valor de Grande Loja válido.',
    })
  })

  it('rejeita valor de Grande Loja maior que o valor da mensalidade', () => {
    expect(validarConfigMensalidade({ ...base, valorGrandeLoja: 200 })).toEqual({
      valido: false,
      erro: 'O valor da Grande Loja não pode ser maior que o valor da mensalidade.',
    })
  })
})

describe('validarConta', () => {
  const base = { nome: 'Caixa', saldoInicial: 100, dataSaldoInicial: '2026-01-01' }

  it('aceita um input válido', () => {
    expect(validarConta(base)).toEqual({ valido: true })
  })

  it('rejeita nome vazio', () => {
    expect(validarConta({ ...base, nome: '' })).toEqual({
      valido: false,
      erro: 'Informe o nome da conta.',
    })
  })

  it('rejeita saldo inicial não numérico', () => {
    expect(validarConta({ ...base, saldoInicial: Number('abc') })).toEqual({
      valido: false,
      erro: 'Informe um saldo inicial válido.',
    })
  })

  it('rejeita data do saldo inicial vazia', () => {
    expect(validarConta({ ...base, dataSaldoInicial: '' })).toEqual({
      valido: false,
      erro: 'Informe a data do saldo inicial.',
    })
  })
})

describe('validarFormaPagamento', () => {
  it('aceita um nome válido', () => {
    expect(validarFormaPagamento({ nome: 'PIX' })).toEqual({ valido: true })
  })

  it('rejeita nome vazio', () => {
    expect(validarFormaPagamento({ nome: '' })).toEqual({
      valido: false,
      erro: 'Informe o nome da forma de pagamento.',
    })
  })
})
