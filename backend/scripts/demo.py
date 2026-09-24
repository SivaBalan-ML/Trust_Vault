"""TrustVault demo runbook — the 5-minute happy-path story.

Requires backend running with seeded users:

    cd backend
    $env:RATE_LIMIT_MAX = "500"
    .\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --port 8000

Then:  .\\.venv\\Scripts\\python.exe scripts\\demo.py

Prints a stage-by-stage narrative. Exit code 0 when every stage succeeds;
non-zero on the first failure (a demo shouldn't silently limp on).
"""
import sys
import time
import uuid

import httpx

BASE = "http://localhost:8000"


def step(client, method, path, token=None, ok_status=(200,), **kw):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    r = client.request(method, path, headers=headers, **kw)
    if r.status_code not in ok_status:
        print(f"   !! stage failed: {method} {path} -> {r.status_code} {r.text[:200]}")
        sys.exit(1)
    return r


def main():
    with httpx.Client(timeout=30.0, base_url=BASE) as c:
        print("=" * 66)
        print("  TrustVault - Verify once. Control access everywhere.")
        print("  A blockchain-anchored, privacy-preserving access control demo")
        print("=" * 66)

        # 1. Login as the four seeded roles (WebAuthn replaced by dev fallback
        #    so the demo runs without an authenticator).
        tk_issuer = step(c, "POST", "/auth/login/dev",
                         json={"email": "issuer@trustvault.example"}).json()["access_token"]
        holder = step(c, "POST", "/auth/login/dev",
                      json={"email": "holder@trustvault.example"}).json()
        verifier = step(c, "POST", "/auth/login/dev",
                        json={"email": "verifier@trustvault.example"}).json()
        tk_holder = holder["access_token"]
        tk_verifier = verifier["access_token"]
        step(c, "POST", "/auth/login/dev", json={"email": "admin@trustvault.example"})
        holder_user, verifier_user = holder["user"], verifier["user"]

        print("\n[1] Institution issues credentials (hash-only, never raw docs)")
        cred = step(c, "POST", "/credentials/issue", token=tk_issuer, json={
            "holder_email": "holder@trustvault.example",
            "type": "education",
            "document": {"institution": "Demo University", "degree": "B.Sc. CompSci"},
        }).json()
        step(c, "POST", "/credentials/issue", token=tk_issuer, json={
            "holder_email": "verifier@trustvault.example",
            "type": "organisation",
            "document": {"institution": "Demo University", "role": "employer"},
        })
        print(f"    issued {cred['hash'][:16]}... (holder) + verifier org credential, "
              f"status={cred['status']}")

        print("\n[2] Alice uploads an encrypted document (proving possession)")
        plaintext = b"Employment verification request " + uuid.uuid4().bytes
        asset = step(c, "POST", "/assets", token=tk_holder, ok_status=(200,),
                     files={"file": ("resume-proof.pdf", plaintext, "application/pdf")}).json()
        print(f"    asset {asset['id'][:8]}... sha256={asset['file_hash'][:16]}... "
              f"ciphertext only on disk")

        print("\n[3] Alice scopes a purpose and a minimum trust level")
        step(c, "POST", f"/assets/{asset['id']}/policy", token=tk_holder, ok_status=(200,),
             json={"requester_role": "verifier", "purpose": "employment", "min_trust": 60})
        print("    policy: verifier role, purpose=employment, min_trust=60")

        print("\n[4] Employer requests access; Alice grants a time-bound token")
        req = step(c, "POST", "/access/request", token=tk_verifier, ok_status=(200,),
                   json={"asset_id": asset["id"], "purpose": "employment"}).json()
        grant = step(c, "POST", f"/access/{req['id']}/approve", token=tk_holder,
                     json={"decision": "approve", "duration_minutes": 30}).json()
        print(f"    grant {grant['id'][:8]}... purpose={grant['purpose']} "
              f"expires={grant['expires_at'][:19]}")

        print("\n[5] Employer downloads the decrypted document")
        r = step(c, "GET", f"/assets/{asset['id']}/content", token=tk_verifier)
        assert r.content == plaintext
        print(f"    served {len(r.content)} bytes == original plaintext  ")

        print("\n[6] Trust engine explains every decision")
        trust = step(c, "GET", f"/trust/{verifier_user['id']}", token=tk_verifier).json()
        print(f"    trust={trust['trust_score']} decision={trust['decision']} "
              f"reasons={trust['reasons']}")
        time.sleep(0.2)

        print("\n[7] Every high-value event is blockchain-anchored")
        rows = step(c, "GET", f"/audit/{asset['id']}", token=tk_holder).json()
        for row in rows:
            anchor = row.get("anchor")
            if anchor:
                print(f"    - {row['event_type']:<16} {anchor['chain']} "
                      f"[{anchor['status']}] {anchor['tx_hash'][:18]}")
        print("\n  Run scripts/attack_sim.py to see the attack story:")
        print("  trust collapse -> step-up -> admin override -> revocation.")
        print("DEMO COMPLETE")


if __name__ == "__main__":
    main()