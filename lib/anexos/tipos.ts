export type EntidadeTipoAnexo = 'MEMBRO' | 'PAGAMENTO' | 'MOVIMENTACAO'

export type Anexo = {
  id: string
  nome_arquivo: string
  path: string
  tipo_mime: string
  tamanho_bytes: number
  enviado_por: string
  criado_em: string
}
