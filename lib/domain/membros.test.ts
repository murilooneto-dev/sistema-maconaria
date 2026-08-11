import { describe, expect, it } from 'vitest'
import { validarMembro } from './membros'

describe('validarMembro', () => {
  it('aceita um input válido', () => {
    expect(validarMembro({ nome: 'João Silva', matricula: '1234' })).toEqual({ valido: true })
  })

  it('rejeita nome vazio', () => {
    expect(validarMembro({ nome: '  ', matricula: '1234' })).toEqual({
      valido: false,
      erro: 'Informe o nome do membro.',
    })
  })

  it('rejeita matrícula vazia', () => {
    expect(validarMembro({ nome: 'João Silva', matricula: '' })).toEqual({
      valido: false,
      erro: 'Informe a matrícula.',
    })
  })
})
