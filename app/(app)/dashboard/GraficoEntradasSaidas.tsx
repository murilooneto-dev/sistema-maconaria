type Ponto = { mesLabel: string; entradas: number; saidas: number }

/** Gráfico de barras simples (SVG puro, sem dependências) — entradas x saídas dos últimos 6 meses. */
export function GraficoEntradasSaidas({ dados }: { dados: Ponto[] }) {
  const largura = 640
  const altura = 220
  const margemInferior = 28
  const margemEsquerda = 8
  const alturaUtil = altura - margemInferior
  const maiorValor = Math.max(1, ...dados.flatMap((d) => [d.entradas, d.saidas]))
  const larguraGrupo = (largura - margemEsquerda) / dados.length
  const larguraBarra = larguraGrupo * 0.3

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${largura} ${altura}`} className="h-56 w-full min-w-[480px]">
        <line x1={margemEsquerda} y1={alturaUtil} x2={largura} y2={alturaUtil} stroke="#e2e8f0" strokeWidth={1} />
        {dados.map((d, i) => {
          const xGrupo = margemEsquerda + i * larguraGrupo + larguraGrupo / 2
          const alturaEntradas = (d.entradas / maiorValor) * (alturaUtil - 10)
          const alturaSaidas = (d.saidas / maiorValor) * (alturaUtil - 10)
          return (
            <g key={d.mesLabel}>
              <rect
                x={xGrupo - larguraBarra - 2}
                y={alturaUtil - alturaEntradas}
                width={larguraBarra}
                height={alturaEntradas}
                fill="#16a34a"
                rx={2}
              />
              <rect
                x={xGrupo + 2}
                y={alturaUtil - alturaSaidas}
                width={larguraBarra}
                height={alturaSaidas}
                fill="#dc2626"
                rx={2}
              />
              <text x={xGrupo} y={altura - 8} textAnchor="middle" fontSize="11" fill="#64748b">
                {d.mesLabel}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="mt-1 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-green-600" /> Entradas
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-red-600" /> Saídas
        </span>
      </div>
    </div>
  )
}
