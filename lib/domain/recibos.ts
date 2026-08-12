export type ValidationResult = { valido: true } | { valido: false; erro: string }

export function validarGeracaoRecibo(input: {
  tipo: string
  pagamentoId: string | null
  doacaoId: string | null
}): ValidationResult {
  if (input.tipo !== 'MENSALIDADE' && input.tipo !== 'CAMPANHA') {
    return { valido: false, erro: 'Tipo de recibo inválido.' }
  }
  if (input.tipo === 'MENSALIDADE' && !input.pagamentoId) {
    return { valido: false, erro: 'Selecione o pagamento de origem do recibo.' }
  }
  if (input.tipo === 'CAMPANHA' && !input.doacaoId) {
    return { valido: false, erro: 'Selecione a doação de origem do recibo.' }
  }
  return { valido: true }
}
