# TrustVault Threat Model

Scope: the MVP as built (FastAPI + SQLite/local storage, React SPA, Solidity
registries on Sepolia). Written to answer "what is the attacker after, where
are the trust boundaries, and which control addresses it."

## Assets of value

| Asset | Where it lives | Confidentiality | Integrity | Availability |
|---|---|---|---|---|
| Holder document plaintext | Decrypted only in the API process during a download | Critical | Critical | Low |
| Holder document ciphertext | Local `storage/` directory | High (key elsewhere) | High (hash verified) | Low |
| Asset/credential hashes | Local DB + blockchain | Public by design | Critical (on-chain) | High (immutable) |
| Credential status (active/revoked) | Local DB + `IdentityRegistry` | Public | Critical | High |
| Access decisions | Local DB + `AccessControl` | Public | Critical | High |
| Audit trail | Local DB + `AuditRegistry` | Public | High | Medium |
| JWT + session state | Browser + API memory | High | High | Medium |
| AES encryption key / chain signing key | `backend/.env` | Critical | Critical | - |

## Trust boundaries

1. **Browser <-> API**: WebAuthn ceremony + JWT bearer auth; TLS assumed in
   prod (dev is localhost).
2. **API <-> storage**: ciphertext only; API holds the envelope key.
3. **API <-> chain**: unsigned reads; signing only by the configured operator
   wallet (`backend/.env`).
4. **Local DB**: every authenticated user is an in-app identity; DB file is
   only reachable by the operator.

## Attack / defense matrix

| # | Threat | Likelihood → Impact | Defense in TrustVault |
|---|---|---|---|
| 1 | Forged / tampered JWT | Med → High | `python-jose` HS256 verify before any route logic; short expiry (15 min); per-token session in `SessionStore` keyed by `jti` |
| 2 | IDOR / horizontal escalation (reach another user's asset) | High → High | `GET /assets/{id}/content` runs the full pipeline: role+policy+purpose+grant+trust; asset ownership check separate; no owner bypass (owner needs a grant too, or the audited override) |
| 3 | Credential theft + replay on a new device | Med → High | Trust Engine: `NEW_DEVICE` reason forces STEP_UP (>40 rpm not required); WebAuthn sign-count checks; anomalous auth failures rebuild identity score down |
| 4 | Brute-force / scraping burst | High → Med | Rate limiting (60/min default) + `RATE_LIMIT_MAX` env; `REQUEST_VELOCITY_HIGH` → STEP_UP, `REQUEST_VELOCITY_EXCESSIVE` (≥120/min) → BLOCK regardless of score |
| 5 | Revoked credential still honored | Low → Critical | Revocation flips status instantly; hard block `CREDENTIAL_REVOKED` is authoritative over any trust score; credential, device and grant expiry all short-circuit |
| 6 | Purpose escalation (borrowing a grant for another purpose) | Med → High | Every grant carries a purpose; pipeline rejects `WRONG_PURPOSE`; the audit events record the purpose per decision |
| 7 | Admin override abuse | Low → Critical | Override requires `role == admin` AND the header; a non-admin attempt still BLOCKs; every override yields a `privileged: true` anchored audit row (non-repudiation) |
| 8 | Stolen encryption key or storage disk theft | Low → Critical | AES-256-GCM ciphertext blob ≠ plaintext (verified in smoke test); key isolated in `.env`/env var, never in the blob; per-asset salt/layout `12B nonce ‖ ciphertext` |
| 9 | Plaintext recovery via backup/decoy | Low → High | Storage is encrypted at write time; hash-of-plaintext recorded at upload so a tampered download fails round-trip |
| 10 | Audit-trace tampering | Low → High | High-value events get on-chain anchors (Sepolia); a pending anchor is promoted by `app/services/chain.py` when RPC+wallet configured; any tampering breaks hash consistency vs chain |
| 11 | Client-side re-encryption / withholding plaintext after revocation | High → Medium | Out of MVP scope — possession vs access: a holder who already decrypted keeps the bytes. Documented; mitigation is DLP/watermarking (future) |
| 12 | ML evasion (adversarial querying of anomaly layer) | Low → Medium | Isolation Forest is a *deepening signal*, never authoritative; rules still govern. Anomaly layer is off by default |
| 13 | RPC/provider spoofing or chain reorg | Low → Low | Anchors are integrity proofs, not authorization; even a reorg/replay cannot inflate a decision because the decision is made off-chain |
| 14 | Signing-key exfiltration (`.env`) | Low → Critical | The operator wallet signs only anchored hashes, not arbitrary instructions; revocation requires independent authorization |

## Deliberate design trade-offs

- **Blockchain never stores plaintext** — it stores hashes, owner references
  and audit events. Privacy follows from design, not obscurity.
- **Owner is not above the policy** — a data owner must also obtain a scoped
  grant or exercise the audited admin override. This keeps every access
  explainable.
- **One fail-closed rule wins** — hard policy failures (revocation, expiry,
  purpose, absence of grant/policy) always BLOCK regardless of a high trust
  score; the risk of denial-of-service for a corner case is accepted over a
  data breach.

## Residual risk (accepted for the hackathon MVP)

- In-memory session store (single instance; restart drops sessions).
- Local SQLite/disk storage (no replication; operator-grade HA is out of
  scope).
- No delegation/escrow recovery; a lost passkey = lost account (documented).
- No TLS configuration shipped (dev is localhost); production must front with
  TLS and proper secrets management.
- `POST /security/events` accepts attacker-supplied telemetry hooks — in a
  production system this endpoint must be internal-only or authenticated to
  an agent, not the browser. Kept for the attack-simulation story.