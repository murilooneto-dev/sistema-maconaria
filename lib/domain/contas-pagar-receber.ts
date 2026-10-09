export type ValidationResult = { valido: true } | { valido: false; erro: string }
export type TipoConta = 'PAGAR' | 'RECEBER'

export const MAX_MESES_RECORRENCIA = 60
export const DIAS_ANTECEDENCIA_LEMBRETE = 3

function dataValida(dataISO: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataISO)) return false
  const [ano, mes, dia] = dataISO.split('-').map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
}

function paraISO(data: Date): string {
  return data.toISOString().slice(0, 10)
}

export function somarDias(dataISO: string, dias: number): string {
  const [ano, mes, dia] = dataISO.split('-').map(Number)
  return paraISO(new Date(Date.UTC(ano, mes - 1, dia + dias)))
}

/**
 * Vencimentos de uma conta recorrente: um por mês, a partir de `primeiro`,
 * sempre no mesmo dia. Quando o mês não tem aquele dia (31 em abril, 29–31
 * em fevereiro), usa o último dia do mês — e volta ao dia original no mês
 * seguinte, em vez de "escorregar" para sempre.
 */
export function gerarVencimentosRecorrentes(primeiro: string, meses: number): string[] {
  const [ano, mes, dia] = primeiro.split('-').map(Number)
  const vencimentos: string[] = []

  for (let i = 0; i < meses; i++) {
    const ultimoDiaDoMes = new Date(Date.UTC(ano, mes - 1 + i + 1, 0)).getUTCDate()
    vencimentos.push(paraISO(new Date(Date.UTC(ano, mes - 1 + i, Math.min(dia, ultimoDiaDoMes)))))
  }

  return vencimentos
}

export function validarNovaConta(input: {
  tipo: string
  nome: string
  valor: number
  dataVencimento: string
  recorrente: boolean
  meses: number
}): ValidationResult {
  if (input.tipo !== 'PAGAR' && input.tipo !== 'RECEBER') {
    return { valido: false, erro: 'Selecione se a conta é a pagar ou a receber.' }
  }
  if (input.nome.trim().length === 0) {
    return { valido: false, erro: 'Informe a conta.' }
  }
  if (!Number.isFinite(input.valor) || input.valor <= 0) {
    return { valido: false, erro: 'Informe um valor válido.' }
  }
  if (!dataValida(input.dataVencimento)) {
    return { valido: false, erro: 'Informe a data de vencimento.' }
  }
  if (input.recorrente) {
    if (!Number.isInteger(input.meses) || input.meses < 2 || input.meses > MAX_MESES_RECORRENCIA) {
      return {
        valido: false,
        erro: `Para conta recorrente, informe por quantos meses (de 2 a ${MAX_MESES_RECORRENCIA}).`,
      }
    }
  }
  return { valido: true }
}

export function validarBaixa(input: {
  dataBaixa: string
  valorBaixa: number
  contaId: string
  formaPagamentoId: string
  categoriaId: string
}): ValidationResult {
  if (!dataValida(input.dataBaixa)) {
    return { valido: false, erro: 'Informe a data da baixa.' }
  }
  if (!Number.isFinite(input.valorBaixa) || input.valorBaixa <= 0) {
    return { valido: false, erro: 'Informe um valor válido.' }
  }
  if (!input.contaId) {
    return { valido: false, erro: 'Selecione a conta bancária.' }
  }
  if (!input.formaPagamentoId) {
    return { valido: false, erro: 'Selecione a forma de pagamento.' }
  }
  if (!input.categoriaId) {
    return { valido: false, erro: 'Selecione a categoria.' }
  }
  return { valido: true }
}

/** Conta a pagar vira SAIDA no Financeiro; a receber, ENTRADA. */
export function tipoMovimentacaoDaConta(tipo: TipoConta): 'SAIDA' | 'ENTRADA' {
  return tipo === 'PAGAR' ? 'SAIDA' : 'ENTRADA'
}

/** Uma conta ABERTA cujo vencimento já passou. "Vencida" não é um status gravado: depende só da data de hoje. */
export function contaVencida(conta: { status: string; data_vencimento: string }, hoje: string): boolean {
  return conta.status === 'ABERTA' && conta.data_vencimento < hoje
}

export type GruposLembrete<T> = { venceHoje: T[]; venceEmBreve: T[]; vencidas: T[] }

/**
 * Separa as contas ABERTAS para o e-mail de lembrete: as que vencem hoje,
 * as que vencem exatamente daqui a DIAS_ANTECEDENCIA_LEMBRETE dias, e as já
 * vencidas. Contas com outro vencimento ficam de fora — cada conta aparece
 * como "vence em breve" uma única vez.
 */
export function separarParaLembrete<T extends { status: string; data_vencimento: string }>(
  contas: T[],
  hoje: string
): GruposLembrete<T> {
  const emBreve = somarDias(hoje, DIAS_ANTECEDENCIA_LEMBRETE)
  const abertas = contas.filter((c) => c.status === 'ABERTA')

  return {
    venceHoje: abertas.filter((c) => c.data_vencimento === hoje),
    venceEmBreve: abertas.filter((c) => c.data_vencimento === emBreve),
    vencidas: abertas.filter((c) => c.data_vencimento < hoje),
  }
}

/** O lembrete só é enviado quando há conta vencendo hoje ou em breve — conta vencida, sozinha, não gera e-mail todo dia. */
export function deveEnviarLembrete(grupos: GruposLembrete<unknown>): boolean {
  return grupos.venceHoje.length > 0 || grupos.venceEmBreve.length > 0
}
