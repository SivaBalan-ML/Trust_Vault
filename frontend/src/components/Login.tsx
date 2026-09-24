import { useState } from 'react'
import { api, authApi, setAuth } from '../api'
import { BadgeCheckIcon, ChevronRightIcon, FingerprintIcon, LockIcon, ShieldIcon } from './icons'
import { BtnPrimary, Field, Input, Notice, Spinner, cn } from './ui'

const DEMO_ACCOUNTS = [
  { email: 'issuer@trustvault.example', label: 'Issuer', desc: 'An institution that issues credentials', dot: 'bg-sky-400' },
  { email: 'holder@trustvault.example', label: 'Holder', desc: 'A user with encrypted assets & policies', dot: 'bg-emerald-400' },
  { email: 'verifier@trustvault.example', label: 'Verifier', desc: 'An employer requesting scoped access', dot: 'bg-violet-400' },
  { email: 'admin@trustvault.example', label: 'Admin', desc: 'Platform administrator with override', dot: 'bg-rose-400' },
]

const FEATURES = [
  { icon: <BadgeCheckIcon className="h-4 w-4" />, title: 'Verify once', text: 'Institutions issue hash-anchored credentials a single time.' },
  { icon: <LockIcon className="h-4 w-4" />, title: 'Privacy by design', text: 'Documents stay AES-256-GCM encrypted — never raw on chain.' },
  { icon: <FingerprintIcon className="h-4 w-4" />, title: 'Context-aware access', text: 'The Trust Engine re-evaluates every request against evolving risk.' },
  { icon: <ShieldIcon className="h-4 w-4" />, title: 'Immutably auditable', text: 'High-value events are anchored to the blockchain.' },
]

export default function Login({ onLogin }: { onLogin: (user: any) => void }) {
  const [email, setEmail] = useState(DEMO_ACCOUNTS[1].email)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn(mail: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await authApi.devLogin(mail)
      setAuth(res.access_token, res.user)
      const me = await api.get<any>('/auth/me')
      setAuth(res.access_token, me)
      onLogin(me)
    } catch (e: any) {
      setError(e?.message ?? 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-ink-700/60 bg-ink-900/60 shadow-2xl shadow-black/50 backdrop-blur animate-fade-up lg:grid-cols-[1.05fr_1fr]">
        <div className="relative hidden flex-col justify-between bg-gradient-to-br from-brand-950 via-ink-900 to-ink-950 p-10 lg:flex">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand-600/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-violet-600/20 blur-3xl" />

          <div className="relative flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 shadow-lg shadow-brand-600/40">
              <ShieldIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-white">TrustVault</p>
              <p className="text-xs text-slate-400">Verify once. Control access everywhere.</p>
            </div>
          </div>

          <div className="relative space-y-5">
            <p className="text-2xl font-bold leading-snug tracking-tight text-white">
              Blockchain-anchored,
              <br />
              privacy-preserving
              <br />
              identity &amp; access control.
            </p>
            <div className="space-y-3.5">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex items-start gap-3">
                  <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-brand-500/30 bg-brand-500/10 text-brand-300">
                    {f.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{f.title}</p>
                    <p className="text-xs leading-relaxed text-slate-500">{f.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="relative text-[11px] text-slate-600">
            Demo build · runs free on Sepolia testnet with WebAuthn / passkey support
          </p>
        </div>

        <div className="p-8 sm:p-12">
          <div className="lg:hidden">
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 shadow-lg shadow-brand-600/40">
                <ShieldIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-base font-bold tracking-tight text-white">TrustVault</p>
                <p className="text-[11px] text-slate-500">Verify once. Control access everywhere.</p>
              </div>
            </div>
          </div>

          <h1 className="text-xl font-bold tracking-tight text-white">Sign in to get started</h1>
          <p className="mt-1 text-sm text-slate-500">
            Pick a role below to enter the security flow, or use your own demo email.
          </p>

          <form
            className="mt-6 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              signIn(email)
            }}
          >
            <Field label="Email" hint="dev-login fallback">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@trustvault.example" />
            </Field>
            <BtnPrimary className="w-full" disabled={busy}>
              {busy && <Spinner />}
              {busy ? 'Signing in…' : 'Sign in'}
            </BtnPrimary>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-ink-800" />
            <span className="text-[11px] uppercase tracking-widest text-slate-600">or demo role</span>
            <div className="h-px flex-1 bg-ink-800" />
          </div>

          <div className="space-y-2">
            {DEMO_ACCOUNTS.map((a, i) => (
              <button
                key={a.email}
                disabled={busy}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-xl border border-ink-800 bg-ink-900/60 px-4 py-3 text-left transition',
                  'hover:border-brand-500/50 hover:bg-brand-500/5 disabled:cursor-wait disabled:opacity-60',
                  i === 0 || i === 3 ? 'hidden sm:flex' : '',
                )}
                onClick={() => signIn(a.email)}
              >
                <span className={cn('h-2 w-2 shrink-0 rounded-full', a.dot)} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-200">{a.label}</span>
                    <span className="font-mono text-[10px] text-slate-500">{a.email}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">{a.desc}</span>
                </span>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-brand-300" />
              </button>
            ))}
          </div>

          <Notice tone="slate" className="mt-6">
            <span className="font-medium">Why demo roles?</span> The dev-login fallback lets the whole security
            flow run without a hardware authenticator. The production path uses WebAuthn passkeys ({' '}
            <code className="font-mono text-[10px]">register/start → complete → login/start → complete</code>).
          </Notice>

          {error && (
            <Notice tone="red" className="mt-3">
              {error}
            </Notice>
          )}
        </div>
      </div>
    </div>
  )
}