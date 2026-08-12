export type ValidationResult = { valido: true } | { valido: false; erro: string }

export function validarCampanha(input: {
  titulo: string
  meta: number
  dataInicial: string
  dataFinal?: string | null
}): ValidationResult {
  if (input.titulo.trim().length === 0) {
    return { valido: false, erro: 'Informe o título da campanha.' }
  }
  if (!Number.isFinite(input.meta) || input.meta < 0) {
    return { valido: false, erro: 'Informe uma meta válida.' }
  }
  if (input.dataInicial.trim().length === 0) {
    return { valido: false, erro: 'Informe a data inicial.' }
  }
  if (input.dataFinal && input.dataFinal < input.dataInicial) {
    return { valido: false, erro: 'A data final não pode ser anterior à data inicial.' }
  }
  return { valido: true }
}

export function validarDoacao(input: {
  doador: string
  valor: number
  data: string
  contaId: string
  formaPagamentoId: string
}): ValidationResult {
  if (input.doador.trim().length === 0) {
    return { valido: false, erro: 'Informe o nome do doador.' }
  }
  if (!Number.isFinite(input.valor) || input.valor <= 0) {
    return { valido: false, erro: 'Informe um valor válido.' }
  }
  if (input.data.trim().length === 0) {
    return { valido: false, erro: 'Informe a data da doação.' }
  }
  if (!input.contaId) {
    return { valido: false, erro: 'Selecione a conta.' }
  }
  if (!input.formaPagamentoId) {
    return { valido: false, erro: 'Selecione a forma de pagamento.' }
  }
  return { valido: true }
}

export function calcularArrecadado(doacoesAtivas: { valor: number }[]): number {
  return doacoesAtivas.reduce((s, d) => s + Number(d.valor), 0)
}

export function calcularPercentual(arrecadado: number, meta: number): number {
  if (meta <= 0) return 0
  return Math.min(100, (arrecadado / meta) * 100)
}

/** SPEC §24: ao atingir a meta, EM_ANDAMENTO → CONCLUIDA automaticamente. */
export function deveConcluirAutomaticamente(input: {
  status: string
  meta: number
  arrecadado: number
}): boolean {
  return input.status === 'EM_ANDAMENTO' && input.meta > 0 && input.arrecadado >= input.meta
}
