function escaparCampo(valor: string): string {
  if (/[";\n]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`
  }
  return valor
}

/** Gera CSV (separador `;`, compatível com Excel em PT-BR) a partir de colunas e linhas. */
export function gerarCsv(colunas: string[], linhas: (string | number)[][]): string {
  const cabecalho = colunas.map(escaparCampo).join(';')
  const corpo = linhas.map((linha) => linha.map((v) => escaparCampo(String(v))).join(';')).join('\n')
  return `﻿${cabecalho}\n${corpo}`
}
