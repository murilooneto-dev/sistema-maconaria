export type ValidationResult = { valido: true } | { valido: false; erro: string }

export function validarLoja(input: { nome: string }): ValidationResult {
  if (input.nome.trim().length === 0) {
    return { valido: false, erro: 'Informe o nome da loja.' }
  }
  return { valido: true }
}

export function validarConfigMensalidade(input: {
  tipo: string
  valorMensalidade: number
  valorGrandeLoja: number
}): ValidationResult {
  if (input.tipo !== 'NORMAL' && input.tipo !== 'REMIDO') {
    return { valido: false, erro: 'Tipo inválido.' }
  }

  if (!Number.isFinite(input.valorMensalidade) || input.valorMensalidade < 0) {
    return { valido: false, erro: 'Informe um valor de mensalidade válido.' }
  }

  if (!Number.isFinite(input.valorGrandeLoja) || input.valorGrandeLoja < 0) {
    return { valido: false, erro: 'Informe um valor de Grande Loja válido.' }
  }

  if (input.valorGrandeLoja > input.valorMensalidade) {
    return {
      valido: false,
      erro: 'O valor da Grande Loja não pode ser maior que o valor da mensalidade.',
    }
  }

  return { valido: true }
}

export function validarConta(input: {
  nome: string
  saldoInicial: number
  dataSaldoInicial: string
}): ValidationResult {
  if (input.nome.trim().length === 0) {
    return { valido: false, erro: 'Informe o nome da conta.' }
  }

  if (!Number.isFinite(input.saldoInicial)) {
    return { valido: false, erro: 'Informe um saldo inicial válido.' }
  }

  if (input.dataSaldoInicial.trim().length === 0) {
    return { valido: false, erro: 'Informe a data do saldo inicial.' }
  }

  return { valido: true }
}

export function validarFormaPagamento(input: { nome: string }): ValidationResult {
  if (input.nome.trim().length === 0) {
    return { valido: false, erro: 'Informe o nome da forma de pagamento.' }
  }
  return { valido: true }
}
