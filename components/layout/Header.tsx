import { signOut } from '@/app/login/actions'

type HeaderProps = {
  nome: string
  role: string
  lojaNome: string
  lojaLogoUrl: string | null
}

export function Header({ nome, role, lojaNome, lojaLogoUrl }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="flex items-center gap-3">
        {lojaLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lojaLogoUrl} alt={`Logo — ${lojaNome}`} className="h-10 w-10 rounded object-contain" />
        )}
        <span className="font-semibold text-slate-900">{lojaNome}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right text-sm">
          <p className="font-medium text-slate-900">{nome}</p>
          <p className="text-slate-500">{role}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Sair
          </button>
        </form>
      </div>
    </header>
  )
}
