# TRUSTVAULT — Build Prompt for opencode

Copy everything from `## PROJECT BRIEF` down into opencode as your first message. It is written as a complete spec so the agent can scaffold, implement, and iterate without needing the source PDF.

---

## PROJECT BRIEF

You are building **TRUSTVAULT** — a blockchain-backed, privacy-preserving identity and access-control platform, built as a working hackathon MVP. Tagline: "Verify once. Control access everywhere."

Core principle: **the blockchain proves what was recorded; the Trust Engine decides whether the current request satisfies policy.** Blockchain never stores raw documents — only hashes, ownership references, and audit events.

### Non-negotiable constraint: everything must be free of cost
Only use tools, libraries, and services with a permanent free tier or that are fully open-source / self-hosted, with no paid upgrade required to finish this build:
- **No paid APIs, no paid cloud databases, no paid RPC beyond free tiers, no paid auth providers.**
- Database: **PostgreSQL running locally in Docker** (or SQLite for local dev) — not a paid managed DB. If a hosted Postgres is wanted later, use a free tier (e.g. Neon or Supabase free plan), but default to local Docker Postgres for the build.
- Blockchain: deploy to a **free public testnet** (Sepolia) using a **free-tier RPC provider** (Alchemy or Infura free plan, or a public RPC endpoint) and **free testnet ETH from a faucet**. Never use mainnet.
- Object storage: **local encrypted filesystem storage** for the MVP (a `storage/` directory), not a paid S3 bucket. Structure the code so it *could* swap to IPFS or S3 later, but don't require a paid account now.
- Auth: **WebAuthn/passkeys** using browser-native APIs (free, no third-party service) plus JWT sessions.
- ML: **scikit-learn Isolation Forest**, runs locally, no paid ML API.
- Hosting for the demo: run everything locally (`localhost`); if deployment is needed, use free tiers only (e.g. Vercel/Netlify free tier for frontend, Render/Railway free tier for backend — call this out as optional, not required).

If at any point you (opencode) are about to introduce a paid dependency, stop and propose a free alternative instead.

---

## TECH STACK

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | FastAPI (Python) |
| Database | PostgreSQL (Docker Compose for local dev) via SQLAlchemy + Alembic migrations |
| Auth | WebAuthn/passkeys (`webauthn` / `py_webauthn` on backend, `@simplewebauthn/browser` on frontend) + short-lived JWT sessions |
| Blockchain | Solidity + OpenZeppelin + Hardhat, deployed to Sepolia testnet |
| Chain interaction (backend) | `web3.py` or `ethers.js` via a small Node service, whichever is simpler to integrate with FastAPI |
| Encryption | AES-256-GCM for files, SHA-256 for integrity hashes |
| ML | scikit-learn Isolation Forest (optional layer, off by default, toggleable) |
| Dev environment | Docker Compose for Postgres + backend + frontend |

---

## SYSTEM ARCHITECTURE

```
React + TS + Vite + Tailwind (frontend)
        │
FastAPI + JWT/session + WebAuthn (auth + API gateway)
        │
   ┌────┼─────────────┬───────────────┐
Identity          Trust Engine    Policy Engine
(DID/VC-lite)   (rules + optional ML)  (RBAC + ABAC)
        │
PostgreSQL (users, credentials, assets, policies, grants, devices, security_events, audit_anchors)
        │
   ┌────┴──────────────┐
Encrypted local storage   Audit anchoring queue
        │
Solidity smart contracts (IdentityRegistry, AssetRegistry, AccessControl, AuditRegistry)
        │
Sepolia testnet (via free RPC)
```

Event tiering rule: only high-value events (credential issuance/revocation, asset creation, final access decisions) get anchored on-chain. All other telemetry stays in PostgreSQL.

---

## DATA MODEL (PostgreSQL)

Implement these tables (adjust types as needed, use UUID primary keys):

- **users**: id, did, role, status, created_at
- **credentials**: id, issuer_id, holder_id, type, hash, status, issued_at, revoked_at
- **assets**: id, owner_id, encrypted_uri, file_hash, cid (nullable for now), created_at
- **access_policies**: id, asset_id, requester_role, purpose, expires_at, min_trust
- **access_grants**: id, asset_id, requester_id, purpose, granted_at, expires_at
- **devices**: id, user_id, device_key_id, first_seen, last_seen, status
- **security_events**: id, user_id, event_type, risk_signals (JSONB), trust_score, decision, created_at
- **audit_anchors**: id, event_id, tx_hash, chain, anchored_at

Keep the schema minimal. Do not store unnecessary raw personal data.

---

## API SURFACE (FastAPI)

Implement these endpoints, each with proper server-side authorization (never rely on hiding UI elements):

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/register` | Create account/identity record |
| POST | `/auth/login` | Authenticate (passkey + session issuance) |
| POST | `/credentials/issue` | Issuer creates a credential |
| GET | `/credentials/{id}/verify` | Verify a credential's status |
| POST | `/assets` | Encrypt + store + hash an asset |
| POST | `/access/request` | Requester asks for access |
| POST | `/access/{id}/approve` | Owner grants scoped access |
| POST | `/access/{id}/deny` | Owner rejects request |
| GET | `/trust/{user_id}` | Return current explainable trust state |
| POST | `/security/events` | Record security telemetry |
| POST | `/credentials/{id}/revoke` | Revoke a credential |
| GET | `/audit/{asset_id}` | Show audit history for an asset |

---

## TRUST ENGINE (V1 — rules-based, explainable)

Weighted factors:
- Identity — 30%
- Device — 20%
- Behaviour — 20%
- Context — 15%
- History — 15%

Thresholds map to three outcomes: **ALLOW**, **STEP_UP**, **BLOCK**.

Every decision must produce a machine-readable, auditable object, e.g.:

```json
{
  "trust_score": 62,
  "decision": "STEP_UP",
  "reasons": ["NEW_DEVICE", "REQUEST_VELOCITY_HIGH"],
  "policy_id": "EMPLOYMENT_VERIFY_V1",
  "timestamp": "...",
  "model_version": "rules-v1"
}
```

Add the Isolation Forest anomaly signal as an **optional additional input** to context/behaviour scoring — never let it independently override a hard policy rule (revocation, expiry, explicit deny are always authoritative).

Suggested ML features (if/when you build this layer): requests per minute, unique assets accessed, time since last login, failed authentication count, device novelty, sequence deviation, historical access frequency.

---

## ACCESS CONTROL PIPELINE (RBAC + ABAC)

For every access request, evaluate in this order:
1. Is the identity authenticated?
2. Is the credential valid and not revoked?
3. Does the role have the requested permission?
4. Does the asset policy permit this purpose?
5. Is the grant inside its validity window?
6. Does the current trust score satisfy the policy's minimum threshold?
7. If not, can step-up authentication satisfy the required assurance?
8. Record the final decision and reason codes.

Test scenarios the implementation must handle correctly:
- Valid credential + authorized role + normal context → ALLOW
- Valid credential + new device → STEP_UP
- Valid credential + expired grant → DENY
- Revoked credential → DENY
- Authorized role but wrong purpose → DENY
- Suspicious velocity but otherwise valid → STEP_UP or DENY per policy
- Admin override → ALLOW only with an explicit privileged audit trail entry

---

## SMART CONTRACTS (Solidity + Hardhat, Sepolia testnet)

Build exactly four contracts, kept minimal (do not build a custom chain, custom crypto primitives, on-chain ML, or a large contract framework):

1. **IdentityRegistry** — approved issuer registry + credential status/revocation
2. **AssetRegistry** — asset ID + owner/DID hash + file hash + (future) CID
3. **AccessControl** — permission + expiry + purpose + minimum trust threshold reference (keep actual policy evaluation off-chain; this contract just anchors the outcome)
4. **AuditRegistry** — anchors important security/access events

Use OpenZeppelin contracts where applicable. Write Hardhat tests for each contract. Never put raw PDFs, personal profiles, device telemetry, passwords, secrets, or full location history on-chain.

Deployment: use Hardhat's Sepolia network config with a free-tier Alchemy/Infura RPC URL (stored in `.env`, never committed) and free Sepolia faucet ETH.

---

## IDENTITY / CREDENTIAL FLOW (MVP)

Implement this exact issuer → holder → verifier flow:
1. Institution logs in and is recognized as an approved issuer.
2. Institution issues a sample credential (e.g. education/certification).
3. User (holder) receives/stores the credential and sees its status.
4. Verifier requests a specific claim/credential verification.
5. User grants a purpose- and time-bound permission.
6. Verifier receives a verification result (not the raw document).
7. Revocation immediately causes later verification to fail.

Do not attempt full zero-knowledge selective disclosure in the MVP — if you scaffold a "selective disclosure" UI, be honest in the UI copy that it's a conceptual/future-scope demonstration, not real ZK cryptography, unless you actually implement it.

---

## SECURITY REQUIREMENTS

- WebAuthn/passkeys as the strong-auth path; short-lived JWTs/sessions for ordinary API calls.
- Rate limiting on all auth and access endpoints.
- Server-side authorization enforced on every endpoint — never trust the frontend.
- AES-256-GCM for file encryption; SHA-256 for integrity hashes; document nonce handling and key separation.
- Threat model the app: assets, actors, trust boundaries, attack paths, mitigations (write this as a markdown doc in the repo).
- Build attack-simulation hooks/scripts for: credential theft, session replay, abnormal request burst, revoked-credential use — these should be triggerable from a small CLI/script or admin UI so the security teammate can demo them live.
- Add a security event timeline/dashboard view in the frontend (attack visible → trust score visibly drops → STEP_UP/BLOCK visibly triggered).

---

## BUILD ORDER (map this to your own pace, not literal days)

1. Repo scaffold: monorepo with `/frontend`, `/backend`, `/contracts`, `docker-compose.yml` for Postgres.
2. Auth (registration/login), users, roles, base asset model.
3. Encrypted upload pipeline: AES-GCM encrypt → SHA-256 hash → store locally → return proof metadata.
4. RBAC + ABAC policy engine and scoped access grants.
5. Trust Engine v1 (rules-based) + security event timeline in the UI.
6. Smart contracts + Sepolia testnet integration + anchoring of high-value events.
7. Attack simulation scripts, polish, demo script, README with setup instructions.

Cut-order if scope needs trimming (cut from the top first, never cut the items below the line):
- Selective disclosure UI → ML anomaly signal → local IPFS-style storage abstraction → advanced DID interoperability → extra smart contracts.
- **Never cut**: core authorization, encryption, revocation, auditability, or the attack-response demonstration.

---

## DELIVERABLES YOU (opencode) SHOULD PRODUCE

1. A working monorepo with clear `README.md` covering: prerequisites (all free/open-source), `docker-compose up` instructions, how to get free Sepolia RPC + faucet funds, environment variable setup (`.env.example`), and how to run the demo script end-to-end.
2. Backend (FastAPI) with the data model, API surface, Trust Engine, and access-control pipeline above, plus tests for the access-control scenarios listed.
3. Frontend (React+TS+Vite+Tailwind) covering: login/passkey flow, issuer credential issuance, holder credential view, verifier request flow, access approve/deny, trust score + reason-code display, and a security event timeline.
4. Solidity contracts + Hardhat tests + a deploy script targeting Sepolia via a free RPC.
5. A short `THREAT_MODEL.md` and a `DEMO_SCRIPT.md` mirroring the 3–5 minute demo flow: login → encrypted upload/proof → verifier request → normal access (ALLOW) → simulated attack → trust score drop → STEP_UP/BLOCK → revocation causing verification failure → audit trail with a real testnet transaction hash.

Ask me before introducing any dependency that isn't clearly free/open-source. Otherwise, proceed step by step, showing me the plan for each build-order stage before writing large amounts of code, and pause for review after each major stage (auth, encryption, policy engine, trust engine, contracts, frontend integration).
