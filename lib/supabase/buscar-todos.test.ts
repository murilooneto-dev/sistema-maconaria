import { describe, expect, it } from 'vitest'
import { buscarTodos } from './buscar-todos'

function paginador(total: number) {
  const chamadas: [number, number][] = []
  const buscar = async (de: number, ate: number) => {
    chamadas.push([de, ate])
    const linhas = Array.from({ length: total }, (_, i) => i).slice(de, ate + 1)
    return { data: linhas, error: null }
  }
  return { buscar, chamadas }
}

describe('buscarTodos', () => {
  it('faz uma única consulta quando o resultado cabe em uma página', async () => {
    const { buscar, chamadas } = paginador(30)
    const { data } = await buscarTodos(buscar)
    expect(data).toHaveLength(30)
    expect(chamadas).toEqual([[0, 999]])
  })

  it('continua buscando além das 1000 linhas', async () => {
    const { buscar, chamadas } = paginador(2350)
    const { data } = await buscarTodos(buscar)
    expect(data).toHaveLength(2350)
    expect(data?.[2349]).toBe(2349)
    expect(chamadas).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })

  it('busca mais uma página quando o total é múltiplo exato de 1000', async () => {
    const { buscar, chamadas } = paginador(1000)
    const { data } = await buscarTodos(buscar)
    expect(data).toHaveLength(1000)
    expect(chamadas).toHaveLength(2)
  })

  it('devolve o erro e nenhuma linha se uma página falhar', async () => {
    const resultado = await buscarTodos<number>(async (de) =>
      de === 0
        ? { data: Array.from({ length: 1000 }, (_, i) => i), error: null }
        : { data: null, error: { message: 'falhou' } }
    )
    expect(resultado).toEqual({ data: null, error: { message: 'falhou' } })
  })
})
