import type { Competencia } from '@/lib/domain/competencias'

/**
 * O servidor roda em UTC, mas "hoje" e "mês atual" para a Loja são os do
 * horário de Brasília. Sem isso, das 21h em diante no último dia do mês o
 * sistema já tratava o mês seguinte como atual (competência vencida um dia
 * antes, cadastro caindo no mês errado).
 */
const FUSO_DA_LOJA = 'America/Sao_Paulo'

const formatoISO = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_DA_LOJA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Data de hoje no fuso da Loja, em `YYYY-MM-DD`. */
export function hojeISO(agora: Date = new Date()): string {
  return formatoISO.format(agora)
}

/** Ano e mês correntes no fuso da Loja. */
export function competenciaAtual(agora: Date = new Date()): Competencia {
  const [ano, mes] = hojeISO(agora).split('-').map(Number)
  return { ano, mes }
}

/** Primeiro dia do mês corrente no fuso da Loja, em `YYYY-MM-DD`. */
export function primeiroDiaMesAtual(agora: Date = new Date()): string {
  return `${hojeISO(agora).slice(0, 7)}-01`
}
