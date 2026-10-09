import { RecuperarSenhaForm } from './RecuperarSenhaForm'

export default async function RecuperarSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const params = await searchParams
  return <RecuperarSenhaForm linkInvalido={params.erro === 'link'} />
}
