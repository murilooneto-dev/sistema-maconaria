import { validarMembro } from './membros'

export type LinhaCsvMembro = {
  numeroLinha: number
  nome: string
  matricula: string
  telefone: string | null
  doQuadro: boolean
  remido: boolean
  recolhe: boolean
  erro?: string
}

export type ResultadoParseCsv = { linhas: LinhaCsvMembro[]; erroCabecalho?: string }

const COLUNAS_ESPERADAS = ['nome', 'matricula', 'telefone', 'doquadro', 'remido', 'recolhe']

function normalizarCabecalho(campo: string): string {
  return campo
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '')
}

function parseBooleano(valor: string | undefined): boolean {
  if (!valor) return false
  const v = valor.trim().toLowerCase()
  return v === 'sim' || v === 's' || v === 'true' || v === '1'
}

function dividirLinhaCsv(linha: string): string[] {
  return linha.split(';').map((campo) => campo.trim().replace(/^"|"$/g, ''))
}

/**
 * Faz o parse de um CSV de membros (separador `;`, com cabeçalho — mesmo
 * padrão de lib/csv.ts) e valida cada linha com validarMembro(). Não toca
 * no banco — a verificação de matrícula duplicada só é possível na Server
 * Action, que tem acesso ao banco.
 */
export function parseCsvMembros(conteudo: string): ResultadoParseCsv {
  const texto = conteudo.replace(/^﻿/, '').trim()
  const linhasBrutas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0)

  if (linhasBrutas.length === 0) {
    return { linhas: [], erroCabecalho: 'Arquivo vazio.' }
  }

  const cabecalho = dividirLinhaCsv(linhasBrutas[0]).map(normalizarCabecalho)
  const indice = (coluna: string) => cabecalho.indexOf(coluna)

  const idxNome = indice('nome')
  const idxMatricula = indice('matricula')

  if (idxNome === -1 || idxMatricula === -1) {
    return {
      linhas: [],
      erroCabecalho: `Cabeçalho inválido — as colunas obrigatórias são: ${COLUNAS_ESPERADAS.slice(0, 2).join(', ')}. Colunas opcionais: telefone, doQuadro, remido, recolhe.`,
    }
  }

  const idxTelefone = indice('telefone')
  const idxDoQuadro = indice('doquadro')
  const idxRemido = indice('remido')
  const idxRecolhe = indice('recolhe')

  const linhas: LinhaCsvMembro[] = linhasBrutas.slice(1).map((linhaTexto, i) => {
    const campos = dividirLinhaCsv(linhaTexto)
    const nome = campos[idxNome] ?? ''
    const matricula = campos[idxMatricula] ?? ''
    const telefone = idxTelefone >= 0 ? campos[idxTelefone] || null : null

    const validacao = validarMembro({ nome, matricula })

    return {
      numeroLinha: i + 2, // +1 pelo cabeçalho, +1 porque é 1-indexado
      nome: nome.trim(),
      matricula: matricula.trim(),
      telefone,
      doQuadro: idxDoQuadro >= 0 ? parseBooleano(campos[idxDoQuadro]) : true,
      remido: idxRemido >= 0 ? parseBooleano(campos[idxRemido]) : false,
      recolhe: idxRecolhe >= 0 ? parseBooleano(campos[idxRecolhe]) : false,
      erro: validacao.valido ? undefined : validacao.erro,
    }
  })

  return { linhas }
}
