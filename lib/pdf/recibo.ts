import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from 'pdf-lib'
import { formatarDataBR } from '@/lib/format'

export type ImagemEmbutida = { bytes: Uint8Array; formato: 'png' | 'jpg' }

export type DadosRecibo = {
  id: string
  tipo: 'MENSALIDADE' | 'CAMPANHA'
  pessoa: string
  valor: number
  referencia: string
  data: string
  descricao: string | null
  lojaNome: string
  logo: ImagemEmbutida | null
  assinatura: ImagemEmbutida | null
}

const CARGO_ASSINATURA = 'Venerável Mestre'

const COR_TEXTO = rgb(0.13, 0.13, 0.15)
const COR_TEXTO_CLARO = rgb(0.42, 0.42, 0.46)
const COR_LINHA = rgb(0.8, 0.8, 0.82)
const COR_TITULO = rgb(0.08, 0.08, 0.1)

/** Desenha uma imagem ocupando no máximo `maxW`x`maxH`, preservando proporção, ancorada em (x, yTopo) com yTopo sendo o topo da caixa. */
function desenharImagemProporcional(
  page: import('pdf-lib').PDFPage,
  img: PDFImage,
  x: number,
  yTopo: number,
  maxW: number,
  maxH: number,
  alinhamento: 'esquerda' | 'centro' = 'esquerda'
): { largura: number; altura: number } {
  const proporcao = img.width / img.height
  let largura = maxW
  let altura = largura / proporcao
  if (altura > maxH) {
    altura = maxH
    largura = altura * proporcao
  }
  const xFinal = alinhamento === 'centro' ? x - largura / 2 : x
  page.drawImage(img, { x: xFinal, y: yTopo - altura, width: largura, height: altura })
  return { largura, altura }
}

/** Gera o PDF de um recibo (Mensalidade ou Campanha) — SPEC §27, layout padronizado com tabela de dados. */
export async function gerarPdfRecibo(dados: DadosRecibo): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89]) // A4
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const fontOblique = await pdf.embedFont(StandardFonts.HelveticaOblique)

  const margem = 56
  const larguraPagina = page.getWidth()
  const larguraUtil = larguraPagina - margem * 2
  let y = page.getHeight() - margem

  async function embutir(imagem: ImagemEmbutida): Promise<PDFImage> {
    return imagem.formato === 'png' ? pdf.embedPng(imagem.bytes) : pdf.embedJpg(imagem.bytes)
  }

  // --- Cabeçalho: logo no canto esquerdo + nome da Loja alinhado ao lado ---
  const alturaCabecalho = 64
  const topoCabecalho = y
  let logoLargura = 0

  if (dados.logo) {
    try {
      const logoImg = await embutir(dados.logo)
      const { largura } = desenharImagemProporcional(page, logoImg, margem, topoCabecalho, alturaCabecalho, alturaCabecalho)
      logoLargura = largura
    } catch (err) {
      console.error(`Recibo ${dados.id}: falha ao embutir logo:`, err)
    }
  }

  const xNomeLoja = margem + (logoLargura > 0 ? logoLargura + 16 : 0)
  page.drawText(dados.lojaNome, {
    x: xNomeLoja,
    y: topoCabecalho - alturaCabecalho / 2 - 2,
    size: 16,
    font: fontBold,
    color: COR_TITULO,
  })
  page.drawText('Comprovante de recebimento', {
    x: xNomeLoja,
    y: topoCabecalho - alturaCabecalho / 2 - 18,
    size: 9,
    font: fontOblique,
    color: COR_TEXTO_CLARO,
  })

  y = topoCabecalho - alturaCabecalho - 12
  page.drawLine({ start: { x: margem, y }, end: { x: margem + larguraUtil, y }, thickness: 1, color: COR_LINHA })

  // --- Título "RECIBO" + número de referência ---
  y -= 42
  const tituloTexto = 'RECIBO'
  page.drawText(tituloTexto, {
    x: margem + larguraUtil / 2 - fontBold.widthOfTextAtSize(tituloTexto, 22) / 2,
    y,
    size: 22,
    font: fontBold,
    color: COR_TITULO,
  })

  const numeroRecibo = `Nº ${dados.id.slice(0, 8).toUpperCase()}`
  page.drawText(numeroRecibo, {
    x: margem + larguraUtil - fontRegular.widthOfTextAtSize(numeroRecibo, 9),
    y: y + 4,
    size: 9,
    font: fontRegular,
    color: COR_TEXTO_CLARO,
  })

  // --- Tabela de dados ---
  y -= 40
  const valorFormatado = `R$ ${dados.valor.toFixed(2).replace('.', ',')}`
  const tipoLabel = dados.tipo === 'MENSALIDADE' ? 'Mensalidade' : 'Doação (Campanha)'

  const linhas: [string, string][] = [
    ['Recebido de', dados.pessoa],
    ['Valor', valorFormatado],
    ['Tipo', tipoLabel],
    ['Referente a', dados.referencia],
    ['Data', formatarDataBR(dados.data)],
  ]
  if (dados.descricao) {
    linhas.push(['Observação', dados.descricao])
  }

  y = desenharTabela(page, fontRegular, fontBold, margem, y, larguraUtil, linhas)

  // --- Declaração ---
  y -= 30
  const declaracao =
    dados.tipo === 'MENSALIDADE'
      ? 'Para clareza e como comprovante de quitação, firmamos o presente recibo.'
      : 'Para clareza e como comprovante de recebimento da doação, firmamos o presente recibo.'
  for (const linha of quebrarLinhas(declaracao, fontRegular, 11, larguraUtil)) {
    page.drawText(linha, { x: margem, y, size: 11, font: fontRegular, color: COR_TEXTO })
    y -= 16
  }

  // --- Assinatura ---
  const yAssinatura = Math.min(y - 60, margem + 150)
  const centroX = margem + larguraUtil / 2

  if (dados.assinatura) {
    try {
      const assinaturaImg = await embutir(dados.assinatura)
      desenharImagemProporcional(page, assinaturaImg, centroX, yAssinatura + 55, 200, 55, 'centro')
    } catch (err) {
      console.error(`Recibo ${dados.id}: falha ao embutir assinatura:`, err)
    }
  }

  const linhaLargura = 240
  page.drawLine({
    start: { x: centroX - linhaLargura / 2, y: yAssinatura },
    end: { x: centroX + linhaLargura / 2, y: yAssinatura },
    thickness: 1,
    color: rgb(0.3, 0.3, 0.3),
  })

  page.drawText(CARGO_ASSINATURA, {
    x: centroX - fontRegular.widthOfTextAtSize(CARGO_ASSINATURA, 11) / 2,
    y: yAssinatura - 16,
    size: 11,
    font: fontRegular,
    color: COR_TEXTO,
  })
  page.drawText(dados.lojaNome, {
    x: centroX - fontOblique.widthOfTextAtSize(dados.lojaNome, 9) / 2,
    y: yAssinatura - 30,
    size: 9,
    font: fontOblique,
    color: COR_TEXTO_CLARO,
  })

  return pdf.save()
}

/** Desenha uma tabela de duas colunas (rótulo/valor) com bordas, devolve o y após a tabela. */
function desenharTabela(
  page: import('pdf-lib').PDFPage,
  fontRegular: PDFFont,
  fontBold: PDFFont,
  x: number,
  yTopo: number,
  largura: number,
  linhas: [string, string][]
): number {
  const alturaLinha = 26
  const colunaLabel = 130
  const alturaTotal = alturaLinha * linhas.length

  page.drawRectangle({
    x,
    y: yTopo - alturaTotal,
    width: largura,
    height: alturaTotal,
    borderColor: COR_LINHA,
    borderWidth: 1,
    color: rgb(1, 1, 1),
  })

  page.drawLine({
    start: { x: x + colunaLabel, y: yTopo },
    end: { x: x + colunaLabel, y: yTopo - alturaTotal },
    thickness: 1,
    color: COR_LINHA,
  })

  linhas.forEach(([label, valor], i) => {
    const yLinhaTopo = yTopo - alturaLinha * i
    if (i > 0) {
      page.drawLine({
        start: { x, y: yLinhaTopo },
        end: { x: x + largura, y: yLinhaTopo },
        thickness: 1,
        color: COR_LINHA,
      })
    }

    const yTexto = yLinhaTopo - alturaLinha / 2 - 4
    page.drawText(label, { x: x + 10, y: yTexto, size: 10, font: fontBold, color: COR_TEXTO_CLARO })

    const valorTruncado = truncarTexto(valor, fontRegular, 10, largura - colunaLabel - 20)
    page.drawText(valorTruncado, { x: x + colunaLabel + 10, y: yTexto, size: 10, font: fontRegular, color: COR_TEXTO })
  })

  return yTopo - alturaTotal
}

function truncarTexto(texto: string, font: PDFFont, size: number, larguraMax: number): string {
  if (font.widthOfTextAtSize(texto, size) <= larguraMax) return texto
  let truncado = texto
  while (truncado.length > 1 && font.widthOfTextAtSize(`${truncado}…`, size) > larguraMax) {
    truncado = truncado.slice(0, -1)
  }
  return `${truncado}…`
}

function quebrarLinhas(texto: string, font: PDFFont, size: number, larguraMax: number): string[] {
  const palavras = texto.split(' ')
  const linhas: string[] = []
  let linhaAtual = ''

  for (const palavra of palavras) {
    const tentativa = linhaAtual ? `${linhaAtual} ${palavra}` : palavra
    if (font.widthOfTextAtSize(tentativa, size) > larguraMax && linhaAtual) {
      linhas.push(linhaAtual)
      linhaAtual = palavra
    } else {
      linhaAtual = tentativa
    }
  }
  if (linhaAtual) linhas.push(linhaAtual)
  return linhas
}
