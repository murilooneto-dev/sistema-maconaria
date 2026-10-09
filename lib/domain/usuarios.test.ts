import { describe, expect, it } from 'vitest'
import { normalizarEmail, validarEdicaoUsuario, validarEmail, validarNovoUsuario, validarSenha } from './usuarios'

describe('validarEmail', () => {
  it('rejeita e-mail vazio (o e-mail é o login do sistema)', () => {
    expect(validarEmail('').valido).toBe(false)
    expect(validarEmail('   ').valido).toBe(false)
  })

  it('aceita um e-mail válido', () => {
    expect(validarEmail('Joao.Silva@Exemplo.com.br')).toEqual({ valido: true })
  })

  it('rejeita e-mail malformado', () => {
    expect(validarEmail('joao@exemplo').valido).toBe(false)
    expect(validarEmail('joao exemplo.com').valido).toBe(false)
  })

  it('rejeita o domínio interno de autenticação', () => {
    expect(validarEmail('admin@loja.internal').valido).toBe(false)
  })

  it('é aplicada na criação e na edição de usuário', () => {
    const base = { username: 'joao', nome: 'João', role: 'CONSULTA', senha: 'senha1234' }
    expect(validarNovoUsuario(base).valido).toBe(false)
    expect(validarEdicaoUsuario({ nome: 'João', role: 'CONSULTA' }).valido).toBe(false)
    expect(validarNovoUsuario({ ...base, email: 'invalido' }).valido).toBe(false)
    expect(validarEdicaoUsuario({ nome: 'João', role: 'CONSULTA', email: 'invalido' }).valido).toBe(false)
    expect(validarEdicaoUsuario({ nome: 'João', role: 'CONSULTA', email: 'joao@exemplo.com' })).toEqual({ valido: true })
  })
})

describe('normalizarEmail', () => {
  it('tira espaços e passa para minúsculas', () => {
    expect(normalizarEmail('  Joao@Exemplo.COM ')).toBe('joao@exemplo.com')
  })

  it('devolve null para vazio', () => {
    expect(normalizarEmail('  ')).toBeNull()
  })
})

describe('validarNovoUsuario', () => {
  const base = {
    username: 'joao.silva',
    nome: 'João Silva',
    role: 'CONSULTA',
    senha: 'senha1234',
    email: 'joao.silva@exemplo.com',
  }

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
    expect(validarEdicaoUsuario({ nome: 'João Silva', role: 'TESOUREIRO', email: 'joao@exemplo.com' })).toEqual({
      valido: true,
    })
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
