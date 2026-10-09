import {
  DIAS_ANTECEDENCIA_LEMBRETE,
  type GruposLembrete,
  type TipoConta,
} from '@/lib/domain/contas-pagar-receber'
import { formatarDataBR, formatarMoedaBR } from '@/lib/format'

export type ContaLembrete = {
  tipo: TipoConta
  nome: string
  valor: number
  data_vencimento: string
  status: string
  parcela: number | null
  total_parcelas: number | null
}

function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function rotulo(conta: ContaLembrete): string {
  return conta.parcela ? `${conta.nome} (${conta.parcela}/${conta.total_parcelas})` : conta.nome
}

function linhaTexto(conta: ContaLembrete): string {
  const tipo = conta.tipo === 'PAGAR' ? 'A pagar' : 'A receber'
  return `- ${formatarDataBR(conta.data_vencimento)} | ${tipo} | ${rotulo(conta)} | ${formatarMoedaBR(Number(conta.valor))}`
}

function secaoHtml(titulo: string, contas: ContaLembrete[]): string {
  if (contas.length === 0) return ''
  const linhas = contas
    .map(
      (c) =>
        `<tr><td style="padding:4px 12px 4px 0">${formatarDataBR(c.data_vencimento)}</td>` +
        `<td style="padding:4px 12px 4px 0">${c.tipo === 'PAGAR' ? 'A pagar' : 'A receber'}</td>` +
        `<td style="padding:4px 12px 4px 0">${escaparHtml(rotulo(c))}</td>` +
        `<td style="padding:4px 0;text-align:right">${formatarMoedaBR(Number(c.valor))}</td></tr>`
    )
    .join('')
  return `<h3 style="margin:20px 0 6px">${titulo}</h3><table style="border-collapse:collapse;font-size:14px">${linhas}</table>`
}

function secaoTexto(titulo: string, contas: ContaLembrete[]): string {
  if (contas.length === 0) return ''
  return `${titulo}\n${contas.map(linhaTexto).join('\n')}\n\n`
}

/** Monta o e-mail diário de lembrete de vencimentos. Função pura: não busca nem envia nada. */
export function montarEmailLembrete(
  grupos: GruposLembrete<ContaLembrete>,
  lojaNome: string,
  urlSistema: string
): { assunto: string; html: string; texto: string } {
  const tituloHoje = 'Vencem hoje'
  const tituloEmBreve = `Vencem em ${DIAS_ANTECEDENCIA_LEMBRETE} dias`
  const tituloVencidas = 'Vencidas e ainda em aberto'
  const link = `${urlSistema}/financeiro/contas-a-pagar`

  const partes: string[] = []
  if (grupos.venceHoje.length > 0) partes.push(`${grupos.venceHoje.length} hoje`)
  if (grupos.venceEmBreve.length > 0) partes.push(`${grupos.venceEmBreve.length} em ${DIAS_ANTECEDENCIA_LEMBRETE} dias`)

  const html =
    `<div style="font-family:Arial,sans-serif;color:#0f172a">` +
    `<h2 style="margin:0 0 4px">Contas a pagar e a receber</h2>` +
    `<p style="margin:0;color:#64748b">${escaparHtml(lojaNome)}</p>` +
    secaoHtml(tituloHoje, grupos.venceHoje) +
    secaoHtml(tituloEmBreve, grupos.venceEmBreve) +
    secaoHtml(tituloVencidas, grupos.vencidas) +
    `<p style="margin-top:24px"><a href="${link}">Abrir contas a pagar e a receber</a></p>` +
    `</div>`

  const texto =
    `Contas a pagar e a receber — ${lojaNome}\n\n` +
    secaoTexto(tituloHoje, grupos.venceHoje) +
    secaoTexto(tituloEmBreve, grupos.venceEmBreve) +
    secaoTexto(tituloVencidas, grupos.vencidas) +
    `Abrir: ${link}\n`

  return { assunto: `Lembrete de vencimentos: ${partes.join(' e ')}`, html, texto }
}
