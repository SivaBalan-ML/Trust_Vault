# TrustVault

**Verify once. Control access everywhere.**

A blockchain-anchored, privacy-preserving identity and access-control
platform (hackathon MVP). Institutions issue verifiable credentials once;
holders keep their documents encrypted and private; verifiers get scoped,
time-bound, purpose-limited access that a **Trust Engine** continuously
re-evaluates as the holder's security context evolves.

## Core principle

> The blockchain proves *what* was recorded. The Trust Engine decides
> *whether* a request satisfies the policy right now.

- On-chain: credential status, asset integrity hashes, access decisions,
  high-value audit events. **Never raw documents, PII profiles, or secrets.**
- Off-chain: document ciphertext (local AES-256-GCM storage in the MVP),
  the RBAC+ABAC policy engine, and the explainable Trust Engine.

## Architecture

```
 Issuer ──issues──▶ WebAuthn credential ──▶ Blockchain (Sepolia)
   │                                        IdentityRegistry (revocation)
   │   SHA-256 only                         AssetRegistry (integrity hashes)
   ▼                                        AccessControl  (decision anchors)
 Holder ──uploads──▶ Encrypted storage       AuditRegistry  (event anchors)
   │   AES-256-GCM (ciphertext never on chain)        ▲
   ▼                                            anchors (dropdown)
 Verifier ──request──▶  Policy pipeline (8 steps)
   │                    1-4 RBAC/ABAC (role, purpose, grant, expiry)
   │                    5-7 Trust Engine (identity/device/behaviour/
   │                     context/history) -> ALLOW | STEP_UP | BLOCK
   └──▶ Decision ──▶ Audit event ──▶ on-chain anchor
```

Monorepo layout:

| Path        | What                                    |
|-------------|-----------------------------------------|
| `backend/`  | FastAPI + SQLAlchemy API, policy + trust engine, audit anchoring (web3.py) |
| `frontend/` | React 19 + Vite + Tailwind v4 dashboard |
| `contracts/`| Hardhat + Solidity 0.8.24 registry contracts |
| `docker-compose.yml` | Postgres 16 for when you want it |

## Quickstart (all free / open-source)

### 1. Backend

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe scripts\reset_db.py --yes     # seed 4 demo users
$env:RATE_LIMIT_MAX = "500"                               # room for the attack demo
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

Demo users (WebAuthn dev-fallback login):
`admin@`, `issuer@`, `holder@`, `verifier@trustvault.example`.

Postgres (optional, if Docker is running): `docker compose up -d` and switch
`DATABASE_URL` in `backend/.env`.

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev          # http://localhost:5173 (proxies /api -> :8000)
```

### 3. Contracts

```powershell
cd contracts
npm install
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy.ts --network localhost   # smoke deploy
```

### 4. Backend tests

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests -v          # 9 scenario tests
```

## Demo runbooks

| Script | Story |
|---|---|
| `DEMO_SCRIPT.md` | The 3–5 minute scripted demo: login -> upload -> grant -> ALLOW -> attack -> STEP_UP/BLOCK -> revocation -> anchored audit |
| `backend/scripts/demo.py` | Happy path: issue credentials -> upload encrypted doc -> scope purpose -> time-bound grant -> download -> trust score -> audit anchors |
| `backend/scripts/attack_sim.py` | Attack journey: forged JWT, IDOR, velocity/auth-failure storm collapses trust ALLOW->STEP_UP, admin override (audited), instant revocation |
| `backend/scripts/smoke_auth.py`, `smoke_assets.py` | Stage smoke checks (WebAuthn ceremony, encrypted round-trip) |

Reset between runs: `backend/scripts/reset_db.py --yes`, then restart the API.

## Trust Engine (v1, explainable)

Weighted, additive, fully explainable scores:

| Component (weight) | Signals |
|---|---|
| Identity (30%) | credential validity, recent auth failures |
| Device (20%) | known/active vs new/revoked |
| Behaviour (20%) | request velocity, access sequences |
| Context (15%) | unusual hour, geo penalty |
| History (15%) | recent anomaly decisions |

Score bands: **ALLOW ≥ 70**, **STEP_UP 40–69**, **BLOCK < 40**, with a rule
layer that forces STEP_UP on a new device, velocity bursts or detected
anomalies, and BLOCK on excessive bursts. Hard policy failures (revoked
credential/device, expired grant, wrong purpose/no policy) are always
authoritative over the numeric score. An optional Isolation Forest anomaly
layer (`ML_ANOMALY_ENABLED=true`) deepens but never overrides the rules.

## API surface

| Area | Endpoints |
|---|---|
| Auth | `/auth/register/start|complete`, `/auth/login/start|complete`, `/auth/login/dev`, `/auth/me`, `/auth/logout`, `/auth/devices` |
| Credentials | `POST /credentials/issue`, `GET /credentials?holder=me`, `GET /credentials/{id}/verify`, `POST /credentials/{id}/revoke` |
| Assets | `POST /assets`, `GET /assets`, `GET /assets/{id}/content`, `POST /assets/{id}/policy` |
| Access | `POST /access/request`, `GET /access`, `POST /access/{id}/approve|deny` |
| Trust & telemetry | `GET /trust/{user_id}`, `POST|GET /security/events` |
| Audit | `GET /audit/{asset_id}` (anchor status per event) |

Admin override: `X-TrustVault-Admin-Override: 1` forces ALLOW **only** for
the admin role and always writes a privileged, anchored audit entry.

## Going live on Sepolia

1. Get a free-tier RPC (e.g. Alchemy/Infura) + a funded Sepolia test wallet.
2. `cd contracts`; put `RPC_URL`, `PRIVATE_KEY` in `contracts/.env`.
3. `npx hardhat run scripts/deploy.ts --network sepolia`.
4. Paste the four printed addresses into `backend/.env`
   (`*_REGISTRY_ADDRESS` + `RPC_URL` + `PRIVATE_KEY`).
5. Restart the backend: pending anchor rows promote to real transactions at
   startup and on every boot (`app/services/chain.py`).

## Explicitly excluded from the MVP (documented scope)

- No paid services: local encrypted storage, SQLite (Postgres optional), free
  testnet RPC, WebAuthn/passkeys, JWT — all free tiers.
- `JSON Web Token` sessions are in-memory (single instance); swap a store for
  HA.
- No delegation/escrow, no cap-recovery workflows, no email/SMS OTP channels.
- Frontend authenticates via the WebAuthn browser library; the API only
  accepts the completed ceremony payloads.

## See also

- `THREAT_MODEL.md` — assets, trust boundaries, attack/defense matrix, and
  the rationale behind every control.