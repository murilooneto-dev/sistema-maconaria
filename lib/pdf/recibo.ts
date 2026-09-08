import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from 'pdf-lib'
import { formatarDataBR, formatarMoedaBR } from '@/lib/format'

export type ImagemEmbutida = { bytes: Uint8Array; formato: 'png' | 'jpg' }

export type DadosRecibo = {
  id: string
  tipo: 'MENSALIDADE' | 'CAMPANHA' | 'MOVIMENTACAO'
  pessoa: string
  valor: number
  referencia: string
  data: string
  descricao: string | null
  lojaNome: string
  logo: ImagemEmbutida | null
  assinatura: ImagemEmbutida | null
  assinaturaTesoureiro: ImagemEmbutida | null
}

const CARGO_VENERAVEL_MESTRE = 'Venerável Mestre'
const CARGO_TESOUREIRO = 'Tesoureiro'

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

/** Gera o PDF de um recibo (Mensalidade, Campanha ou Movimentação) — SPEC §27, layout retrato compactado na metade superior da folha A4 (permite imprimir 2 recibos por folha). */
export async function gerarPdfRecibo(dados: DadosRecibo): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89]) // A4 retrato
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const fontOblique = await pdf.embedFont(StandardFonts.HelveticaOblique)

  const margem = 40
  const larguraPagina = page.getWidth()
  const larguraUtil = larguraPagina - margem * 2
  let y = page.getHeight() - margem

  async function embutir(imagem: ImagemEmbutida): Promise<PDFImage> {
    return imagem.formato === 'png' ? pdf.embedPng(imagem.bytes) : pdf.embedJpg(imagem.bytes)
  }

  // --- Cabeçalho: logo no canto esquerdo + nome da Loja alinhado ao lado ---
  const alturaCabecalho = 50
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

  const xNomeLoja = margem + (logoLargura > 0 ? logoLargura + 14 : 0)
  page.drawText(dados.lojaNome, {
    x: xNomeLoja,
    y: topoCabecalho - alturaCabecalho / 2 - 1,
    size: 15,
    font: fontBold,
    color: COR_TITULO,
  })
  page.drawText('Comprovante de recebimento', {
    x: xNomeLoja,
    y: topoCabecalho - alturaCabecalho / 2 - 16,
    size: 8,
    font: fontOblique,
    color: COR_TEXTO_CLARO,
  })

  y = topoCabecalho - alturaCabecalho - 10
  page.drawLine({ start: { x: margem, y }, end: { x: margem + larguraUtil, y }, thickness: 1, color: COR_LINHA })

  // --- Título "RECIBO" + número de referência ---
  y -= 32
  const tituloTexto = 'RECIBO'
  page.drawText(tituloTexto, {
    x: margem + larguraUtil / 2 - fontBold.widthOfTextAtSize(tituloTexto, 18) / 2,
    y,
    size: 18,
    font: fontBold,
    color: COR_TITULO,
  })

  const numeroRecibo = `Nº ${dados.id.slice(0, 8).toUpperCase()}`
  page.drawText(numeroRecibo, {
    x: margem + larguraUtil - fontRegular.widthOfTextAtSize(numeroRecibo, 9),
    y: y + 3,
    size: 9,
    font: fontRegular,
    color: COR_TEXTO_CLARO,
  })

  // --- Tabela de dados ---
  y -= 26
  const valorFormatado = formatarMoedaBR(dados.valor)
  const tipoLabel =
    dados.tipo === 'MENSALIDADE' ? 'Mensalidade' : dados.tipo === 'CAMPANHA' ? 'Doação (Campanha)' : 'Recebimento'

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
  y -= 16
  const declaracao =
    dados.tipo === 'MENSALIDADE'
      ? 'Para clareza e como comprovante de quitação, firmamos o presente recibo.'
      : dados.tipo === 'CAMPANHA'
        ? 'Para clareza e como comprovante de recebimento da doação, firmamos o presente recibo.'
        : 'Para clareza e como comprovante de recebimento do valor acima, firmamos o presente recibo.'
  for (const linha of quebrarLinhas(declaracao, fontRegular, 10, larguraUtil)) {
    page.drawText(linha, { x: margem, y, size: 10, font: fontRegular, color: COR_TEXTO })
    y -= 14
  }

  // --- Assinaturas: Venerável Mestre à esquerda, Tesoureiro à direita ---
  const yAssinatura = y - 24
  const centroEsquerda = margem + larguraUtil * 0.25
  const centroDireita = margem + larguraUtil * 0.75

  async function desenharBlocoAssinatura(centroX: number, imagem: ImagemEmbutida | null, cargo: string) {
    if (imagem) {
      try {
        const img = await embutir(imagem)
        desenharImagemProporcional(page, img, centroX, yAssinatura + 38, 150, 38, 'centro')
      } catch (err) {
        console.error(`Recibo ${dados.id}: falha ao embutir assinatura (${cargo}):`, err)
      }
    }

    const linhaLargura = 175
    page.drawLine({
      start: { x: centroX - linhaLargura / 2, y: yAssinatura },
      end: { x: centroX + linhaLargura / 2, y: yAssinatura },
      thickness: 1,
      color: rgb(0.3, 0.3, 0.3),
    })

    page.drawText(cargo, {
      x: centroX - fontRegular.widthOfTextAtSize(cargo, 10) / 2,
      y: yAssinatura - 14,
      size: 10,
      font: fontRegular,
      color: COR_TEXTO,
    })
    page.drawText(dados.lojaNome, {
      x: centroX - fontOblique.widthOfTextAtSize(dados.lojaNome, 9) / 2,
      y: yAssinatura - 27,
      size: 9,
      font: fontOblique,
      color: COR_TEXTO_CLARO,
    })
  }

  await desenharBlocoAssinatura(centroEsquerda, dados.assinatura, CARGO_VENERAVEL_MESTRE)
  await desenharBlocoAssinatura(centroDireita, dados.assinaturaTesoureiro, CARGO_TESOUREIRO)

  return pdf.save()
}

/** Desenha uma tabela de duas colunas (rótulo/valor) com bordas, quebrando o valor em várias linhas quando não cabe na coluna. Devolve o y após a tabela. */
function desenharTabela(
  page: import('pdf-lib').PDFPage,
  fontRegular: PDFFont,
  fontBold: PDFFont,
  x: number,
  yTopo: number,
  largura: number,
  linhas: [string, string][]
): number {
  const colunaLabel = 130
  const tamanhoFonte = 10
  const alturaLinhaTexto = 13
  const paddingVertical = 6
  const larguraValor = largura - colunaLabel - 20

  const linhasProcessadas = linhas.map(([label, valor]) => {
    const valorLinhas = quebrarLinhas(valor, fontRegular, tamanhoFonte, larguraValor)
    const altura = Math.max(valorLinhas.length, 1) * alturaLinhaTexto + paddingVertical * 2
    return { label, valorLinhas, altura }
  })

  const alturaTotal = linhasProcessadas.reduce((soma, l) => soma + l.altura, 0)

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

  let yLinhaTopo = yTopo
  linhasProcessadas.forEach(({ label, valorLinhas, altura }, i) => {
    if (i > 0) {
      page.drawLine({
        start: { x, y: yLinhaTopo },
        end: { x: x + largura, y: yLinhaTopo },
        thickness: 1,
        color: COR_LINHA,
      })
    }

    const yPrimeiraLinha = yLinhaTopo - paddingVertical - alturaLinhaTexto + 3
    page.drawText(label, { x: x + 10, y: yPrimeiraLinha, size: tamanhoFonte, font: fontBold, color: COR_TEXTO_CLARO })

    valorLinhas.forEach((linhaValor, j) => {
      page.drawText(linhaValor, {
        x: x + colunaLabel + 10,
        y: yPrimeiraLinha - alturaLinhaTexto * j,
        size: tamanhoFonte,
        font: fontRegular,
        color: COR_TEXTO,
      })
    })

    yLinhaTopo -= altura
  })

  return yTopo - alturaTotal
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
