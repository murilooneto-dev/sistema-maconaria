export function SelecionarMembro({
  membros,
  membroSelecionado,
}: {
  membros: { id: string; nome: string }[]
  membroSelecionado?: string
}) {
  return (
    <form className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <select
        name="membroId"
        defaultValue={membroSelecionado ?? ''}
        className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">Selecione um membro</option>
        {membros.map((membro) => (
          <option key={membro.id} value={membro.id}>
            {membro.nome}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700">
        Selecionar
      </button>
    </form>
  )
}
