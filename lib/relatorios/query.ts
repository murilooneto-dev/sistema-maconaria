/** Monta a query string preservando apenas os filtros preenchidos — reusada entre a tela e os links de export PDF/CSV. */
export function paramsParaQueryString(params: Record<string, string | undefined>): string {
  const preenchidos: Record<string, string> = {}
  for (const [chave, valor] of Object.entries(params)) {
    if (valor) preenchidos[chave] = valor
  }
  return new URLSearchParams(preenchidos).toString()
}
