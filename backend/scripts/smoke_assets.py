"""Stage 3 smoke test: upload -> hash -> encrypt -> store -> download -> verify."""
import hashlib
import httpx
import io
import uuid

BASE = "http://localhost:8000"


def main():
    with httpx.Client(timeout=15.0) as client:
        # 1. Login as holder (dev fallback for demo/testing)
        tok = client.post(
            f"{BASE}/auth/login/dev", json={"email": "holder@trustvault.example"}
        ).json()["access_token"]
        h = {"Authorization": f"Bearer {tok}"}

        # 2. Upload a plaintext file with a known SHA-256
        plaintext = b"SECRET DEGREE CERTIFICATE FOR TEST USER " + uuid.uuid4().bytes
        expected_hash = hashlib.sha256(plaintext).hexdigest()
        files = {"file": ("diploma.pdf", io.BytesIO(plaintext), "application/pdf")}
        r = client.post(f"{BASE}/assets", headers=h, files=files)
        r.raise_for_status()
        asset = r.json()
        assert asset["file_hash"] == expected_hash, f"hash mismatch: {asset['file_hash']}"
        print("upload OK, id:", asset["id"], "hash:", asset["file_hash"][:16] + "...")

        # 3. Ciphertext on disk must not equal plaintext
        on_disk = open(f"storage/{asset['encrypted_uri']}", "rb").read()
        assert plaintext not in on_disk, "plaintext leaked into encrypted file!"
        print("ciphertext verified: plaintext NOT present on disk")

        # 4. Download content and verify round-trip decryption
        r2 = client.get(f"{BASE}/assets/{asset['id']}/content", headers=h)
        r2.raise_for_status()
        assert r2.content == plaintext, "decrypted content does not match original"
        print("round-trip decryption OK, bytes:", len(r2.content))

        # 5. Unauthenticated download should be rejected
        r3 = client.get(f"{BASE}/assets/{asset['id']}/content")
        assert r3.status_code == 401, f"expected 401, got {r3.status_code}"
        print("unauthenticated download rejected OK")

    print("STAGE 3 SMOKE: PASS")


if __name__ == "__main__":
    main()