import { describe, expect, it } from 'vitest'
import { validarEdicaoUsuario, validarNovoUsuario, validarSenha } from './usuarios'

describe('validarNovoUsuario', () => {
  const base = { username: 'joao.silva', nome: 'João Silva', role: 'CONSULTA', senha: 'senha1234' }

  it('aceita um input válido', () => {
    expect(validarNovoUsuario(base)).toEqual({ valido: true })
  })

  it('rejeita username vazio', () => {
    expect(validarNovoUsuario({ ...base, username: '   ' })).toEqual({
      valido: false,
      erro: 'Informe o username.',
    })
  })

  it('rejeita username com caracteres inválidos', () => {
    expect(validarNovoUsuario({ ...base, username: 'joão silva!' })).toEqual({
      valido: false,
      erro: 'Username deve conter apenas letras, números, ponto, hífen ou underscore.',
    })
  })

  it('rejeita nome vazio', () => {
    expect(validarNovoUsuario({ ...base, nome: '  ' })).toEqual({
      valido: false,
      erro: 'Informe o nome completo.',
    })
  })

  it('rejeita role inválido', () => {
    expect(validarNovoUsuario({ ...base, role: 'SUPER_ADMIN' })).toEqual({
      valido: false,
      erro: 'Perfil inválido.',
    })
  })

  it('rejeita senha com menos de 8 caracteres', () => {
    expect(validarNovoUsuario({ ...base, senha: '1234567' })).toEqual({
      valido: false,
      erro: 'A senha deve ter pelo menos 8 caracteres.',
    })
  })
})

describe('validarEdicaoUsuario', () => {
  it('aceita um input válido', () => {
    expect(validarEdicaoUsuario({ nome: 'João Silva', role: 'TESOUREIRO' })).toEqual({ valido: true })
  })

  it('rejeita nome vazio', () => {
    expect(validarEdicaoUsuario({ nome: '', role: 'TESOUREIRO' })).toEqual({
      valido: false,
      erro: 'Informe o nome completo.',
    })
  })

  it('rejeita role inválido', () => {
    expect(validarEdicaoUsuario({ nome: 'João Silva', role: 'X' })).toEqual({
      valido: false,
      erro: 'Perfil inválido.',
    })
  })
})

describe('validarSenha', () => {
  it('aceita uma senha válida', () => {
    expect(validarSenha('senha1234')).toEqual({ valido: true })
  })

  it('rejeita senha com menos de 8 caracteres', () => {
    expect(validarSenha('1234567')).toEqual({
      valido: false,
      erro: 'A senha deve ter pelo menos 8 caracteres.',
    })
  })
})
