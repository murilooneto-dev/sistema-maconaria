/** Formata uma data no formato `YYYY-MM-DD` (coluna `date` do Postgres) para `DD/MM/YYYY`. */
export function formatarDataBR(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split('-')
  if (!ano || !mes || !dia) return dataISO
  return `${dia}/${mes}/${ano}`
}
