// lib/domain/financeiro.test.ts
import { describe, expect, it } from 'vitest'
import { podeEditarMovimentacao } from './financeiro'

describe('podeEditarMovimentacao', () => {
  it('permite edição de movimentação ATIVA de origem MANUAL', () => {
    expect(podeEditarMovimentacao({ status: 'ATIVO', origem: 'MANUAL' })).toEqual({ valido: true })
  })

  it('rejeita movimentação CANCELADA independente da origem', () => {
    expect(podeEditarMovimentacao({ status: 'CANCELADO', origem: 'MANUAL' })).toEqual({
      valido: false,
      erro: 'Esta movimentação já foi cancelada ou editada.',
    })
    expect(podeEditarMovimentacao({ status: 'CANCELADO', origem: 'MENSALIDADE' })).toEqual({
      valido: false,
      erro: 'Esta movimentação já foi cancelada ou editada.',
    })
  })

  it('rejeita movimentação ATIVA de origem MENSALIDADE com mensagem específica', () => {
    expect(podeEditarMovimentacao({ status: 'ATIVO', origem: 'MENSALIDADE' })).toEqual({
      valido: false,
      erro: 'Esta movimentação é gerada automaticamente por um pagamento de mensalidade — cancele o pagamento na tela de Mensalidades.',
    })
  })

  it('rejeita movimentação ATIVA de origem CAMPANHA com mensagem específica', () => {
    expect(podeEditarMovimentacao({ status: 'ATIVO', origem: 'CAMPANHA' })).toEqual({
      valido: false,
      erro: 'Esta movimentação é gerada automaticamente por uma doação de campanha — cancele a doação na tela de Campanhas.',
    })
  })

  it('rejeita movimentação ATIVA de origem GRANDE_LOJA com mensagem específica', () => {
    expect(podeEditarMovimentacao({ status: 'ATIVO', origem: 'GRANDE_LOJA' })).toEqual({
      valido: false,
      erro: 'Esta movimentação é gerada automaticamente por um repasse à Grande Loja — cancele o repasse na tela de Grande Loja.',
    })
  })

  it('rejeita movimentação ATIVA de origem desconhecida/futura com mensagem genérica (fail-closed)', () => {
    expect(podeEditarMovimentacao({ status: 'ATIVO', origem: 'OUTRA' })).toEqual({
      valido: false,
      erro: 'Esta movimentação não pode ser editada.',
    })
  })
})
