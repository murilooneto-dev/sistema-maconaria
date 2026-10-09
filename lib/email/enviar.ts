import 'server-only'
import nodemailer from 'nodemailer'

export type Email = { para: string; assunto: string; html: string; texto: string }

/**
 * Envia um e-mail do sistema (ex.: lembrete de contas) por SMTP. O e-mail
 * embutido do Supabase só serve para os fluxos de autenticação.
 *
 * Configuração por variáveis de ambiente — com Gmail:
 * - SMTP_HOST=smtp.gmail.com, SMTP_PORT=465
 * - SMTP_USER = o endereço Gmail
 * - SMTP_PASS = uma SENHA DE APP do Google (não a senha da conta; exige
 *   verificação em duas etapas ativa)
 * - EMAIL_REMETENTE = ex. "Tesouraria <conta@gmail.com>" — no Gmail o
 *   endereço precisa ser o mesmo do SMTP_USER.
 *
 * Lança erro se faltar configuração ou se o servidor recusar.
 */
export async function enviarEmail(email: Email): Promise<void> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_REMETENTE } = process.env

  if (!emailConfigurado()) {
    throw new Error('Envio de e-mail não configurado: defina SMTP_HOST, SMTP_USER, SMTP_PASS e EMAIL_REMETENTE.')
  }

  const porta = Number(SMTP_PORT || 465)
  const transporte = nodemailer.createTransport({
    host: SMTP_HOST,
    port: porta,
    secure: porta === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })

  await transporte.sendMail({
    from: EMAIL_REMETENTE,
    to: email.para,
    subject: email.assunto,
    html: email.html,
    text: email.texto,
  })
}

export function emailConfigurado(): boolean {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS, EMAIL_REMETENTE } = process.env
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && EMAIL_REMETENTE)
}
