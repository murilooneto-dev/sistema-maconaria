export type ValidationResult = { valido: true } | { valido: false; erro: string }

/**
 * "Excluir" uma mensalidade é marcá-la como CANCELADA — a competência nunca
 * é apagada do banco. Só vale para competência PENDENTE sem nenhum valor
 * pago: se houve pagamento (PARCIAL/QUITADA), o caminho é cancelar o
 * pagamento primeiro, senão o dinheiro recebido ficaria sem competência.
 */
export function podeExcluirMensalidade(mensalidade: { status: string; valor_pago: number }): ValidationResult {
  if (mensalidade.status === 'CANCELADA') {
    return { valido: false, erro: 'Esta mensalidade já foi excluída.' }
  }
  if (mensalidade.status !== 'PENDENTE' || Number(mensalidade.valor_pago) > 0) {
    return {
      valido: false,
      erro: 'Só é possível excluir mensalidade pendente e sem pagamento. Cancele o pagamento antes.',
    }
  }
  return { valido: true }
}
