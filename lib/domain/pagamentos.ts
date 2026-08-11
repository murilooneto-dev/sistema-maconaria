export type AlocacaoCompetencia = { mensalidadeId: string; valorAplicado: number }
export type MensalidadeParaPagamento = { id: string; saldo: number }
export type ValidationResult = { valido: true } | { valido: false; erro: string }

/**
 * Valida as alocações de um pagamento contra o saldo real de cada
 * competência. Um valor maior que o saldo de uma competência é rejeitado —
 * SPEC §13: pagamento acima do valor de uma competência exige selecionar
 * OUTRAS competências existentes, nunca criar uma nova automaticamente.
 */
export function validarAlocacoes(
  alocacoes: AlocacaoCompetencia[],
  mensalidades: MensalidadeParaPagamento[]
): ValidationResult {
  if (alocacoes.length === 0) {
    return { valido: false, erro: 'Selecione ao menos uma competência.' }
  }

  for (const alocacao of alocacoes) {
    if (!Number.isFinite(alocacao.valorAplicado) || alocacao.valorAplicado <= 0) {
      return { valido: false, erro: 'Informe um valor válido para cada competência selecionada.' }
    }

    const mensalidade = mensalidades.find((m) => m.id === alocacao.mensalidadeId)
    if (!mensalidade) {
      return { valido: false, erro: 'Competência selecionada não encontrada.' }
    }

    if (alocacao.valorAplicado > mensalidade.saldo) {
      return {
        valido: false,
        erro: 'O valor aplicado não pode ser maior que o saldo devido da competência.',
      }
    }
  }

  return { valido: true }
}

/** SPEC §12: valor pago = devido → QUITADA; menor → PARCIAL. */
export function calcularNovoStatusMensalidade(
  valorDevido: number,
  novoValorPago: number
): 'PARCIAL' | 'QUITADA' {
  return novoValorPago >= valorDevido ? 'QUITADA' : 'PARCIAL'
}

export function calcularValorTotal(alocacoes: AlocacaoCompetencia[]): number {
  return alocacoes.reduce((soma, a) => soma + a.valorAplicado, 0)
}
