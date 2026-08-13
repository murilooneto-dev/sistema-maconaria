/** Formata uma data no formato `YYYY-MM-DD` (coluna `date` do Postgres) para `DD/MM/YYYY`. */
export function formatarDataBR(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split('-')
  if (!ano || !mes || !dia) return dataISO
  return `${dia}/${mes}/${ano}`
}

const MESES_ABREVIADOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** Abrevia um mês (1-12) para o formato "Jan", "Fev", etc. */
export function abreviarMes(mes: number): string {
  return MESES_ABREVIADOS[mes - 1] ?? String(mes)
}
