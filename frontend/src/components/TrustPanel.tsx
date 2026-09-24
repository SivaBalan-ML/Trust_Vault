import { useEffect, useState } from 'react'
import { getCurrentUser, api, type TrustState } from '../api'
import { Badge, Panel, decisionTone, cn } from './ui'
import { ShieldIcon } from './icons'

const COMPONENTS = [
  { key: 'identity', label: 'Identity', weight: 30, desc: 'credential validity & auth failures' },
  { key: 'device', label: 'Device', weight: 20, desc: 'known & active vs new or revoked' },
  { key: 'behaviour', label: 'Behaviour', weight: 20, desc: 'request velocity & access sequences' },
  { key: 'context', label: 'Context', weight: 15, desc: 'unusual hour or geo penalty' },
  { key: 'history', label: 'History', weight: 15, desc: 'recent anomaly decisions' },
]

const DECISION_META: Record<string, { text: string; dot: string }> = {
  ALLOW: { text: 'Access granted — identity and context look healthy.', dot: 'bg-emerald-400' },
  STEP_UP: { text: 'Stepped up — extra verification is required right now.', dot: 'bg-amber-400' },
  BLOCK: { text: 'Blocked — risky signals detected in this context.', dot: 'bg-rose-400' },
}

export default function TrustPanel() {
  const user = getCurrentUser()
  const [state, setState] = useState<TrustState | null>(null)

  useEffect(() => {
    if (!user) return
    const t = setInterval(async () => {
      try {
        setState(await api.get<TrustState>(`/trust/${user.id}`))
      } catch {
        /* backend offline */
      }
    }, 4000)
    return () => clearInterval(t)
  }, [user])

  if (!state) {
    return (
      <Panel title="Trust score" icon={<ShieldIcon className="h-5 w-5" />}>
        <p className="text-sm text-slate-500">Loading trust state…</p>
      </Panel>
    )
  }

  const score = state.trust_score
  const tone = decisionTone(state.decision)
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#f43f5e'
  const R = 52
  const CIRC = 2 * Math.PI * R

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <Panel
        title="Trust score"
        subtitle={`model ${state.model_version}`}
        icon={<ShieldIcon className="h-5 w-5" />}
        actions={<Badge tone={tone} dot>{state.decision}</Badge>}
      >
        <div className="flex flex-col items-center py-4">
          <div className="relative h-32 w-32">
            <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
              <defs>
                <linearGradient id="trust-gauge" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor={color} />
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r={R} fill="none" stroke="#1c2540" strokeWidth="12" />
              <circle
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke="url(#trust-gauge)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${(score / 100) * CIRC} ${CIRC}`}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold tracking-tight text-white">{score}</span>
              <span className="text-[10px] uppercase tracking-widest text-slate-500">/ 100</span>
            </div>
          </div>

          <p className="mt-4 max-w-[240px] text-center text-xs leading-relaxed text-slate-400">
            {DECISION_META[state.decision]?.text ?? 'Explainable, weighted trust score.'}
          </p>

          {state.ml_signal !== null && (
            <div className="mt-4 w-full rounded-xl border border-ink-700/70 bg-ink-950/60 px-3 py-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">ML anomaly signal</span>
                <span className={cn('font-mono', state.ml_signal < 0 ? 'text-amber-300' : 'text-slate-300')}>
                  {state.ml_signal.toFixed(3)}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-slate-600">negative = outlier (Isolation Forest)</p>
            </div>
          )}
        </div>
      </Panel>

      <div className="space-y-5 lg:col-span-2">
        <Panel title="How the score is built" subtitle="Weighted signals, refreshed continuously">
          <div className="space-y-4">
            {COMPONENTS.map((c) => {
              const v = state.components[c.key] ?? 0
              const barColor = v >= 70 ? 'from-emerald-500 to-emerald-400' : v >= 40 ? 'from-amber-500 to-amber-400' : 'from-rose-500 to-rose-400'
              return (
                <div key={c.key}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-slate-200">{c.label}</span>
                      <span className="text-[11px] text-slate-600">{c.desc}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-400">{v.toFixed(0)}%</span>
                      <span className="rounded-md border border-ink-700 bg-ink-950/70 px-1.5 py-px font-mono text-[10px] text-slate-500">
                        ×{c.weight}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-800">
                    <div
                      className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', barColor)}
                      style={{ width: `${v}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>

        <Panel
          title="Explainability — reason codes"
          subtitle="Every decision is explainable and auditable"
          actions={
            <details className="group text-xs">
              <summary className="cursor-pointer rounded-lg border border-ink-700 px-2.5 py-1.5 font-medium text-slate-400 transition hover:text-slate-200">
                Raw JSON
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-ink-800 bg-ink-950 p-3 font-mono text-[10px] leading-relaxed text-slate-400">
                {JSON.stringify(
                  {
                    trust_score: state.trust_score,
                    decision: state.decision,
                    reasons: state.reasons,
                    model_version: state.model_version,
                    timestamp: new Date(state.timestamp).toISOString(),
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
          }
        >
          <div className="flex flex-wrap gap-2">
            {(state.reasons.length ? state.reasons : ['OK']).map((r) => (
              <Badge
                key={r}
                tone={r.includes('REVOKED') || r.includes('EXCESSIVE') ? 'red' : r === 'OK' || r.includes('KNOWN') ? 'green' : 'amber'}
              >
                {r}
              </Badge>
            ))}
          </div>
          {state.reasons.length === 0 && (
            <p className="mt-2 text-xs text-slate-500">No anomalies — the policy pipeline is running clean.</p>
          )}
        </Panel>
      </div>
    </div>
  )
}