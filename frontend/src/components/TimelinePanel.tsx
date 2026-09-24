import { useEffect, useState } from 'react'
import { api, type SecurityEvent } from '../api'
import { Badge, EmptyState, Panel, decisionTone, cn } from './ui'
import { ActivityIcon, CheckIcon, XIcon, AlertIcon } from './icons'

export default function TimelinePanel() {
  const [events, setEvents] = useState<SecurityEvent[]>([])

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        setEvents(await api.get<SecurityEvent[]>('/security/events'))
      } catch {
        /* ignore */
      }
    }, 3000)
    return () => clearInterval(t)
  }, [])

  return (
    <Panel
      title="Security event timeline"
      subtitle="Attack visible → trust score drops → STEP_UP / BLOCK triggered"
      icon={<ActivityIcon className="h-5 w-5" />}
      actions={
        <Badge tone="green" dot className="animate-pulse">
          Live
        </Badge>
      }
    >
      {events.length === 0 ? (
        <EmptyState
          icon={<ActivityIcon className="h-5 w-5" />}
          title="No security events yet"
          hint="Events stream in here as the Trust Engine evaluates requests — run the attack demo to see the score collapse in real time."
        />
      ) : (
        <ol className="relative space-y-4 border-l border-ink-700 pl-6">
          {events.map((e) => {
            const tone = decisionTone(e.decision ?? '')
            const Icon = e.decision === 'ALLOW' ? CheckIcon : e.decision === 'STEP_UP' ? AlertIcon : XIcon
            const nodeColor = e.decision === 'ALLOW' ? 'bg-emerald-500' : e.decision === 'STEP_UP' ? 'bg-amber-500' : 'bg-rose-500'
            return (
              <li key={e.id} className="relative">
                <span
                  className={cn(
                    'absolute -left-[37px] top-1.5 grid h-5 w-5 -translate-x-0 place-items-center rounded-full ring-4 ring-ink-900',
                    nodeColor,
                  )}
                >
                  <Icon className="h-3 w-3 text-white" />
                </span>
                <div className="rounded-xl border border-ink-800 bg-ink-900/50 p-3.5 transition hover:border-ink-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-brand-500/30 bg-brand-500/10 px-1.5 py-0.5 font-mono text-[11px] text-brand-300">
                      {e.event_type}
                    </span>
                    {e.decision && <Badge tone={tone}>{e.decision}</Badge>}
                    {e.trust_score !== null && (
                      <span className={cn('font-mono text-[11px]', e.trust_score >= 70 ? 'text-slate-400' : e.trust_score >= 40 ? 'text-amber-300' : 'text-rose-300')}>
                        trust {e.trust_score}
                      </span>
                    )}
                    <span className="ml-auto font-mono text-[10px] text-slate-600">
                      {new Date(e.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  {Object.keys(e.risk_signals ?? {}).length > 0 && (
                    <details className="mt-2 group">
                      <summary className="cursor-pointer text-[11px] text-slate-500 transition hover:text-slate-300">
                        Risk signals
                      </summary>
                      <pre className="mt-2 overflow-auto rounded-lg border border-ink-800 bg-ink-950 p-2.5 font-mono text-[10px] leading-relaxed text-slate-400">
                        {JSON.stringify(e.risk_signals, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}