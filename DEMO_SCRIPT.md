# TrustVault — 3–5 Minute Demo Script

Tagline: **Verify once. Control access everywhere.**

This is the exact demo flow: login → encrypted upload → verifier request →
ALLOW → simulated attack → trust collapse → STEP_UP/BLOCK → revocation →
anchored audit trail.

## Prerequisite

Backend up with seeded users (local, all free):

```powershell
cd backend
.\.venv\Scripts\python.exe scripts\reset_db.py --yes
$env:RATE_LIMIT_MAX = "500"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

Optional but recommended for the full picture: `docker compose up -d`
(free local Postgres) and switch `DATABASE_URL` in `backend/.env`.

## The script (read while the screen is on)

### 1. Login — passkeys, issued once (0:00–0:30)

Four seeded demo identities log in: **admin@**, **issuer@**, **holder@**,
**verifier@trustvault.example**. The API never sees a password — the browser
completes a WebAuthn ceremony (dev fallback for the demo) and exchanges a
short-lived JWT.

> Say it: *"The institution verified the holder once. Every later access is
> governed by policy + live trust, not by a stored credential."*

### 2. Issue a credential (hash-only) (0:30–1:00)

The issuer emits an education credential for the holder. On-chain you see
**only the SHA-256 hash and the signed status record** — never the document.

### 3. Encrypted upload — prove possession (1:00–1:30)

The holder uploads a document. The backend:

1. AES-256-GCM encrypts it → ciphertext written to local `storage/`,
2. records the SHA-256 integrity hash + `AssetRegistry` anchor,
3. shows the proof metadata in the dashboard (`file_hash`, anchor status).

### 4. Purpose-scoped, time-bound access (1:30–2:00)

The verifier requests access for purpose `employment`. The holder approves a
**30-minute** grant constrained to that purpose. The verifier downloads and the
response round-trips byte-for-byte to the original plaintext.

Trust panel: `ALLOW`, `trust=96`, reasons `[OK_CREDENTIAL, KNOWN_DEVICE, ...]`.

### 5. Attack — watch trust collapse (2:00–3:30)

Run `scripts/attack_sim.py` (or trigger from the timeline UI). A forged session
replay + request-storm + auth-failure burst impersonates the verifier:

- Trust drops **96 → 71**, decision flips **ALLOW → STEP_UP**
  (`REQUEST_VELOCITY_HIGH`, identity penalty).
- A second burst blocks outright (`REQUEST_VELOCITY_EXCESSIVE`).
- The security-event timeline shows the exact moment, reason codes, and score.

> Say it: *"The blockchain proves what happened; the Trust Engine decides what
> happens next. The attack is visible, explainable, and reversible."*

### 6. Instant revocation (3:30–4:00)

The issuer revokes the verifier's credential. The holder's next download is
hard-blocked with `CREDENTIAL_REVOKED` — revocation propagates immediately,
on-chain and off-chain.

### 7. Audit trail with a real transaction (4:00–4:30)

The audit panel lists every high-value event (`asset_created`,
`access_allowed`, `access_blocked`, admin override) with its **anchor status
and transaction hash** on Sepolia. With `RPC_URL` + `PRIVATE_KEY` configured
(pending anchors promote to real txs at startup), paste the tx hash into a
block explorer.

> Say it: *"Every decision is explainable, every high-value event is anchored.
> No raw data ever touches the chain."*

## Reset between runs

```powershell
.\.venv\Scripts\python.exe scripts\reset_db.py --yes   # then restart the API
```

## What the judges must see

| Beat | Where |
|------|-------|
| ALLOW → STEP_UP → BLOCK under attack | `backend/scripts/attack_sim.py` |
| Trust score + reason codes | `/trust/{user_id}` or the Trust panel |
| Real testnet tx hash | `GET /audit/{asset_id}` anchor rows |
| Encrypted round-trip | `scripts/demo.py` stage 5 |

## Going live on Sepolia (if network is up)

`cd contracts`; set `RPC_URL`/`PRIVATE_KEY` in `contracts/.env`;
`npx hardhat run scripts/deploy.ts --network sepolia`; paste the four printed
addresses into `backend/.env`. Pending anchors then confirm on-chain.