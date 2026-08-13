'use client'

import { useState, useTransition } from 'react'
import { alterarStatusUsuario, atualizarUsuario, redefinirSenha } from './actions'

type Usuario = {
  id: string
  username: string
  nome: string
  role: 'ADMINISTRADOR' | 'TESOUREIRO' | 'CONSULTA'
  ativo: boolean
  created_at: string
}

export function UsuariosTable({
  usuarios,
  currentUserId,
}: {
  usuarios: Usuario[]
  currentUserId: string
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ id: string; message: string; isError: boolean } | null>(
    null
  )

  function handleToggleStatus(usuario: Usuario) {
    const confirmMessage = usuario.ativo
      ? `Desativar o usuário ${usuario.nome}? Ele não poderá mais acessar o sistema.`
      : `Reativar o usuário ${usuario.nome}?`

    if (!window.confirm(confirmMessage)) {
      return
    }

    startTransition(async () => {
      const result = await alterarStatusUsuario(usuario.id, !usuario.ativo)
      setFeedback({
        id: usuario.id,
        message: result.error ?? 'Status atualizado.',
        isError: Boolean(result.error),
      })
    })
  }

  function handleResetPassword(usuario: Usuario) {
    const novaSenha = window.prompt(
      `Nova senha temporária para ${usuario.nome} (mínimo 8 caracteres):`
    )
    if (!novaSenha) {
      return
    }

    startTransition(async () => {
      const result = await redefinirSenha(usuario.id, novaSenha)
      setFeedback({
        id: usuario.id,
        message: result.error ?? 'Senha redefinida.',
        isError: Boolean(result.error),
      })
    })
  }

  return (
    <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Username</th>
            <th className="px-4 py-2 font-medium">Nome</th>
            <th className="px-4 py-2 font-medium">Perfil</th>
            <th className="px-4 py-2 font-medium">Situação</th>
            <th className="px-4 py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((usuario) => (
            <tr key={usuario.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-2 text-slate-500">{usuario.username}</td>
              <td className="px-4 py-2">
                {editingId === usuario.id ? (
                  <EditForm
                    usuario={usuario}
                    pending={isPending}
                    isSelf={usuario.id === currentUserId}
                    onCancel={() => setEditingId(null)}
                    onSave={(nome, role) => {
                      startTransition(async () => {
                        const result = await atualizarUsuario(usuario.id, nome, role)
                        setFeedback({
                          id: usuario.id,
                          message: result.error ?? 'Usuário atualizado.',
                          isError: Boolean(result.error),
                        })
                        if (!result.error) {
                          setEditingId(null)
                        }
                      })
                    }}
                  />
                ) : (
                  usuario.nome
                )}
              </td>
              <td className="px-4 py-2">{editingId === usuario.id ? '—' : usuario.role}</td>
              <td className="px-4 py-2">
                <span className={usuario.ativo ? 'text-green-700' : 'text-slate-400'}>
                  {usuario.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </td>
              <td className="space-x-2 px-4 py-2">
                {editingId !== usuario.id && (
                  <button
                    type="button"
                    onClick={() => setEditingId(usuario.id)}
                    className="text-slate-700 underline"
                  >
                    Editar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleToggleStatus(usuario)}
                  disabled={isPending || usuario.id === currentUserId}
                  className="text-slate-700 underline disabled:opacity-50"
                >
                  {usuario.ativo ? 'Desativar' : 'Reativar'}
                </button>
                <button
                  type="button"
                  onClick={() => handleResetPassword(usuario)}
                  disabled={isPending}
                  className="text-slate-700 underline disabled:opacity-50"
                >
                  Redefinir senha
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {feedback && (
        <p
          className={`px-4 py-2 text-sm ${feedback.isError ? 'text-red-600' : 'text-green-700'}`}
          role={feedback.isError ? 'alert' : 'status'}
        >
          {feedback.message}
        </p>
      )}
    </div>
  )
}

function EditForm({
  usuario,
  pending,
  isSelf,
  onSave,
  onCancel,
}: {
  usuario: Usuario
  pending: boolean
  isSelf: boolean
  onSave: (nome: string, role: Usuario['role']) => void
  onCancel: () => void
}) {
  const [nome, setNome] = useState(usuario.nome)
  const [role, setRole] = useState<Usuario['role']>(usuario.role)

  return (
    <div className="space-y-2">
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as Usuario['role'])}
        disabled={isSelf}
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
      >
        <option value="ADMINISTRADOR">Administrador</option>
        <option value="TESOUREIRO">Tesoureiro</option>
        <option value="CONSULTA">Consulta</option>
      </select>
      {isSelf && (
        <p className="text-xs text-slate-500">
          Você não pode alterar seu próprio perfil de acesso.
        </p>
      )}
      <div className="space-x-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => onSave(nome, role)}
          className="text-sm text-slate-900 underline disabled:opacity-50"
        >
          Salvar
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-slate-500 underline">
          Cancelar
        </button>
      </div>
    </div>
  )
}
