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
import { ShieldIcon, ActivityIcon, BadgeCheckIcon, FolderLockIcon, KeyIcon, FileTextIcon, LogOutIcon } from './components/icons'
import { cn } from './components/ui'

type Tab = 'trust' | 'timeline' | 'credentials' | 'assets' | 'access' | 'audit' | 'help'
type IconCmp = (props: SVGProps<SVGSVGElement>) => ReactElement
const NAV: { id: Tab; label: string; sub: string; icon: IconCmp; roles: string[] }[] = [
  { id: 'trust', label: 'Overview', sub: 'Your identity and access at a glance', icon: ShieldIcon, roles: [] },
  { id: 'timeline', label: 'Recent activity', sub: 'What happened in your account', icon: ActivityIcon, roles: [] },
  { id: 'credentials', label: 'Verified details', sub: 'Details confirmed by trusted organizations', icon: BadgeCheckIcon, roles: [] },
  { id: 'assets', label: 'My files', sub: 'Protect files and choose who may use them', icon: FolderLockIcon, roles: ['holder', 'issuer', 'admin'] },
  { id: 'access', label: 'Sharing requests', sub: 'Ask for a file or respond to a request', icon: KeyIcon, roles: ['holder', 'issuer', 'verifier', 'admin'] },
  { id: 'audit', label: 'Activity history', sub: 'See every important change', icon: FileTextIcon, roles: ['holder', 'issuer', 'admin'] },
  { id: 'help', label: 'Help', sub: 'Simple instructions for using TrustVault', icon: ShieldIcon, roles: [] },
]

export default function App() {
  const [user, setUser] = useState<any>(getCurrentUser())
  const [tab, setTab] = useState<Tab>('trust')
  const [showTools, setShowTools] = useState(false)
  if (!user) return <Login onLogin={setUser} />
  const visible = NAV.filter((item) => !item.roles.length || item.roles.includes(user.role))
  const active = visible.find((item) => item.id === tab) ?? visible[0]
  const everyday = visible.filter((item) => ['trust', 'assets', 'help'].includes(item.id))
  const tools = visible.filter((item) => !['trust', 'assets', 'help'].includes(item.id))
  const initials = (user.email?.split('@')[0] ?? 'U').slice(0, 2).toUpperCase()
  function logout() { setAuth(null); setUser(null) }
  return <div className="wallet-app">
    <div className="cyber-ambient" aria-hidden="true"><span className="cyber-grid" /><span className="cyber-trace trace-one" /><span className="cyber-trace trace-two" /><span className="cyber-node node-one" /><span className="cyber-node node-two" /></div>
    <a className="wallet-skip" href="#main-content">Skip to content</a>
    <header className="wallet-topbar">
      <button className="wallet-brand" onClick={() => setTab('trust')} aria-label="TrustVault home"><span className="wallet-brand-mark" aria-hidden="true"><span className="vault-cube"><i /><b /><em /></span></span><span>trustvault<span className="wallet-brand-dot">.</span></span></button>
      <nav className="wallet-nav" aria-label="Main navigation">
        {everyday.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={cn('wallet-nav-link', active.id === item.id && 'is-active')}>{item.id === 'trust' ? 'Home' : item.label}</button>)}
        {tools.length > 0 && <button onClick={() => setShowTools((value) => !value)} className={cn('wallet-nav-link wallet-tools-toggle', tools.some((item) => item.id === active.id) && 'is-active')}>More options {showTools ? '−' : '+'}</button>}
        {showTools && tools.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={cn('wallet-nav-link wallet-tool-link', active.id === item.id && 'is-active')}>{item.label}</button>)}
      </nav>
      <div className="wallet-account"><span className="wallet-demo-label">DEMO WORKSPACE</span><span className="wallet-avatar" title={user.email}>{initials}</span><button className="wallet-signout" onClick={logout} title="Sign out" aria-label="Sign out"><LogOutIcon className="h-4 w-4" /></button></div>
    </header>
    <main id="main-content" className="wallet-main">
      <div className="wallet-pagehead"><div><span className="wallet-eyebrow">YOUR WORKSPACE / {active.label.toUpperCase()}</span><h1>{active.label}</h1><p>{active.sub}</p></div><span className="wallet-profile"><span className="wallet-profile-dot" />{user.role} account</span></div>
      <div key={active.id} className="wallet-pagebody animate-fade-up">
        {active.id === 'trust' && <TrustPanel onNavigate={(target) => setTab(target)} />}
        {active.id === 'timeline' && <TimelinePanel />}
        {active.id === 'credentials' && <CredentialsPanel userRole={user.role} />}
        {active.id === 'assets' && <AssetsPanel onPipeline={() => {}} />}
        {active.id === 'access' && <AccessPanel />}
        {active.id === 'audit' && <AuditPanel />}
        {active.id === 'help' && <HelpPanel onNavigate={(target) => setTab(target)} />}
      </div>
    </main>
  </div>
}

function HelpPanel({ onNavigate }: { onNavigate: (target: Tab) => void }) {
  return <section className="help-panel">
    <div className="help-orb" aria-hidden="true"><span /></div>
    <span className="wallet-eyebrow">SIMPLE GUIDE</span>
    <h2>Use TrustVault in three easy steps.</h2>
    <p className="help-intro">You do not need to understand blockchain or cybersecurity. TrustVault quietly protects your information in the background.</p>
    <div className="help-steps">
      <button onClick={() => onNavigate('assets')}><span>1</span><div><strong>Add your file</strong><p>Choose the file you want to keep safe.</p></div><b>Open files ↗</b></button>
      <button onClick={() => onNavigate('access')}><span>2</span><div><strong>Choose who can see it</strong><p>Allow a person to use the file only when needed.</p></div><b>Manage sharing ↗</b></button>
      <button onClick={() => onNavigate('timeline')}><span>3</span><div><strong>Check what happened</strong><p>See a simple record of important actions.</p></div><b>View activity ↗</b></button>
    </div>
    <div className="help-note"><span>✓</span><p><strong>Your files stay private.</strong> The system only records proof that a file has not been changed. It does not put your actual file on the blockchain.</p></div>
  </section>
}
