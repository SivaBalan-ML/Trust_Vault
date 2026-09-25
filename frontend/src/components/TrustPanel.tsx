import { useEffect, useState } from 'react'
import { getCurrentUser, api, type TrustState, type SecurityEvent, type Asset, type AccessRequest } from '../api'

const CHECKS = [
  { key: 'identity', label: 'Identity' },
  { key: 'device', label: 'Device' },
  { key: 'behaviour', label: 'Activity' },
  { key: 'context', label: 'Request' },
  { key: 'history', label: 'History' },
]
const DECISIONS: Record<string, { label: string; message: string }> = {
  ALLOW: { label: 'Access ready', message: 'Your account is ready to use. Your latest access check passed.' },
  STEP_UP: { label: 'One more check', message: 'Please complete an extra identity check before continuing.' },
  BLOCK: { label: 'Access paused', message: 'This request is paused for your safety. Contact your administrator if needed.' },
}

export default function TrustPanel({ onNavigate }: { onNavigate: (target: 'timeline' | 'assets' | 'credentials' | 'access' | 'help') => void }) {
  const user = getCurrentUser()
  const userId = user?.id
  const [state, setState] = useState<TrustState | null>(null)
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [error, setError] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  useEffect(() => {
    if (!userId) return
    let mounted = true
    async function refresh() {
      const results = await Promise.allSettled([
        api.get<TrustState>(`/trust/${userId}`), api.get<SecurityEvent[]>('/security/events'), api.get<Asset[]>('/assets'), api.get<AccessRequest[]>('/access'),
      ])
      if (!mounted) return
      if (results[0].status === 'fulfilled') { setState(results[0].value); setError(false) } else setError(true)
      if (results[1].status === 'fulfilled') setEvents(results[1].value)
      if (results[2].status === 'fulfilled') setAssets(results[2].value)
      if (results[3].status === 'fulfilled') setRequests(results[3].value)
    }
    refresh()
    const timer = window.setInterval(refresh, 10000)
    return () => { mounted = false; window.clearInterval(timer) }
  }, [userId])
  const score = Math.max(0, Math.min(100, state?.trust_score ?? 0))
  const decision = DECISIONS[state?.decision ?? ''] ?? { label: 'Checking access', message: 'We are checking your account now.' }
  const scoreColor = score >= 70 ? '#84c430' : score >= 40 ? '#eda94b' : '#e26c62'
  const checkValues = CHECKS.map((check) => ({ ...check, value: Math.max(0, Math.min(100, state?.components[check.key] ?? 0)) }))
  const recentEvents = [...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 4)
  const approvedAssetIds = new Set(requests.filter((request) => request.status === 'approved').map((request) => request.asset_id))
  const approvedAssets = assets.filter((asset) => approvedAssetIds.has(asset.id))
  async function downloadApprovedAsset(asset: Asset) {
    try {
      setDownloadError('')
      const blob = await api.download(`/assets/${asset.id}/content`)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = asset.name
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setDownloadError('We could not open this file. Check that your approved access window is still active.')
    }
  }
  return <div className="wallet-overview">
    <section className="wallet-balance-card">
      <div className="wallet-card-top"><span className="wallet-overline">YOUR ACCESS</span><span className="wallet-card-index">01 / OVERVIEW</span></div>
      <div className="wallet-balance-content"><p className="wallet-muted">Current account status</p><h2>{decision.label}<span className="wallet-balance-spark">✳</span></h2><p className="wallet-balance-description">{error ? 'Unable to refresh right now. Check that the backend is running.' : decision.message}</p></div>
      <div className="wallet-balance-bottom"><button className="wallet-dark-button" onClick={() => onNavigate(user?.role === 'verifier' ? 'credentials' : 'assets')}>{user?.role === 'verifier' ? 'Verified details' : 'Open my files'} <span>↗</span></button><button className="wallet-light-button" onClick={() => onNavigate(user?.role === 'verifier' ? 'timeline' : 'credentials')}>{user?.role === 'verifier' ? 'Recent activity' : 'Verified details'}</button><span className="wallet-refreshed">{state ? 'Status updates automatically' : 'Loading account status…'}</span></div>
    </section>
    <section className="wallet-rewards-card">
      <div className="wallet-card-top"><span className="wallet-rewards-tag">PROTECTION LEVEL <span>↗</span></span><span className="wallet-rewards-more">•••</span></div>
      <div className="security-scan" aria-hidden="true"><span className="scan-line" /><i /><i /><i /><b>ENCRYPTED</b></div>
      <div className="wallet-rewards-content"><p>Your safety score</p><h2>{state ? score : '—'}<span>/100</span></h2><p className="wallet-score-caption">{score >= 70 ? 'Looking good' : score >= 40 ? 'Some checks need review' : state ? 'Action may be needed' : 'Checking your account'}</p></div>
      <div className="wallet-rewards-bottom"><div><span>ACCOUNT</span><strong>{user?.role ?? 'member'}</strong></div><div><span>PROTECTED FILES</span><strong>{assets.length}</strong></div></div>
    </section>
    <section className="wallet-start-card">
      <div><span className="wallet-overline">START HERE</span><h3>What would you like to do?</h3><p>Pick one simple action. TrustVault handles the security checks for you.</p></div>
      <div className="wallet-start-actions">
        {user?.role !== 'verifier' && <button onClick={() => onNavigate('assets')}><span className="action-shape action-file">▣</span><strong>Add a file</strong><small>Keep a file safe</small></button>}
        <button onClick={() => onNavigate('access')}><span className="action-shape action-share">↗</span><strong>Share safely</strong><small>Choose who can see it</small></button>
        <button onClick={() => onNavigate('help')}><span className="action-shape action-help">?</span><strong>Need help?</strong><small>See the simple guide</small></button>
      </div>
    </section>
    {user?.role === 'verifier' && <section className="wallet-insight-card wallet-approved-card"><div className="wallet-section-heading"><div><span className="wallet-overline">APPROVED FOR YOU</span><h3>Files you can open</h3></div><span className="wallet-small-tag">{approvedAssets.length} READY</span></div>{approvedAssets.length ? <div className="wallet-approved-list">{approvedAssets.map((asset) => <div className="wallet-event" key={asset.id}><span className="wallet-event-icon">✓</span><div><strong>{asset.name}</strong><span>Access approved by the owner</span></div><button className="wallet-dark-button" onClick={() => downloadApprovedAsset(asset)}>Open file ↗</button></div>)}</div> : <div className="wallet-empty-activity"><span>⌛</span><strong>Waiting for approval</strong><p>When the owner approves your request, the file will appear here.</p></div>}{downloadError && <p className="wallet-insight-foot">{downloadError}</p>}</section>}
    <section className="wallet-insight-card wallet-score-card"><div className="wallet-section-heading"><div><span className="wallet-overline">01 / STATUS</span><h3>Safety check</h3></div><span className="wallet-small-tag">LIVE</span></div><div className="wallet-donut" style={{ background: `conic-gradient(${scoreColor} ${score}%, #edf0e9 0)` }}><div><strong>{state ? score : '—'}</strong><span>out of 100</span></div></div><p className="wallet-insight-foot">{state ? 'Based on your identity, device and recent activity.' : 'Your account check will appear here shortly.'}</p></section>
    <section className="wallet-insight-card wallet-checks-card"><div className="wallet-section-heading"><div><span className="wallet-overline">02 / BREAKDOWN</span><h3>What we checked</h3></div><span className="wallet-small-tag">{CHECKS.length} CHECKS</span></div><div className="wallet-check-list">{checkValues.map((item) => <div className="wallet-check-row" key={item.key}><div className="wallet-check-text"><span>{item.label}</span><strong>{state ? `${Math.round(item.value)}%` : '—'}</strong></div><div className="wallet-bar"><span style={{ width: `${item.value}%`, backgroundColor: item.value >= 70 ? '#91c94b' : item.value >= 40 ? '#eda94b' : '#e26c62' }} /></div><p>{!state ? 'Waiting for your account check' : item.value >= 70 ? 'Looking good' : item.value >= 40 ? 'Needs review' : 'Action may be needed'}</p></div>)}</div></section>
    <section className="wallet-insight-card wallet-activity-card"><div className="wallet-section-heading"><div><span className="wallet-overline">03 / HISTORY</span><h3>Recent activity</h3></div><button className="wallet-view-all" onClick={() => onNavigate('timeline')}>View all ↗</button></div>{recentEvents.length ? <div className="wallet-event-list">{recentEvents.map((event) => <div className="wallet-event" key={event.id}><span className={`wallet-event-icon ${event.decision === 'BLOCK' ? 'is-blocked' : event.decision === 'STEP_UP' ? 'is-review' : ''}`}>{event.decision === 'BLOCK' ? '×' : event.decision === 'STEP_UP' ? '!' : '✓'}</span><div><strong>{event.event_type.replaceAll('_', ' ').toLowerCase()}</strong><span>{new Date(event.created_at).toLocaleString()}</span></div><em>{event.decision === 'ALLOW' ? 'Allowed' : event.decision === 'BLOCK' ? 'Paused' : event.decision === 'STEP_UP' ? 'Review' : 'Recorded'}</em></div>)}</div> : <div className="wallet-empty-activity"><span>↗</span><strong>All quiet here</strong><p>When something happens in your account, it will show up here.</p></div>}</section>
  </div>
}
