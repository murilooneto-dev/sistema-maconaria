import { describe, expect, it } from 'vitest'
import { podeExcluirMensalidade } from './mensalidades'

describe('podeExcluirMensalidade', () => {
  it('permite excluir mensalidade PENDENTE sem pagamento', () => {
    expect(podeExcluirMensalidade({ status: 'PENDENTE', valor_pago: 0 })).toEqual({ valido: true })
  })

  it.each(['PARCIAL', 'QUITADA', 'NAO_APLICAVEL'])('rejeita mensalidade %s', (status) => {
    expect(podeExcluirMensalidade({ status, valor_pago: 50 }).valido).toBe(false)
  })

  it('rejeita PENDENTE que tenha valor pago (estado inconsistente não pode ser excluído)', () => {
    expect(podeExcluirMensalidade({ status: 'PENDENTE', valor_pago: 10 }).valido).toBe(false)
  })

  it('rejeita mensalidade já excluída com mensagem própria', () => {
    expect(podeExcluirMensalidade({ status: 'CANCELADA', valor_pago: 0 })).toEqual({
      valido: false,
      erro: 'Esta mensalidade já foi excluída.',
    })
  })
})
