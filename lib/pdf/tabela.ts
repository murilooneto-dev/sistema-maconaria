import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'

export type DadosTabelaPdf = {
  titulo: string
  subtitulo?: string
  resumo?: { label: string; valor: string }[]
  colunas: string[]
  linhas: string[][]
}

const COR_TEXTO = rgb(0.13, 0.13, 0.15)
const COR_TEXTO_CLARO = rgb(0.42, 0.42, 0.46)
const COR_LINHA = rgb(0.85, 0.85, 0.87)
const COR_CABECALHO_FUNDO = rgb(0.94, 0.94, 0.95)

/** Gera um PDF tabular genérico (título + resumo opcional + tabela paginada) — usado pelos relatórios da Fase 11. */
export async function gerarPdfTabela(dados: DadosTabelaPdf): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const margem = 40
  const larguraPagina = 841.89 // A4 paisagem
  const alturaPagina = 595.28
  const larguraUtil = larguraPagina - margem * 2
  const alturaLinha = 20

  let page = pdf.addPage([larguraPagina, alturaPagina])
  let y = alturaPagina - margem

  function novaPagina() {
    page = pdf.addPage([larguraPagina, alturaPagina])
    y = alturaPagina - margem
  }

  page.drawText(dados.titulo, { x: margem, y, size: 16, font: fontBold, color: COR_TEXTO })
  y -= 20

  if (dados.subtitulo) {
    page.drawText(dados.subtitulo, { x: margem, y, size: 10, font: fontRegular, color: COR_TEXTO_CLARO })
    y -= 16
  }

  if (dados.resumo && dados.resumo.length > 0) {
    const resumoTexto = dados.resumo.map((r) => `${r.label}: ${r.valor}`).join('    ')
    page.drawText(resumoTexto, { x: margem, y, size: 10, font: fontBold, color: COR_TEXTO })
    y -= 22
  }

  const larguraColuna = larguraUtil / dados.colunas.length

  function desenharCabecalho() {
    page.drawRectangle({ x: margem, y: y - alturaLinha, width: larguraUtil, height: alturaLinha, color: COR_CABECALHO_FUNDO })
    dados.colunas.forEach((coluna, i) => {
      page.drawText(truncar(coluna, fontBold, 9, larguraColuna - 8), {
        x: margem + i * larguraColuna + 4,
        y: y - alturaLinha + 6,
        size: 9,
        font: fontBold,
        color: COR_TEXTO,
      })
    })
    y -= alturaLinha
  }

  desenharCabecalho()

  for (const linha of dados.linhas) {
    if (y - alturaLinha < margem) {
      novaPagina()
      desenharCabecalho()
    }

    page.drawLine({ start: { x: margem, y }, end: { x: margem + larguraUtil, y }, thickness: 0.5, color: COR_LINHA })

    linha.forEach((celula, i) => {
      page.drawText(truncar(celula, fontRegular, 9, larguraColuna - 8), {
        x: margem + i * larguraColuna + 4,
        y: y - alturaLinha + 6,
        size: 9,
        font: fontRegular,
        color: COR_TEXTO,
      })
    })
    y -= alturaLinha
  }

  page.drawLine({ start: { x: margem, y }, end: { x: margem + larguraUtil, y }, thickness: 0.5, color: COR_LINHA })

  if (dados.linhas.length === 0) {
    page.drawText('Nenhum registro encontrado para os filtros selecionados.', {
      x: margem,
      y: y - 16,
      size: 10,
      font: fontRegular,
      color: COR_TEXTO_CLARO,
    })
  }

  return pdf.save()
}

function truncar(texto: string, font: PDFFont, size: number, larguraMax: number): string {
  if (font.widthOfTextAtSize(texto, size) <= larguraMax) return texto
  let truncado = texto
  while (truncado.length > 1 && font.widthOfTextAtSize(`${truncado}…`, size) > larguraMax) {
    truncado = truncado.slice(0, -1)
  }
  return `${truncado}…`
}
