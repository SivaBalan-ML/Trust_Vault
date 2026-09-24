import hashlib
import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.core.crypto import sha256_hex
from app.db.session import get_db
from app.models import Credential, User
from app.schemas import CredentialIssueRequest, CredentialResponse, RevokeRequest, VerifyResponse

router = APIRouter(prefix="/credentials", tags=["credentials"])
log = logging.getLogger("trustvault.credentials")


def _canonical_hash(document: dict | None = None, document_base64: str | None = None) -> str:
    if document_base64:
        return sha256_hex(document_base64.encode())
    blob = json.dumps(document or {}, sort_keys=True, separators=(",", ":")).encode()
    return sha256_hex(blob)


@router.post("/issue", response_model=CredentialResponse)
def issue_credential(
    body: CredentialIssueRequest,
    current: User = Depends(require_role("issuer", "admin")),
    db: Session = Depends(get_db),
):
    """Issuer creates a credential for a holder. Only issuer/admin may call.

    Only the SHA-256 hash of the claim is stored (and later anchored on-chain),
    never the raw document.
    """
    holder = db.query(User).filter(User.email == body.holder_email.lower()).first()
    if not holder:
        raise HTTPException(status_code=404, detail="Holder not found")
    if holder.status != "active" or holder.role not in ("holder", "verifier", "issuer"):
        raise HTTPException(status_code=400, detail="Holder is not eligible for credentials")

    credential = Credential(
        issuer_id=current.id,
        holder_id=holder.id,
        type=body.type,
        hash=_canonical_hash(body.document, body.document_base64),
        status="active",
    )
    db.add(credential)
    db.commit()
    db.refresh(credential)
    log.info("Credential %s issued by %s to %s", credential.id, current.id, holder.id)
    return _to_response(credential)


@router.get("", response_model=list[CredentialResponse])
def list_credentials(
    holder: str | None = None,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List credentials held by (or issued by) the current user."""
    q = db.query(Credential)
    if holder == "me":
        q = q.filter(Credential.holder_id == current.id)
    elif holder is not None and current.role in ("issuer", "admin"):
        q = q.filter(Credential.holder_id == holder)
    else:
        q = q.filter(
            (Credential.holder_id == current.id) | (Credential.issuer_id == current.id)
        )
    return [_to_response(c) for c in q.order_by(Credential.issued_at.desc()).all()]


@router.get("/{credential_id}/verify", response_model=VerifyResponse)
def verify_credential(
    credential_id: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Verify a credential's status (the verifier flow)."""
    credential = db.get(Credential, credential_id)
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")
    return VerifyResponse(
        id=credential.id,
        valid=credential.status == "active",
        status=credential.status,
        hash_match=True,
        purpose=None,
    )


@router.post("/{credential_id}/revoke")
def revoke_credential(
    credential_id: str,
    body: RevokeRequest,
    current: User = Depends(require_role("issuer", "admin")),
    db: Session = Depends(get_db),
):
    credential = db.get(Credential, credential_id)
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")
    if credential.issuer_id != current.id and current.role != "admin":
        raise HTTPException(status_code=403, detail="Only the issuing institution may revoke")
    if credential.status == "revoked":
        raise HTTPException(status_code=409, detail="Credential already revoked")

    credential.status = "revoked"
    credential.revoked_at = datetime.utcnow()
    db.commit()
    db.refresh(credential)
    log.warning("Credential %s revoked by %s (%s)", credential.id, current.id, body.reason)
    return {"id": credential.id, "status": "revoked", "revoked_at": credential.revoked_at.isoformat()}


def _to_response(c: Credential) -> CredentialResponse:
    return CredentialResponse(
        id=c.id,
        type=c.type,
        hash=c.hash,
        status=c.status,
        issuer_id=c.issuer_id,
        holder_id=c.holder_id,
        issued_at=c.issued_at,
        revoked_at=c.revoked_at,
    )