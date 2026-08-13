export type ValidationResult = { valido: true } | { valido: false; erro: string }

export const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024 // 10 MB

const EXTENSOES_ACEITAS = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'csv', 'xls', 'xlsx']

function extensao(nomeArquivo: string): string {
  const partes = nomeArquivo.split('.')
  return partes.length > 1 ? (partes.pop() ?? '').toLowerCase() : ''
}

/**
 * Valida por extensão (não só por MIME) porque navegadores/SOs enviam MIME
 * inconsistente para .csv/.xls em vários cenários — a extensão é o sinal
 * mais confiável disponível sem inspecionar o conteúdo do arquivo.
 */
export function validarArquivoAnexo(arquivo: { name: string; size: number }): ValidationResult {
  if (!arquivo.name || arquivo.size === 0) {
    return { valido: false, erro: 'Arquivo inválido.' }
  }

  const ext = extensao(arquivo.name)
  if (!EXTENSOES_ACEITAS.includes(ext)) {
    return {
      valido: false,
      erro: `Tipo de arquivo não permitido (.${ext || '?'}). Aceitos: ${EXTENSOES_ACEITAS.join(', ')}.`,
    }
  }

  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    return { valido: false, erro: 'Arquivo excede o limite de 10MB.' }
  }

  return { valido: true }
}
