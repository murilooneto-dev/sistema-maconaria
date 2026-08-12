import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { formatarDataBR } from '@/lib/format'

export type ImagemEmbutida = { bytes: Uint8Array; formato: 'png' | 'jpg' }

export type DadosRecibo = {
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

/** Gera o PDF de um recibo (Mensalidade ou Campanha) — SPEC §27. */
export async function gerarPdfRecibo(dados: DadosRecibo): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89]) // A4
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const margemEsquerda = 60
  const larguraUtil = page.getWidth() - margemEsquerda * 2
  let y = page.getHeight() - 60

  async function embutir(imagem: ImagemEmbutida) {
    return imagem.formato === 'png' ? pdf.embedPng(imagem.bytes) : pdf.embedJpg(imagem.bytes)
  }

  if (dados.logo) {
    try {
      const logoImg = await embutir(dados.logo)
      const altura = 60
      const largura = (logoImg.width / logoImg.height) * altura
      page.drawImage(logoImg, { x: margemEsquerda, y: y - altura + 10, width: largura, height: altura })
    } catch {
      // logo em formato não suportado — segue sem imagem, não impede a emissão do recibo.
    }
  }

  page.drawText(dados.lojaNome, {
    x: margemEsquerda + 90,
    y: y - 10,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  })

  y -= 90

  page.drawText('RECIBO', {
    x: margemEsquerda + larguraUtil / 2 - fontBold.widthOfTextAtSize('RECIBO', 20) / 2,
    y,
    size: 20,
    font: fontBold,
  })

  y -= 50

  const valorFormatado = `R$ ${dados.valor.toFixed(2).replace('.', ',')}`
  const tipoLabel = dados.tipo === 'MENSALIDADE' ? 'mensalidade' : 'doação'

  const corpo = `Recebemos de ${dados.pessoa} a quantia de ${valorFormatado}, referente a ${tipoLabel}: ${dados.referencia}.`

  for (const linha of quebrarLinhas(corpo, fontRegular, 12, larguraUtil)) {
    page.drawText(linha, { x: margemEsquerda, y, size: 12, font: fontRegular })
    y -= 20
  }

  if (dados.descricao) {
    y -= 10
    for (const linha of quebrarLinhas(dados.descricao, fontRegular, 11, larguraUtil)) {
      page.drawText(linha, { x: margemEsquerda, y, size: 11, font: fontRegular, color: rgb(0.3, 0.3, 0.3) })
      y -= 18
    }
  }

  y -= 20
  page.drawText(`Data: ${formatarDataBR(dados.data)}`, { x: margemEsquerda, y, size: 12, font: fontRegular })

  y -= 100

  if (dados.assinatura) {
    try {
      const assinaturaImg = await embutir(dados.assinatura)
      const altura = 50
      const largura = (assinaturaImg.width / assinaturaImg.height) * altura
      const x = margemEsquerda + larguraUtil / 2 - largura / 2
      page.drawImage(assinaturaImg, { x, y, width: largura, height: altura })
      y -= 5
    } catch {
      // assinatura em formato não suportado — segue sem imagem.
    }
  }

  const linhaLargura = 220
  const linhaX = margemEsquerda + larguraUtil / 2 - linhaLargura / 2
  page.drawLine({
    start: { x: linhaX, y },
    end: { x: linhaX + linhaLargura, y },
    thickness: 1,
    color: rgb(0.2, 0.2, 0.2),
  })

  y -= 16
  page.drawText(CARGO_ASSINATURA, {
    x: margemEsquerda + larguraUtil / 2 - fontRegular.widthOfTextAtSize(CARGO_ASSINATURA, 11) / 2,
    y,
    size: 11,
    font: fontRegular,
  })

  return pdf.save()
}

function quebrarLinhas(texto: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, larguraMax: number): string[] {
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
