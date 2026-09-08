export type ValidationResult = { valido: true } | { valido: false; erro: string }

export function validarGeracaoRecibo(input: {
  tipo: string
  pagamentoId: string | null
  doacaoId: string | null
  movimentacaoId: string | null
  pessoa: string | null
}): ValidationResult {
  if (input.tipo !== 'MENSALIDADE' && input.tipo !== 'CAMPANHA' && input.tipo !== 'MOVIMENTACAO') {
    return { valido: false, erro: 'Tipo de recibo inválido.' }
  }
  if (input.tipo === 'MENSALIDADE' && !input.pagamentoId) {
    return { valido: false, erro: 'Selecione o pagamento de origem do recibo.' }
  }
  if (input.tipo === 'CAMPANHA' && !input.doacaoId) {
    return { valido: false, erro: 'Selecione a doação de origem do recibo.' }
  }
  if (input.tipo === 'MOVIMENTACAO') {
    if (!input.movimentacaoId) {
      return { valido: false, erro: 'Selecione a movimentação de origem do recibo.' }
    }
    if (!input.pessoa || !input.pessoa.trim()) {
      return { valido: false, erro: 'Informe o nome da pessoa que recebeu o valor.' }
    }
  }
  return { valido: true }
}
