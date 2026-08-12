export type ValidationResult = { valido: true } | { valido: false; erro: string }

export function calcularTotal(itens: { valor: number }[]): number {
  return itens.reduce((s, i) => s + Number(i.valor), 0)
}

export function validarSelecaoRepasse(input: {
  itemIds: string[]
  contaId: string
  dataEnvio: string
}): ValidationResult {
  if (input.itemIds.length === 0) {
    return { valido: false, erro: 'Selecione ao menos um item.' }
  }
  if (!input.contaId) {
    return { valido: false, erro: 'Selecione a conta de onde o valor será enviado.' }
  }
  if (input.dataEnvio.trim().length === 0) {
    return { valido: false, erro: 'Informe a data do envio.' }
  }
  return { valido: true }
}
