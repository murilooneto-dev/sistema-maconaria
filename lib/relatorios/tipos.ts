export type ResultadoRelatorio = {
  titulo: string
  subtitulo?: string
  resumo?: { label: string; valor: string }[]
  colunas: string[]
  linhas: string[][]
}
