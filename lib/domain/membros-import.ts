import { validarMembro } from './membros'

export type LinhaCsvMembro = {
  numeroLinha: number
  nome: string
  matricula: string | null
  telefone: string | null
  doQuadro: boolean
  remido: boolean
  recolhe: boolean
  emIniciacao: boolean
  erro?: string
}

export type ResultadoParseCsv = { linhas: LinhaCsvMembro[]; erroCabecalho?: string }

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
 * Action, que tem acesso ao banco. Matrícula é opcional (membros em
 * iniciação ainda não têm uma).
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

  if (idxNome === -1) {
    return {
      linhas: [],
      erroCabecalho:
        'Cabeçalho inválido — a coluna obrigatória é: nome. Colunas opcionais: matricula, telefone, doQuadro, remido, recolhe, emIniciacao.',
    }
  }

  const idxMatricula = indice('matricula')
  const idxTelefone = indice('telefone')
  const idxDoQuadro = indice('doquadro')
  const idxRemido = indice('remido')
  const idxRecolhe = indice('recolhe')
  const idxEmIniciacao = indice('eminiciacao')

  const linhas: LinhaCsvMembro[] = linhasBrutas.slice(1).map((linhaTexto, i) => {
    const campos = dividirLinhaCsv(linhaTexto)
    const nome = campos[idxNome] ?? ''
    const matricula = idxMatricula >= 0 ? campos[idxMatricula] || null : null
    const telefone = idxTelefone >= 0 ? campos[idxTelefone] || null : null

    const validacao = validarMembro({ nome, matricula: matricula ?? '' })

    return {
      numeroLinha: i + 2, // +1 pelo cabeçalho, +1 porque é 1-indexado
      nome: nome.trim(),
      matricula: matricula?.trim() || null,
      telefone,
      doQuadro: idxDoQuadro >= 0 ? parseBooleano(campos[idxDoQuadro]) : true,
      remido: idxRemido >= 0 ? parseBooleano(campos[idxRemido]) : false,
      recolhe: idxRecolhe >= 0 ? parseBooleano(campos[idxRecolhe]) : false,
      emIniciacao: idxEmIniciacao >= 0 ? parseBooleano(campos[idxEmIniciacao]) : false,
      erro: validacao.valido ? undefined : validacao.erro,
    }
  })

  return { linhas }
}
