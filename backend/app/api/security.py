from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import SecurityEvent, User
from app.schemas import SecurityEventIn, SecurityEventOut
from app.services.policy import record_event

router = APIRouter(prefix="/security", tags=["security"])


@router.post("/events", response_model=SecurityEventOut)
def record_security_event(
    body: SecurityEventIn,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record security telemetry (attack-simulation hooks push here)."""
    evt = record_event(
        db,
        body.user_id or current.id,
        body.event_type,
        **body.risk_signals,
    )
    return SecurityEventOut(
        id=evt.id,
        user_id=evt.user_id,
        event_type=evt.event_type,
        risk_signals=evt.risk_signals,
        trust_score=evt.trust_score,
        decision=evt.decision,
        created_at=evt.created_at,
    )


@router.get("/events", response_model=list[SecurityEventOut])
def list_security_events(
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Security event timeline for the dashboard (owner/admin scoped)."""
    events: list[SecurityEvent]
    if current.role == "admin":
        events = (
            db.query(SecurityEvent)
            .order_by(SecurityEvent.created_at.desc())
            .limit(200)
            .all()
        )
    else:
        events = (
            db.query(SecurityEvent)
            .filter(SecurityEvent.user_id == current.id)
            .order_by(SecurityEvent.created_at.desc())
            .limit(200)
            .all()
        )
    return [
        SecurityEventOut(
            id=e.id,
            user_id=e.user_id,
            event_type=e.event_type,
            risk_signals=e.risk_signals,
            trust_score=e.trust_score,
            decision=e.decision,
            created_at=e.created_at,
        )
        for e in events
    ]