const TAMANHO_PAGINA = 1000

type RespostaPagina<T> = { data: T[] | null; error: { message: string } | null }

/**
 * O Supabase devolve no máximo 1000 linhas por consulta e corta o resto SEM
 * erro — uma soma de saldo ou contagem de inadimplência feita em cima de um
 * resultado cortado sai errada em silêncio. Esta função busca página por
 * página até acabar.
 *
 * `buscarPagina` precisa montar a consulta do zero a cada chamada, com uma
 * ordenação estável (termine com `.order('id')`) e `.range(de, ate)` no fim.
 */
export async function buscarTodos<T>(
  buscarPagina: (de: number, ate: number) => PromiseLike<RespostaPagina<T>>
): Promise<RespostaPagina<T>> {
  const linhas: T[] = []

  for (let de = 0; ; de += TAMANHO_PAGINA) {
    const { data, error } = await buscarPagina(de, de + TAMANHO_PAGINA - 1)
    if (error) {
      return { data: null, error }
    }
    linhas.push(...(data ?? []))
    if (!data || data.length < TAMANHO_PAGINA) {
      return { data: linhas, error: null }
    }
  }
}
