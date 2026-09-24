import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { AlertIcon, CheckIcon, InfoIcon, XIcon } from './icons'

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

export type Tone = 'green' | 'amber' | 'red' | 'slate' | 'blue' | 'brand' | 'violet'

const badgeTones: Record<Tone, string> = {
  green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  red: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  blue: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  slate: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  brand: 'bg-brand-500/15 text-brand-300 border-brand-500/30',
  violet: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
}

const dotTones: Record<Tone, string> = {
  green: 'bg-emerald-400',
  amber: 'bg-amber-400',
  red: 'bg-rose-400',
  blue: 'bg-sky-400',
  slate: 'bg-slate-400',
  brand: 'bg-brand-400',
  violet: 'bg-violet-400',
}

export function Badge({
  tone = 'slate',
  dot,
  children,
  className,
}: {
  tone?: Tone
  dot?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
        badgeTones[tone],
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotTones[tone])} />}
      {children}
    </span>
  )
}

export function decisionTone(d: string): 'green' | 'amber' | 'red' {
  if (d === 'ALLOW') return 'green'
  if (d === 'STEP_UP') return 'amber'
  return 'red'
}

export function Panel({
  title,
  subtitle,
  icon,
  actions,
  children,
  className,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl border border-ink-700/60 bg-ink-900/50 p-5 shadow-xl shadow-black/20',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ink-700/70 bg-ink-800/70 text-brand-300">
              {icon}
            </div>
          )}
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-slate-200">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
        </div>
        {actions}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-medium text-slate-400">
        <span>{label}</span>
        {hint && <span className="font-normal text-slate-600">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

export const inputCls =
  'w-full rounded-lg border border-ink-700/80 bg-ink-950/70 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputCls, className)} {...props} />
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputCls, 'appearance-none cursor-pointer pr-8', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputCls, 'resize-y', className)} {...props} />
}

const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed'

export function BtnPrimary({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        btnBase,
        'bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-600/30 hover:from-brand-400 hover:to-brand-500 disabled:opacity-50 disabled:shadow-none',
        className,
      )}
      {...props}
    />
  )
}

export function BtnGhost({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        btnBase,
        'border border-ink-700 bg-ink-900/40 text-slate-200 hover:border-brand-500/50 hover:text-white disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export function BtnDanger({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        btnBase,
        'border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:border-rose-500/70 hover:bg-rose-500/20 hover:text-rose-200 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('h-4 w-4 animate-spin text-current', className)}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

const noticeTones = {
  green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  red: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  slate: 'border-ink-700 bg-ink-900/70 text-slate-300',
}

const noticeIcons = {
  green: CheckIcon,
  amber: AlertIcon,
  red: XIcon,
  slate: InfoIcon,
}

export function Notice({
  tone = 'slate',
  children,
  className,
}: {
  tone?: keyof typeof noticeTones
  children: ReactNode
  className?: string
}) {
  const Icon = noticeIcons[tone]
  return (
    <div className={cn('flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs', noticeTones[tone], className)}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0 break-words leading-relaxed">{children}</div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-700 bg-ink-900/30 px-6 py-10 text-center">
      {icon && (
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-ink-700/70 bg-ink-800/80 text-slate-500">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}