import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Asset, AuditAnchor, SecurityEvent, User
from app.schemas import AuditEventOut

router = APIRouter(prefix="/audit", tags=["audit"])
log = logging.getLogger("trustvault.audit")


@router.get("/{asset_id}", response_model=list[AuditEventOut])
def audit_history(
    asset_id: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Show audit history for an asset (owner/admin only)."""
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset.owner_id != current.id and current.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized for this audit trail")

    # Security events touching this asset, newest first.
    events = (
        db.query(SecurityEvent)
        .filter(SecurityEvent.risk_signals["asset_id"].as_string() == asset_id)
        .order_by(SecurityEvent.created_at.desc())
        .all()
    )
    anchors: dict[str, AuditAnchor] = {
        a.event_id: a for a in db.query(AuditAnchor).all()
    }

    result: list[AuditEventOut] = []
    for evt in events:
        anchor = anchors.get(evt.id)
        result.append(
            AuditEventOut(
                event_id=evt.id,
                event_type=evt.event_type,
                trust_score=evt.trust_score,
                decision=evt.decision,
                risk_signals=evt.risk_signals,
                created_at=evt.created_at,
                anchor={
                    "tx_hash": anchor.tx_hash,
                    "chain": anchor.chain,
                    "anchored_at": anchor.anchored_at.isoformat(),
                    "status": "anchored" if anchor.tx_hash != "pending" else "pending",
                }
                if anchor
                else None,
            )
        )
    return result