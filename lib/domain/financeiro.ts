export type ValidationResult = { valido: true } | { valido: false; erro: string }

export function validarMovimentacao(input: {
  data: string
  tipo: string
  categoriaId: string
  valor: number
  contaId: string
  formaPagamentoId: string
}): ValidationResult {
  if (input.data.trim().length === 0) {
    return { valido: false, erro: 'Informe a data da movimentação.' }
  }
  if (input.tipo !== 'ENTRADA' && input.tipo !== 'SAIDA') {
    return { valido: false, erro: 'Tipo inválido.' }
  }
  if (!input.categoriaId) {
    return { valido: false, erro: 'Selecione uma categoria.' }
  }
  if (!Number.isFinite(input.valor) || input.valor <= 0) {
    return { valido: false, erro: 'Informe um valor válido.' }
  }
  if (!input.contaId) {
    return { valido: false, erro: 'Selecione a conta.' }
  }
  if (!input.formaPagamentoId) {
    return { valido: false, erro: 'Selecione a forma de pagamento.' }
  }
  return { valido: true }
}

export function validarTransferencia(input: {
  contaOrigemId: string
  contaDestinoId: string
  valor: number
  data: string
}): ValidationResult {
  if (!input.contaOrigemId || !input.contaDestinoId) {
    return { valido: false, erro: 'Selecione as contas de origem e destino.' }
  }
  if (input.contaOrigemId === input.contaDestinoId) {
    return { valido: false, erro: 'A conta de origem e destino não podem ser a mesma.' }
  }
  if (!Number.isFinite(input.valor) || input.valor <= 0) {
    return { valido: false, erro: 'Informe um valor válido.' }
  }
  if (input.data.trim().length === 0) {
    return { valido: false, erro: 'Informe a data da transferência.' }
  }
  return { valido: true }
}

/** Saldo atual de uma conta: inicial + entradas − saídas − transf. saindo + transf. entrando. */
export function calcularSaldoConta(input: {
  saldoInicial: number
  totalEntradas: number
  totalSaidas: number
  totalTransferenciasSaida: number
  totalTransferenciasEntrada: number
}): number {
  return (
    input.saldoInicial +
    input.totalEntradas -
    input.totalSaidas -
    input.totalTransferenciasSaida +
    input.totalTransferenciasEntrada
  )
}

/** SPEC §22: saldo_final = saldo_inicial + entradas − saídas (transferências não entram, líquido zero). */
export function calcularFechamento(input: {
  saldoInicial: number
  totalEntradas: number
  totalSaidas: number
}): number {
  return input.saldoInicial + input.totalEntradas - input.totalSaidas
}

export type PeriodoFechado = { ano: number; mes: number }

function proximoMes(periodo: PeriodoFechado): PeriodoFechado {
  return periodo.mes === 12 ? { ano: periodo.ano + 1, mes: 1 } : { ano: periodo.ano, mes: periodo.mes + 1 }
}

/**
 * Só permite fechar o mês seguinte ao último fechamento existente — evita
 * pular meses e quebrar a cadeia de saldo_inicial. Sem fechamento anterior,
 * qualquer mês pode ser o primeiro.
 */
export function podeFecharPeriodo(
  ultimoFechamento: PeriodoFechado | null,
  alvo: PeriodoFechado
): ValidationResult {
  if (!ultimoFechamento) {
    return { valido: true }
  }
  const esperado = proximoMes(ultimoFechamento)
  if (alvo.ano !== esperado.ano || alvo.mes !== esperado.mes) {
    return {
      valido: false,
      erro: `Só é possível fechar o período ${String(esperado.mes).padStart(2, '0')}/${esperado.ano} (o mês seguinte ao último fechamento).`,
    }
  }
  return { valido: true }
}

/** Reabertura só é permitida no fechamento mais recente, senão quebra o encadeamento de saldo_inicial dos meses seguintes. */
export function podeReabrir(alvo: PeriodoFechado, maisRecenteFechado: PeriodoFechado | null): ValidationResult {
  if (!maisRecenteFechado) {
    return { valido: false, erro: 'Não há fechamento para reabrir.' }
  }
  if (alvo.ano !== maisRecenteFechado.ano || alvo.mes !== maisRecenteFechado.mes) {
    return {
      valido: false,
      erro: 'Só é possível reabrir o fechamento mais recente — reabra os meses seguintes primeiro.',
    }
  }
  return { valido: true }
}
