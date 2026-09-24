import { useState } from 'react'
import type { ReactElement, SVGProps } from 'react'
import { setAuth, getCurrentUser } from './api'
import Login from './components/Login'
import TrustPanel from './components/TrustPanel'
import TimelinePanel from './components/TimelinePanel'
import CredentialsPanel from './components/CredentialsPanel'
import AssetsPanel from './components/AssetsPanel'
import AccessPanel from './components/AccessPanel'
import AuditPanel from './components/AuditPanel'
import {
  ShieldIcon,
  ActivityIcon,
  BadgeCheckIcon,
  FolderLockIcon,
  KeyIcon,
  FileTextIcon,
  LogOutIcon,
} from './components/icons'
import { cn } from './components/ui'

type Tab = 'trust' | 'timeline' | 'credentials' | 'assets' | 'access' | 'audit'

type IconCmp = (props: SVGProps<SVGSVGElement>) => ReactElement

const NAV: { id: Tab; label: string; sub: string; icon: IconCmp; roles: string[] }[] = [
  { id: 'trust', label: 'Trust score', sub: 'Live Trust Engine state for your identity', icon: ShieldIcon, roles: [] },
  { id: 'timeline', label: 'Security timeline', sub: 'Security events and risk signals in real time', icon: ActivityIcon, roles: [] },
  { id: 'credentials', label: 'Credentials', sub: 'Hash-anchored verifiable credentials', icon: BadgeCheckIcon, roles: [] },
  { id: 'assets', label: 'Assets & policies', sub: 'Encrypted documents and ABAC policies', icon: FolderLockIcon, roles: ['holder', 'issuer', 'admin'] },
  { id: 'access', label: 'Access requests', sub: 'Purpose- and time-bound access grants', icon: KeyIcon, roles: ['holder', 'issuer', 'verifier', 'admin'] },
  { id: 'audit', label: 'Audit trail', sub: 'Immutable on-chain audit anchors', icon: FileTextIcon, roles: ['holder', 'issuer', 'admin'] },
]

const ROLE_STYLES: Record<string, string> = {
  admin: 'border-rose-500/40 bg-rose-500/15 text-rose-300',
  issuer: 'border-sky-500/40 bg-sky-500/15 text-sky-300',
  holder: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  verifier: 'border-violet-500/40 bg-violet-500/15 text-violet-300',
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 shadow-lg shadow-brand-600/30">
        <ShieldIcon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-base font-bold tracking-tight text-white">TrustVault</p>
        <p className="truncate text-[11px] text-slate-500">Verify once. Control access everywhere.</p>
      </div>
    </div>
  )
}

function App() {
  const [user, setUser] = useState<any>(getCurrentUser())
  const [tab, setTab] = useState<Tab>('trust')

  if (!user) return <Login onLogin={setUser} />

  const visible = NAV.filter((t) => t.roles.length === 0 || t.roles.includes(user.role))
  const active = NAV.find((t) => t.id === tab) ?? NAV[0]

  function logout() {
    setAuth(null)
    setUser(null)
  }

  const initials = (user.email?.split('@')[0] ?? 'U').slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-ink-800/80 bg-ink-900/40 backdrop-blur-xl lg:flex">
        <div className="px-6 py-6">
          <Brand />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Workspace</p>
          {visible.map((t) => {
            const isActive = tab === t.id
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-gradient-to-r from-brand-500/25 to-violet-500/10 text-white shadow-lg shadow-brand-600/10 ring-1 ring-brand-500/30'
                    : 'text-slate-400 hover:bg-ink-800/60 hover:text-slate-200',
                )}
              >
                <Icon
                  className={cn(
                    'h-[18px] w-[18px] shrink-0 transition',
                    isActive ? 'text-brand-300' : 'text-slate-500 group-hover:text-slate-300',
                  )}
                />
                <span className="flex-1 text-left">{t.label}</span>
                {isActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-400 shadow-[0_0_10px] shadow-brand-400/80" />
                )}
              </button>
            )
          })}
        </nav>

        <div className="border-t border-ink-800/80 p-4">
          <div className="flex items-center gap-3 rounded-xl border border-ink-800/70 bg-ink-900/60 p-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500/40 to-violet-600/40 text-xs font-bold text-white ring-1 ring-white/10">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-200">{user.email}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className={cn(
                    'rounded-full border px-1.5 py-px text-[10px] font-medium capitalize',
                    ROLE_STYLES[user.role] ?? 'border-ink-700 bg-ink-800 text-slate-300',
                  )}
                >
                  {user.role}
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-ink-700 text-slate-400 transition hover:border-rose-500/50 hover:text-rose-300"
            >
              <LogOutIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-ink-800/60 bg-ink-950/85 backdrop-blur lg:hidden">
          <div className="px-4 py-3">
            <Brand />
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3">
            {visible.map((t) => {
              const isActive = tab === t.id
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition',
                    isActive ? 'bg-brand-500/20 text-white ring-1 ring-brand-500/40' : 'text-slate-400 hover:text-slate-200',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              )
            })}
          </nav>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
          <div key={tab} className="animate-fade-up">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">{active.label}</h1>
                <p className="mt-0.5 text-sm text-slate-500">{active.sub}</p>
              </div>
              <span className="hidden items-center gap-2 lg:flex">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <span className="text-xs text-slate-500">Live</span>
              </span>
            </div>

            {tab === 'trust' && <TrustPanel />}
            {tab === 'timeline' && <TimelinePanel />}
            {tab === 'credentials' && <CredentialsPanel userRole={user.role} />}
            {tab === 'assets' && <AssetsPanel onPipeline={() => {}} />}
            {tab === 'access' && <AccessPanel />}
            {tab === 'audit' && <AuditPanel />}
          </div>
        </main>
      </div>
    </div>
  )
}

export default App