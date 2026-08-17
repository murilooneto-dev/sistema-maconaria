import type { ResultadoRelatorio } from '@/lib/relatorios/tipos'

export function ResultadoRelatorioView({
  resultado,
  slug,
  queryString,
}: {
  resultado: ResultadoRelatorio
  slug: string
  queryString: string
}) {
  const sufixo = queryString ? `?${queryString}` : ''

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{resultado.titulo}</h2>
          {resultado.subtitulo && <p className="text-sm text-slate-500">{resultado.subtitulo}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/relatorios/${slug}/pdf${sufixo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
          >
            PDF
          </a>
          <a href={`/relatorios/${slug}/csv${sufixo}`} className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700">
            Excel (CSV)
          </a>
        </div>
      </div>

      {resultado.resumo && resultado.resumo.length > 0 && (
        <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {resultado.resumo.map((r) => (
            <div key={r.label} className="rounded-lg border border-slate-200 bg-white p-4">
              <dt className="text-xs text-slate-500">{r.label}</dt>
              <dd className="text-lg font-semibold text-slate-900">{r.valor}</dd>
            </div>
          ))}
        </dl>
      )}

      {resultado.linhas.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum registro encontrado para os filtros selecionados.</p>
      ) : (
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <tr>
                {resultado.colunas.map((c) => (
                  <th key={c} className="whitespace-nowrap px-4 py-2 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultado.linhas.map((linha, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  {linha.map((celula, j) => (
                    <td key={j} className="whitespace-nowrap px-4 py-2">
                      {celula}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
