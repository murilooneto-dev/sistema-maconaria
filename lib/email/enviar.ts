import 'server-only'

export type Email = { para: string; assunto: string; html: string; texto: string }

/**
 * Envia um e-mail transacional pela API HTTP do Resend. O e-mail embutido
 * do Supabase só serve para os fluxos de autenticação (recuperação de
 * senha) — avisos do próprio sistema, como o lembrete de contas, precisam
 * de um provedor.
 *
 * Exige `RESEND_API_KEY` e `EMAIL_REMETENTE` (ex.: "Tesouraria
 * <avisos@dominio.com.br>", num domínio verificado no Resend). Lança erro
 * se faltar configuração ou se o provedor recusar.
 */
export async function enviarEmail(email: Email): Promise<void> {
  const chave = process.env.RESEND_API_KEY
  const remetente = process.env.EMAIL_REMETENTE

  if (!chave || !remetente) {
    throw new Error('Envio de e-mail não configurado: defina RESEND_API_KEY e EMAIL_REMETENTE.')
  }

  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: remetente,
      to: [email.para],
      subject: email.assunto,
      html: email.html,
      text: email.texto,
    }),
  })

  if (!resposta.ok) {
    throw new Error(`Resend recusou o envio (${resposta.status}): ${(await resposta.text()).slice(0, 300)}`)
  }
}

export function emailConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_REMETENTE)
}
