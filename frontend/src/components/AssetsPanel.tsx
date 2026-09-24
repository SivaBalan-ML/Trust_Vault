import { useEffect, useRef, useState } from 'react'
import { api, getCurrentUser, type Asset } from '../api'
import { Badge, EmptyState, Field, Notice, Panel, BtnGhost, BtnPrimary, Input, Select, Spinner, cn } from './ui'
import { ArrowDownIcon, FileTextIcon, FolderLockIcon, LockIcon, UploadIcon } from './icons'

function PipelineResult({ body }: { body: any }) {
  const d = body?.detail
  if (!d) return null
  const tone = d.decision === 'ALLOW' ? 'green' : d.decision === 'STEP_UP' ? 'amber' : 'red'
  const banner = {
    green: 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 text-emerald-200',
    amber: 'border-amber-500/30 bg-gradient-to-br from-amber-500/15 to-amber-500/5 text-amber-200',
    red: 'border-rose-500/30 bg-gradient-to-br from-rose-500/15 to-rose-500/5 text-rose-200',
  }[tone]
  return (
    <div className={cn('mt-5 rounded-xl border p-4', banner)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest">Access pipeline</span>
        <Badge tone={tone}>{d.decision}</Badge>
        <span className="ml-auto font-mono text-xs text-slate-400">trust {d.trust_score}</span>
      </div>
      <p className="mt-2 font-mono text-xs text-slate-300">{d.reasons?.join(' · ') ?? 'OK'}</p>
    </div>
  )
}

export default function AssetsPanel({ onPipeline }: { onPipeline: (r: any) => void }) {
  const user = getCurrentUser()
  const [assets, setAssets] = useState<Asset[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [policy, setPolicy] = useState<{ asset_id: string; role: string; purpose: string; min_trust: string }>({
    asset_id: '',
    role: 'verifier',
    purpose: 'employment',
    min_trust: '50',
  })
  const [msg, setMsg] = useState<NoticeState | null>(null)
  const [pipeline, setPipeline] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function refresh() {
    setAssets(await api.get<Asset[]>('/assets'))
  }
  useEffect(() => {
    refresh().catch(() => {})
  }, [])

  async function upload() {
    if (!file) return
    setMsg(null)
    setBusy(true)
    const form = new FormData()
    form.append('file', file)
    try {
      const a = await api.upload<Asset>('/assets', form)
      setMsg({ tone: 'green', text: `Uploaded ${a.name} — SHA-256 ${a.file_hash.slice(0, 16)}… (encrypted at ${a.encrypted_uri})` })
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      await refresh()
    } catch (e: any) {
      setMsg({ tone: 'red', text: `Upload failed: ${e.message}` })
    } finally {
      setBusy(false)
    }
  }

  async function addPolicy() {
    setMsg(null)
    try {
      await api.post(`/assets/${policy.asset_id}/policy`, {
        requester_role: policy.role,
        purpose: policy.purpose,
        min_trust: Number(policy.min_trust),
        expires_at: null,
      })
      setMsg({ tone: 'green', text: `Policy added: role=${policy.role} · purpose=${policy.purpose} · min_trust=${policy.min_trust}` })
    } catch (e: any) {
      setMsg({ tone: 'red', text: `Policy failed: ${e.message}` })
    }
  }

  async function download(id: string) {
    setMsg(null)
    setPipeline(null)
    try {
      const blob = await api.download(`/assets/${id}/content`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `decrypted-${id.slice(0, 8)}.bin`
      a.click()
      setMsg({ tone: 'green', text: 'Access ALLOWED — decrypted plaintext downloaded (AES-256-GCM round trip).' })
      onPipeline({ status: 'ok', decision: 'ALLOW' })
    } catch (e: any) {
      const r = { status: 'denied', detail: e?.detail }
      setPipeline(r)
      onPipeline(e?.detail)
      const detail = e?.detail
      const decision = typeof detail === 'object' ? detail?.decision : undefined
      setMsg({
        tone: 'red',
        text: decision
          ? `Access ${decision} (trust ${detail?.trust_score}) — ${detail?.reasons?.join(', ')}`
          : `Access denied: ${e.message ?? ''}`,
      })
    }
  }

  const owners = assets

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Panel
        title="Encrypted upload"
        subtitle="AES-256-GCM encrypt → SHA-256 hash → local storage → proof metadata"
        icon={<UploadIcon className="h-5 w-5" />}
      >
        <div className="space-y-3.5">
          <label
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center transition',
              dragging || file
                ? 'border-brand-500/70 bg-brand-500/10'
                : 'border-ink-600 bg-ink-950/40 hover:border-brand-500/50 hover:bg-brand-500/5',
            )}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0])
            }}
          >
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-brand-500/30 bg-brand-500/10 text-brand-300">
              <UploadIcon className="h-6 w-6" />
            </div>
            {file ? (
              <>
                <span className="max-w-full truncate text-sm font-medium text-slate-200">{file.name}</span>
                <span className="text-[11px] text-slate-500">{(file.size / 1024).toFixed(1)} KB · drop another file to replace</span>
              </>
            ) : (
              <>
                <span className="text-sm font-medium text-slate-200">Drop a file here or click to browse</span>
                <span className="text-[11px] text-slate-500">
                  Encrypted client-side before the SHA-256 hash is stored
                </span>
              </>
            )}
          </label>

          <BtnPrimary className="w-full" onClick={upload} disabled={!file || busy}>
            {busy && <Spinner />}
            {busy ? 'Encrypting…' : 'Encrypt + store'}
          </BtnPrimary>
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        </div>
      </Panel>

      <Panel
        title="Access policy (ABAC)"
        subtitle="Owner defines role + purpose + minimum trust for a policy"
        icon={<FolderLockIcon className="h-5 w-5" />}
      >
        <div className="space-y-3.5">
          <Field label="Asset" hint="which document the policy covers">
            <Select value={policy.asset_id} onChange={(e) => setPolicy({ ...policy, asset_id: e.target.value })}>
              <option value="">Select asset…</option>
              {owners.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.id.slice(0, 8)}…)
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Role">
              <Select value={policy.role} onChange={(e) => setPolicy({ ...policy, role: e.target.value })}>
                <option value="verifier">verifier</option>
                <option value="issuer">issuer</option>
                <option value="holder">holder</option>
              </Select>
            </Field>
            <Field label="Purpose">
              <Input value={policy.purpose} onChange={(e) => setPolicy({ ...policy, purpose: e.target.value })} placeholder="employment" />
            </Field>
            <Field label="Min trust">
              <Input
                type="number"
                min={0}
                max={100}
                value={policy.min_trust}
                onChange={(e) => setPolicy({ ...policy, min_trust: e.target.value })}
              />
            </Field>
          </div>
          <BtnPrimary className="w-full" onClick={addPolicy} disabled={!policy.asset_id}>
            Add policy
          </BtnPrimary>
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        </div>
      </Panel>

      <div className="lg:col-span-2">
        <Panel
          title="Assets"
          subtitle="Click evaluate to run the full access-control pipeline on the content endpoint"
          icon={<LockIcon className="h-5 w-5" />}
        >
          {owners.length === 0 ? (
            <EmptyState
              icon={<FileTextIcon className="h-5 w-5" />}
              title="No assets yet"
              hint="Upload a file to see it encrypted, hashed and tracked — then define a policy and evaluate controlled access."
            />
          ) : (
            <div className="space-y-3">
              {owners.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-800 bg-ink-950/40 p-4 transition hover:border-ink-700"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-700 bg-ink-800/70 text-brand-300">
                      <FileTextIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-200">{a.name}</span>
                        {a.owner_id === user?.id && <Badge tone="slate">mine</Badge>}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[10px] text-slate-600">
                        <span title={a.file_hash}>sha256 {a.file_hash.slice(0, 26)}…</span>
                        <span>{a.encrypted_uri}</span>
                        <span>cid {a.cid ?? 'none (local storage MVP)'}</span>
                      </div>
                    </div>
                  </div>
                  <BtnGhost className="shrink-0 !px-3 !py-1.5 text-xs" onClick={() => download(a.id)}>
                    <ArrowDownIcon className="h-3.5 w-3.5" />
                    Evaluate access
                  </BtnGhost>
                </div>
              ))}
            </div>
          )}
          {pipeline && <PipelineResult body={pipeline} />}
        </Panel>
      </div>
    </div>
  )
}

type NoticeState = { tone: 'green' | 'red' | 'amber' | 'slate'; text: string }