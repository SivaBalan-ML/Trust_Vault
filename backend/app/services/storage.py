import os
import uuid
from pathlib import Path

from app.core.config import get_settings
from app.core.crypto import decrypt_bytes, encrypt_bytes, sha256_hex

settings = get_settings()


class StorageError(Exception):
    pass


def _root() -> Path:
    p = Path(settings.storage_dir)
    p.mkdir(parents=True, exist_ok=True)
    return p


def save_encrypted(plaintext: bytes) -> tuple[str, str, bytes]:
    """Encrypt + store a file. Returns (asset_id, relative_uri, plaintext_sha256).

    On-disk layout: <nonce (12B)> || <ciphertext>. Single file per asset keeps
    the nonce bound to its ciphertext atomically.
    """
    asset_id = str(uuid.uuid4())
    file_hash = sha256_hex(plaintext)
    ciphertext, nonce = encrypt_bytes(plaintext)
    rel_path = f"{asset_id}.enc"
    abs_path = _root() / rel_path
    try:
        abs_path.write_bytes(nonce + ciphertext)
    except OSError as exc:
        raise StorageError(f"Failed to write encrypted file: {exc}") from exc
    return asset_id, rel_path, file_hash


def load_decrypted(relative_uri: str) -> bytes:
    """Read an encrypted file and return its decrypted plaintext."""
    abs_path = _root() / os.path.basename(relative_uri)
    if not abs_path.exists():
        raise StorageError(f"Encrypted file not found: {relative_uri}")
    blob = abs_path.read_bytes()
    if len(blob) < 12:
        raise StorageError("Corrupt encrypted file (too short)")
    nonce, ciphertext = blob[:12], blob[12:]
    return decrypt_bytes(ciphertext, nonce)


def delete(relative_uri: str) -> None:
    abs_path = _root() / os.path.basename(relative_uri)
    if abs_path.exists():
        abs_path.unlink()