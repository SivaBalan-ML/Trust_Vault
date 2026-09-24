// TrustVault typed API client.
const BASE = '/api'

export class ApiError extends Error {
  status: number
  detail: unknown
  constructor(status: number, detail: unknown) {
    super(typeof detail === 'string' ? detail : JSON.stringify(detail))
    this.status = status
    this.detail = detail
  }
}

let token: string | null = localStorage.getItem('trustvault_token')
let currentUser: any = null

export function setAuth(t: string | null, user?: any) {
  token = t
  currentUser = user ?? null
  if (t) localStorage.setItem('trustvault_token', t)
  else localStorage.removeItem('trustvault_token')
}

export function getToken() {
  return token
}

export function getCurrentUser() {
  return currentUser
}

async function request<T>(method: string, path: string, body?: any, isForm?: boolean): Promise<T> {
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body && !isForm) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isForm ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let detail: unknown = res.statusText
    try {
      const j = await res.json()
      detail = j.detail ?? j
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: any) => request<T>('POST', path, body),
  upload: <T>(path: string, form: FormData) => request<T>('POST', path, form, true),
  download: async (path: string) => {
    const res = await fetch(`${BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      let detail: unknown = res.statusText
      try {
        const j = await res.json()
        detail = j.detail ?? j
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, detail)
    }
    return res.blob()
  },
}

// ---- Auth ----
export const authApi = {
  devLogin: (email: string) =>
    api.post<{ access_token: string; user: any }>('/auth/login/dev', { email }),
  me: () => api.get<any>('/auth/me'),
}

// ---- Credentials ----
export type Credential = {
  id: string
  type: string
  hash: string
  status: string
  issuer_id: string
  holder_id: string
  issued_at: string
  revoked_at: string | null
}

// ---- Assets ----
export type Asset = {
  id: string
  owner_id: string
  name: string
  encrypted_uri: string
  file_hash: string
  cid: string | null
  created_at: string
}

// ---- Access ----
export type AccessRequest = {
  id: string
  asset_id: string
  requester_id: string
  purpose: string
  status: string
  created_at: string
}

// ---- Trust ----
export type TrustState = {
  user_id: string
  trust_score: number
  decision: 'ALLOW' | 'STEP_UP' | 'BLOCK'
  reasons: string[]
  model_version: string
  timestamp: string
  components: Record<string, number>
  ml_signal: number | null
}

// ---- Timeline ----
export type SecurityEvent = {
  id: string
  user_id: string | null
  event_type: string
  risk_signals: Record<string, any>
  trust_score: number | null
  decision: string | null
  created_at: string
}