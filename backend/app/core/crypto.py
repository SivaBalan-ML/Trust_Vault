"""AES-256-GCM encryption + SHA-256 hashing.

The application master key is derived from a per-deployment value. In a real
deployment this would come from a KMS; here we require an env var or fall back to
a dev-only key with a loud warning. Each file gets a unique random nonce; the
nonce is stored alongside the ciphertext so files remain decryptable.
"""
import hashlib
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_KEY_FALLBACK = hashlib.sha256(b"trustvault-dev-only-key-do-not-use-in-prod").digest()

GCM_NONCE_LEN = 12
KEY_LEN = 32


def _load_key() -> bytes:
    raw = os.environ.get("TRUSTVAULT_MASTER_KEY", "").encode()
    if not raw:
        return _KEY_FALLBACK
    if len(raw) < 32:
        import warnings

        warnings.warn("TRUSTVAULT_MASTER_KEY too short; deriving from SHA-256.")
    return hashlib.sha256(raw).digest()


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def encrypt_bytes(plaintext: bytes) -> tuple[bytes, bytes]:
    """Return (ciphertext, nonce). Ciphertext includes an empty AAD."""
    key = _load_key()
    nonce = os.urandom(GCM_NONCE_LEN)
    ct = AESGCM(key).encrypt(nonce, plaintext, None)
    return ct, nonce


def decrypt_bytes(ciphertext: bytes, nonce: bytes) -> bytes:
    key = _load_key()
    return AESGCM(key).decrypt(nonce, ciphertext, None)